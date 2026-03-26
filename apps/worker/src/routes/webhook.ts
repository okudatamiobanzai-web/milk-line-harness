import { generateAiReply } from '../services/ai-reply.js';
import { Hono } from 'hono';
import { verifySignature, LineClient } from '@line-crm/line-sdk';
import type { WebhookRequestBody, WebhookEvent, TextEventMessage } from '@line-crm/line-sdk';
import {
  upsertFriend,
  updateFriendFollowStatus,
  getFriendByLineUserId,
  getScenarios,
  enrollFriendInScenario,
  getScenarioSteps,
  advanceFriendScenario,
  completeFriendScenario,
  upsertChatOnMessage,
  getLineAccounts,
  addTagToFriend,
  jstNow,
} from '@line-crm/db';
import { fireEvent } from '../services/event-bus.js';
import { buildMessage, expandVariables } from '../services/step-delivery.js';
import {
  RYUTARO_LINE_ID,
  OPS_CATEGORIES,
  OPS_SUB_ITEMS,
  getSubLabels,
  buildCategoryFlex,
  buildSubItemFlex,
  buildAddMoreQuickReply,
  buildItemRecordedText,
  buildCompleteFlex,
  buildTaskNotifyFlex,
  buildOrderNotifyFlex,
  buildCommentQuickReply,
  buildOrderResultFlex,
} from '../services/ops.js';
import type { Env } from '../index.js';

const webhook = new Hono<Env>();

webhook.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('X-Line-Signature') ?? '';
  const db = c.env.DB;

  let body: WebhookRequestBody;
  try {
    body = JSON.parse(rawBody) as WebhookRequestBody;
  } catch {
    console.error('Failed to parse webhook body');
    return c.json({ status: 'ok' }, 200);
  }

  // Multi-account: resolve credentials from DB by destination (channel user ID)
  // or fall back to environment variables (default account)
  let channelSecret = c.env.LINE_CHANNEL_SECRET;
  let channelAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
  let matchedAccountId: string | null = null;

  if ((body as { destination?: string }).destination) {
    const accounts = await getLineAccounts(db);
    for (const account of accounts) {
      if (!account.is_active) continue;
      const isValid = await verifySignature(account.channel_secret, rawBody, signature);
      if (isValid) {
        channelSecret = account.channel_secret;
        channelAccessToken = account.channel_access_token;
        matchedAccountId = account.id;
        break;
      }
    }
  }

  // Verify with resolved secret
  const valid = await verifySignature(channelSecret, rawBody, signature);
  if (!valid) {
    console.error('Invalid LINE signature');
    return c.json({ status: 'ok' }, 200);
  }

  const lineClient = new LineClient(channelAccessToken);

  // 非同期処理 — LINE は ~1s 以内のレスポンスを要求
  const processingPromise = (async () => {
    for (const event of body.events) {
      try {
        await handleEvent(db, lineClient, event, channelAccessToken, matchedAccountId, c.env.WORKER_URL || new URL(c.req.url).origin, c.env.ANTHROPIC_API_KEY);
      } catch (err) {
        console.error('Error handling webhook event:', err);
      }
    }
  })();

  c.executionCtx.waitUntil(processingPromise);

  return c.json({ status: 'ok' }, 200);
});

async function handleEvent(
  db: D1Database,
  lineClient: LineClient,
  event: WebhookEvent,
  lineAccessToken: string,
  lineAccountId: string | null = null,
  workerUrl?: string,
  anthropicKey?: string,
): Promise<void> {
  if (event.type === 'follow') {
    const userId =
      event.source.type === 'user' ? event.source.userId : undefined;
    if (!userId) return;

    // プロフィール取得 & 友だち登録/更新
    let profile;
    try {
      profile = await lineClient.getProfile(userId);
    } catch (err) {
      console.error('Failed to get profile for', userId, err);
    }

    const friend = await upsertFriend(db, {
      lineUserId: userId,
      displayName: profile?.displayName ?? null,
      pictureUrl: profile?.pictureUrl ?? null,
      statusMessage: profile?.statusMessage ?? null,
    });

    // Set line_account_id for multi-account tracking
    if (lineAccountId) {
      await db.prepare('UPDATE friends SET line_account_id = ? WHERE id = ? AND line_account_id IS NULL')
        .bind(lineAccountId, friend.id).run();
    }

    // friend_add シナリオに登録（このアカウントのシナリオのみ）
    const scenarios = await getScenarios(db);
    for (const scenario of scenarios) {
      // Only trigger scenarios belonging to this account (or unassigned for backward compat)
      const scenarioAccountMatch = !scenario.line_account_id || !lineAccountId || scenario.line_account_id === lineAccountId;
      if (scenario.trigger_type === 'friend_add' && scenario.is_active && scenarioAccountMatch) {
        try {
          const existing = await db
            .prepare(`SELECT id FROM friend_scenarios WHERE friend_id = ? AND scenario_id = ?`)
            .bind(friend.id, scenario.id)
            .first<{ id: string }>();
          if (!existing) {
            const friendScenario = await enrollFriendInScenario(db, friend.id, scenario.id);

            // Immediate delivery: if the first step has delay=0, send it now via replyMessage (free)
            const steps = await getScenarioSteps(db, scenario.id);
            const firstStep = steps[0];
            if (firstStep && firstStep.delay_minutes === 0 && friendScenario.status === 'active') {
              try {
                const expandedContent = expandVariables(firstStep.message_content, friend as { id: string; display_name: string | null; user_id: string | null });
                const message = buildMessage(firstStep.message_type, expandedContent);
                await lineClient.replyMessage(event.replyToken, [message]);
                console.log(`Immediate delivery: sent step ${firstStep.id} to ${userId}`);

                // Log outgoing message
                const logId = crypto.randomUUID();
                await db
                  .prepare(
                    `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
                     VALUES (?, ?, 'outgoing', ?, ?, NULL, ?, ?)`,
                  )
                  .bind(logId, friend.id, firstStep.message_type, firstStep.message_content, firstStep.id, jstNow())
                  .run();

                // Advance or complete the friend_scenario
                const secondStep = steps[1] ?? null;
                if (secondStep) {
                  const nextDeliveryDate = new Date(Date.now() + 9 * 60 * 60_000);
                  nextDeliveryDate.setMinutes(nextDeliveryDate.getMinutes() + secondStep.delay_minutes);
                  // Enforce 9:00-21:00 JST delivery window
                  const h = nextDeliveryDate.getUTCHours();
                  if (h < 9 || h >= 21) {
                    if (h >= 21) nextDeliveryDate.setUTCDate(nextDeliveryDate.getUTCDate() + 1);
                    nextDeliveryDate.setUTCHours(9, 0, 0, 0);
                  }
                  await advanceFriendScenario(db, friendScenario.id, firstStep.step_order, nextDeliveryDate.toISOString().slice(0, -1) + '+09:00');
                } else {
                  await completeFriendScenario(db, friendScenario.id);
                }
              } catch (err) {
                console.error('Failed immediate delivery for scenario', scenario.id, err);
              }
            }
          }
        } catch (err) {
          console.error('Failed to enroll friend in scenario', scenario.id, err);
        }
      }
    }

    // イベントバス発火: friend_add
    await fireEvent(db, 'friend_add', { friendId: friend.id, eventData: { displayName: friend.display_name } }, lineAccessToken, lineAccountId);
    return;
  }

  if (event.type === 'unfollow') {
    const userId =
      event.source.type === 'user' ? event.source.userId : undefined;
    if (!userId) return;

    await updateFriendFollowStatus(db, userId, false);
    return;
  }


  // ============ POSTBACK HANDLER (ステップ配信ボタンタップ) ============
  if (event.type === 'postback') {
    const userId = event.source.type === 'user' ? event.source.userId : undefined;
    if (!userId) return;

    const friend = await getFriendByLineUserId(db, userId);
    if (!friend) return;

    // ★ postback受信をmessages_logに記録（会話=データの基盤）
    try {
      await db.prepare(
        `INSERT INTO messages_log (id, friend_id, direction, message_type, content, created_at)
         VALUES (?, ?, 'incoming', 'postback', ?, ?)`
      ).bind(crypto.randomUUID(), friend.id, event.postback.data, jstNow()).run();
    } catch (e) {
      console.error('Postback log error:', e);
    }

    // Parse postback data: "action=tag&tag=タグ名&reply=返信テキスト&color=#hex"
    const params = new URLSearchParams(event.postback.data);
    const action = params.get('action');

    // ─── milk ops: Category selected → show sub-items ───
    if (action === 'ops') {
      const catKey = params.get('cat');
      if (!catKey || !OPS_CATEGORIES[catKey]) return;

      const flex = buildSubItemFlex(catKey);
      try {
        await lineClient.replyMessage(event.replyToken, [
          buildMessage('flex', JSON.stringify(flex)),
        ]);
        // Log outgoing
        await db.prepare(
          `INSERT INTO messages_log (id, friend_id, direction, message_type, content, created_at)
           VALUES (?, ?, 'outgoing', 'flex', ?, ?)`
        ).bind(crypto.randomUUID(), friend.id, JSON.stringify(flex), jstNow()).run();
      } catch (e) {
        console.error('ops category reply error:', e);
      }
      return;
    }

    // ─── milk ops: Sub-item selected → record + "add more?" quick reply ───
    if (action === 'ops-item') {
      const catKey = params.get('cat') || '';
      const sub = params.get('sub') || '';
      const prevSel = params.get('sel'); // previously selected items
      const allSelected = prevSel ? [...prevSel.split(','), sub] : [sub];

      const text = buildItemRecordedText(catKey, allSelected);
      const qr = buildAddMoreQuickReply(catKey, allSelected);

      try {
        await lineClient.replyMessage(event.replyToken, [{
          type: 'text',
          text,
          quickReply: qr,
        } as Record<string, unknown>]);
        await db.prepare(
          `INSERT INTO messages_log (id, friend_id, direction, message_type, content, created_at)
           VALUES (?, ?, 'outgoing', 'text', ?, ?)`
        ).bind(crypto.randomUUID(), friend.id, text, jstNow()).run();
      } catch (e) {
        console.error('ops item reply error:', e);
      }
      return;
    }

    // ─── milk ops: "もう1件追加" → show sub-items again (excluding selected) ───
    if (action === 'ops-more') {
      const catKey = params.get('cat') || '';
      const sel = params.get('sel')?.split(',') || [];

      const flex = buildSubItemFlex(catKey, sel);
      try {
        await lineClient.replyMessage(event.replyToken, [
          buildMessage('flex', JSON.stringify(flex)),
        ]);
      } catch (e) {
        console.error('ops more reply error:', e);
      }
      return;
    }

    // ─── milk ops: "これで完了" → save report + completion Flex + notify Ryutaro ───
    if (action === 'ops-done') {
      const catKey = params.get('cat') || '';
      const sel = params.get('sel')?.split(',').filter(Boolean) || [];

      if (sel.length === 0 || !OPS_CATEGORIES[catKey]) return;

      // 1. Save to ops_reports
      try {
        await db.prepare(
          `INSERT INTO ops_reports (id, friend_id, category, sub_items, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), friend.id, catKey, JSON.stringify(sel), jstNow()).run();
      } catch (e) {
        console.error('ops report save error:', e);
      }

      // 2. Reply with completion Flex
      const completeFlex = buildCompleteFlex(friend.display_name, catKey, sel);
      try {
        await lineClient.replyMessage(event.replyToken, [
          buildMessage('flex', JSON.stringify(completeFlex)),
        ]);
        await db.prepare(
          `INSERT INTO messages_log (id, friend_id, direction, message_type, content, created_at)
           VALUES (?, ?, 'outgoing', 'flex', ?, ?)`
        ).bind(crypto.randomUUID(), friend.id, JSON.stringify(completeFlex), jstNow()).run();
      } catch (e) {
        console.error('ops done reply error:', e);
      }

      // 3. Push notification to Ryutaro
      const notifyFlex = buildTaskNotifyFlex(friend.display_name, catKey, sel);
      try {
        await lineClient.pushMessage(RYUTARO_LINE_ID, [
          buildMessage('flex', JSON.stringify(notifyFlex)),
        ]);
      } catch (e) {
        console.error('ops notify push error:', e);
      }
      return;
    }

    // ─── milk ops: Approve order → set pending comment state ───
    if (action === 'ops-approve' || action === 'ops-reject') {
      const submissionId = params.get('sid') || '';
      const requesterFriendId = params.get('fid') || '';
      const isApprove = action === 'ops-approve';

      // Store pending approval in Ryutaro's friend metadata
      try {
        const existing = await db.prepare('SELECT metadata FROM friends WHERE id = ?').bind(friend.id).first<{ metadata: string }>();
        const meta = JSON.parse(existing?.metadata || '{}');
        meta.ops_pending_approval = {
          submissionId,
          requesterFriendId,
          action: isApprove ? 'approved' : 'rejected',
        };
        await db.prepare('UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(meta), jstNow(), friend.id).run();
      } catch (e) {
        console.error('ops approval metadata error:', e);
      }

      // Reply asking for comment
      const replyText = isApprove
        ? '✅ 承認します！\nコメントがあれば次のメッセージで送ってね\n（なければ下のボタンで完了）'
        : '❌ 却下します。\n理由やコメントがあれば次のメッセージで送ってね\n（なければ下のボタンで完了）';

      try {
        await lineClient.replyMessage(event.replyToken, [{
          type: 'text',
          text: replyText,
          quickReply: buildCommentQuickReply(),
        } as Record<string, unknown>]);
      } catch (e) {
        console.error('ops approve reply error:', e);
      }
      return;
    }

    if (action === 'tag') {
      const tagName = params.get('tag');
      const replyText = params.get('reply') || 'ありがとうございます！';
      const tagColor = params.get('color') || '#0F6E56';
      const notify = params.get('notify'); // If set, notify ryutaro

      if (tagName) {
        // Find or create the tag
        let tag = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first<{ id: string }>();
        if (!tag) {
          const tagId = crypto.randomUUID();
          await db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
            .bind(tagId, tagName, tagColor, new Date().toISOString()).run();
          tag = { id: tagId };
        }

        // Add tag to friend (ignore if already exists)
        try {
          await addTagToFriend(db, friend.id, tag.id);
        } catch (e) {
          // Duplicate tag, ignore
        }
      }

      // Reply to user
      if (event.replyToken) {
        try {
          await lineClient.replyMessage(event.replyToken, [{ type: 'text', text: replyText }]);
        } catch (e) {
          console.error('Postback reply error:', e);
        }
      }

      // Notify ryutaro if flagged (e.g. "一緒に何かやりたい" button)
      if (notify === 'true') {
        try {
          await lineClient.pushMessage(RYUTARO_LINE_ID, [{
            type: 'text',
            text: `📢 ${friend.display_name || '匿名'}さんが「${tagName}」ボタンをタップしました！`,
          }]);
        } catch (e) {
          console.error('Notify error:', e);
        }
      }
    }

    return;
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const textMessage = event.message as TextEventMessage;
    const userId =
      event.source.type === 'user' ? event.source.userId : undefined;
    if (!userId) return;

    const friend = await getFriendByLineUserId(db, userId);
    if (!friend) return;

    const incomingText = textMessage.text;
    const now = jstNow();
    const logId = crypto.randomUUID();

    // 受信メッセージをログに記録
    await db
      .prepare(
        `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
         VALUES (?, ?, 'incoming', 'text', ?, NULL, NULL, ?)`,
      )
      .bind(logId, friend.id, incomingText, now)
      .run();

    // チャットを作成/更新（オペレーター機能連携）
    await upsertChatOnMessage(db, friend.id);

    // ─── milk ops: 承認コメント検出 ───
    // Ryutaro が承認/却下後にコメントを送ると、依頼者に転送される
    try {
      const metaRow = await db.prepare('SELECT metadata FROM friends WHERE id = ?').bind(friend.id).first<{ metadata: string }>();
      const meta = JSON.parse(metaRow?.metadata || '{}');
      if (meta.ops_pending_approval) {
        const { submissionId, requesterFriendId, action: approvalAction } = meta.ops_pending_approval;
        const isApproved = approvalAction === 'approved';
        const comment = incomingText === 'コメントなし' ? null : incomingText;

        // 1. Update ops_orders status
        try {
          await db.prepare(
            `UPDATE ops_orders SET status = ?, comment = ?, approved_by = ?, updated_at = ? WHERE submission_id = ?`
          ).bind(isApproved ? 'approved' : 'rejected', comment, friend.id, jstNow(), submissionId).run();
        } catch (e) {
          console.error('ops order update error:', e);
        }

        // 2. Get order info for notification
        const order = await db.prepare('SELECT item_name FROM ops_orders WHERE submission_id = ?')
          .bind(submissionId).first<{ item_name: string }>();
        const itemName = order?.item_name || '（不明な品目）';

        // 3. Push result to requester
        const requester = await db.prepare('SELECT line_user_id FROM friends WHERE id = ?')
          .bind(requesterFriendId).first<{ line_user_id: string }>();
        if (requester?.line_user_id) {
          const resultFlex = buildOrderResultFlex(itemName, isApproved, comment);
          try {
            await lineClient.pushMessage(requester.line_user_id, [
              buildMessage('flex', JSON.stringify(resultFlex)),
            ]);
          } catch (e) {
            console.error('ops result push error:', e);
          }
        }

        // 4. Clear pending state
        delete meta.ops_pending_approval;
        await db.prepare('UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(meta), jstNow(), friend.id).run();

        // 5. Confirm to Ryutaro
        const confirmText = isApproved
          ? `✅ 承認完了！${comment ? `コメント「${comment}」を` : ''}${order?.item_name || ''}の依頼者に通知しました。`
          : `❌ 却下しました。${comment ? `コメント「${comment}」を` : ''}依頼者に通知しました。`;
        try {
          await lineClient.replyMessage(event.replyToken, [{ type: 'text', text: confirmText }]);
        } catch (e) {
          console.error('ops confirm reply error:', e);
        }
        return;
      }
    } catch (e) {
      console.error('ops comment detection error:', e);
    }

    // 配信時間設定: 「配信時間は○時」「○時に届けて」等のパターンを検出
    const timeMatch = incomingText.match(/(?:配信時間|配信|届けて|通知)[はを]?\s*(\d{1,2})\s*時/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      if (hour >= 6 && hour <= 22) {
        // Save preferred_hour to friend metadata
        const existing = await db.prepare('SELECT metadata FROM friends WHERE id = ?').bind(friend.id).first<{ metadata: string }>();
        const meta = JSON.parse(existing?.metadata || '{}');
        meta.preferred_hour = hour;
        await db.prepare('UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(meta), jstNow(), friend.id).run();

        // Reply with confirmation
        try {
          const period = hour < 12 ? '午前' : '午後';
          const displayHour = hour <= 12 ? hour : hour - 12;
          await lineClient.replyMessage(event.replyToken, [
            buildMessage('flex', JSON.stringify({
              type: 'bubble',
              body: { type: 'box', layout: 'vertical', contents: [
                { type: 'text', text: '配信時間を設定しました', size: 'lg', weight: 'bold', color: '#1e293b' },
                { type: 'box', layout: 'vertical', contents: [
                  { type: 'text', text: `${period} ${displayHour}:00`, size: 'xxl', weight: 'bold', color: '#f59e0b', align: 'center' },
                  { type: 'text', text: `（${hour}:00〜）`, size: 'sm', color: '#64748b', align: 'center', margin: 'sm' },
                ], backgroundColor: '#fffbeb', cornerRadius: 'md', paddingAll: '20px', margin: 'lg' },
                { type: 'text', text: '今後のステップ配信はこの時間以降にお届けします。', size: 'xs', color: '#64748b', wrap: true, margin: 'lg' },
              ], paddingAll: '20px' },
            })),
          ]);
        } catch (err) {
          console.error('Failed to reply for time setting', err);
        }
        return;
      }
    }

    // 自動返信チェック（このアカウントのルール + グローバルルールのみ）
    // NOTE: Auto-replies use replyMessage (free, no quota) instead of pushMessage
    // The replyToken is only valid for ~1 minute after the message event
    const autoReplies = await db
      .prepare(`SELECT * FROM auto_replies WHERE is_active = 1 AND (line_account_id IS NULL${lineAccountId ? ` OR line_account_id = '${lineAccountId}'` : ''}) ORDER BY created_at ASC`)
      .all<{
        id: string;
        keyword: string;
        match_type: 'exact' | 'contains';
        response_type: string;
        response_content: string;
        is_active: number;
        created_at: string;
      }>();

    let matched = false;
    for (const rule of autoReplies.results) {
      const isMatch =
        rule.match_type === 'exact'
          ? incomingText === rule.keyword
          : incomingText.includes(rule.keyword);

      if (isMatch) {
        try {
          // Expand template variables ({{name}}, {{uid}}, {{auth_url:CHANNEL_ID}})
          const expandedContent = expandVariables(rule.response_content, friend as { id: string; display_name: string | null; user_id: string | null }, workerUrl);
          const replyMsg = buildMessage(rule.response_type, expandedContent);
          await lineClient.replyMessage(event.replyToken, [replyMsg]);

          // 送信ログ
          const outLogId = crypto.randomUUID();
          await db
            .prepare(
              `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
               VALUES (?, ?, 'outgoing', ?, ?, NULL, NULL, ?)`,
            )
            .bind(outLogId, friend.id, rule.response_type, rule.response_content, jstNow())
            .run();
        } catch (err) {
          console.error('Failed to send auto-reply', err);
        }

        matched = true;
        break;
      }
    }



    // AI自動応答（キーワード未マッチ時）
    if (!matched && event.replyToken && anthropicKey) {
      try {
        const aiReply = await generateAiReply(incomingText, anthropicKey, friend.display_name);
        if (aiReply) {
          await lineClient.replyMessage(event.replyToken, [{ type: 'text', text: aiReply }]);
          const aiLogId = crypto.randomUUID();
          await db
            .prepare(
              `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
               VALUES (?, ?, 'outgoing', 'text', ?, NULL, NULL, ?)`
            )
            .bind(aiLogId, friend.id, aiReply, jstNow())
            .run();
          matched = true;
        }
      } catch (aiErr) {
        console.error('AI reply failed:', aiErr);
      }
    }


    // 初回問い合わせタグ自動付与
    const firstTimerKeywords = ['利用方法', '使い方', '初めて', 'はじめて', '見学', 'ドロップイン', '始め', '利用したい', '行きたい', '行ってみたい', 'どんなところ', 'どんな場所', '雰囲気', '入り方', '入口', 'チェックイン', 'アプリ', 'いいオフィス'];
    const isFirstTimer = firstTimerKeywords.some(kw => incomingText.includes(kw));
    if (isFirstTimer) {
      try {
        const existingFtTag = await db
          .prepare('SELECT 1 FROM friend_tags WHERE friend_id = ? AND tag_id = ?')
          .bind(friend.id, '78eb85f3-6786-424d-aa46-0944488854b9')
          .first();
        if (!existingFtTag) {
          await db
            .prepare('INSERT OR IGNORE INTO friend_tags (friend_id, tag_id) VALUES (?, ?)')
            .bind(friend.id, '78eb85f3-6786-424d-aa46-0944488854b9')
            .run();

          // Enroll in tag_added scenarios
          const tagScenarios = await db
            .prepare("SELECT id FROM scenarios WHERE trigger_type = 'tag_added' AND trigger_tag_id = ? AND is_active = 1")
            .bind('78eb85f3-6786-424d-aa46-0944488854b9')
            .all<{ id: string }>();
          for (const ts of tagScenarios.results) {
            const alreadyEnrolled = await db
              .prepare('SELECT id FROM friend_scenarios WHERE friend_id = ? AND scenario_id = ?')
              .bind(friend.id, ts.id)
              .first();
            if (!alreadyEnrolled) {
              const fsId = crypto.randomUUID();
              const firstStepRow = await db
                .prepare('SELECT delay_minutes FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC LIMIT 1')
                .bind(ts.id)
                .first<{ delay_minutes: number }>();
              const delayMs = (firstStepRow?.delay_minutes || 1440) * 60_000;
              const nextDate = new Date(Date.now() + 9 * 3600_000 + delayMs);
              const h = nextDate.getUTCHours();
              if (h < 9 || h >= 21) { if (h >= 21) nextDate.setUTCDate(nextDate.getUTCDate() + 1); nextDate.setUTCHours(9, 0, 0, 0); }
              const nextStr = nextDate.toISOString().slice(0, -1) + '+09:00';
              await db
                .prepare("INSERT INTO friend_scenarios (id, friend_id, scenario_id, current_step, status, next_delivery_at, started_at) VALUES (?, ?, ?, 0, 'active', ?, ?)")
                .bind(fsId, friend.id, ts.id, nextStr, jstNow())
                .run();
            }
          }
        }
      } catch (ftErr) { console.error('First-timer tag error:', ftErr); }
    }

    // イベントバス発火: message_received
    await fireEvent(db, 'message_received', {
      friendId: friend.id,
      eventData: { text: incomingText, matched },
    }, lineAccessToken, lineAccountId);

    return;
  }
}

export { webhook };
