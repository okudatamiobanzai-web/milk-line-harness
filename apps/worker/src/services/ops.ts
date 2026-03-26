/**
 * milk ops — LINE Integration Service
 *
 * Flex message builders + constants for the ops reporting flow.
 * All task reports stay in LINE chat using postback + Quick Reply (free replyMessage).
 */

// ── Constants ────────────────────────────────────────────────────────────

export const RYUTARO_LINE_ID = 'U2fd039fc2f1cbb39c27843392b8c7542';

export const OPS_CATEGORIES: Record<string, { label: string; emoji: string; color: string }> = {
  tidy:    { label: '整理・片付け', emoji: '📦', color: '#3B82F6' },
  clean:   { label: '掃除',        emoji: '🧹', color: '#10B981' },
  restock: { label: '補充',        emoji: '🧴', color: '#F59E0B' },
  parcel:  { label: '荷物対応',    emoji: '📮', color: '#EF4444' },
};

export const OPS_SUB_ITEMS: Record<string, { key: string; label: string }[]> = {
  tidy: [
    { key: 'desk',    label: 'デスク周り' },
    { key: 'shelf',   label: '本棚・ラック' },
    { key: 'kitchen', label: 'キッチン周り' },
    { key: 'meeting', label: '会議スペース' },
    { key: 'other',   label: 'その他' },
  ],
  clean: [
    { key: 'table',  label: 'テーブル拭き' },
    { key: 'floor',  label: '床掃除' },
    { key: 'toilet', label: 'トイレ' },
    { key: 'trash',  label: 'ゴミ捨て' },
    { key: 'window', label: '窓・ガラス' },
    { key: 'other',  label: 'その他' },
  ],
  restock: [
    { key: 'paper', label: 'コピー用紙' },
    { key: 'tp',    label: 'トイレットペーパー' },
    { key: 'soap',  label: 'ソープ・洗剤' },
    { key: 'drink', label: 'コーヒー・お茶' },
    { key: 'bag',   label: 'ゴミ袋' },
    { key: 'other', label: 'その他' },
  ],
  parcel: [
    { key: 'receive', label: '宅配便受け取り' },
    { key: 'sort',    label: '郵便物の仕分け' },
    { key: 'notify',  label: '届け先に連絡済み' },
    { key: 'other',   label: 'その他' },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────

export function getSubLabel(cat: string, subKey: string): string {
  return OPS_SUB_ITEMS[cat]?.find(s => s.key === subKey)?.label || subKey;
}

export function getSubLabels(cat: string, subKeys: string[]): string[] {
  return subKeys.map(k => getSubLabel(cat, k));
}

// ── Flex Builders ────────────────────────────────────────────────────────

/** Step 0: Category selection card — triggered by "対応報告" auto-reply */
export function buildCategoryFlex(): object {
  const rows = [];
  const cats = Object.entries(OPS_CATEGORIES);
  for (let i = 0; i < cats.length; i += 2) {
    const pair = cats.slice(i, i + 2).map(([key, c]) => ({
      type: 'button',
      action: {
        type: 'postback',
        label: `${c.emoji} ${c.label}`,
        data: `action=ops&cat=${key}`,
        displayText: `${c.emoji} ${c.label}`,
      },
      style: 'secondary',
      height: 'md',
      flex: 1,
    }));
    rows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: pair,
    });
  }

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '☕ おつかれさまです！', weight: 'bold', size: 'lg', color: '#1a1a1a' },
        { type: 'text', text: '何を対応しましたか？', color: '#888888', size: 'sm', margin: 'sm' },
      ],
      paddingAll: '16px',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: rows,
      paddingAll: '12px',
    },
  };
}

/** Step 1: Sub-item selection card — excludes already-selected items */
export function buildSubItemFlex(catKey: string, excludeKeys: string[] = []): object {
  const cat = OPS_CATEGORIES[catKey];
  if (!cat) return { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: 'エラー' }] } };

  const items = (OPS_SUB_ITEMS[catKey] || []).filter(s => !excludeKeys.includes(s.key));

  const selParam = excludeKeys.length > 0 ? `&sel=${excludeKeys.join(',')}` : '';

  const buttons = items.map(s => ({
    type: 'button',
    action: {
      type: 'postback',
      label: s.label,
      data: `action=ops-item&cat=${catKey}&sub=${s.key}${selParam}`,
      displayText: s.label,
    },
    style: 'secondary' as const,
    height: 'sm' as const,
  }));

  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `${cat.emoji} ${cat.label}`, weight: 'bold', size: 'md', color: '#1a1a1a' },
        { type: 'text', text: excludeKeys.length > 0 ? '他にやったところは？' : 'やったところを選んでね 👆', color: '#888888', size: 'xs', margin: 'sm' },
      ],
      backgroundColor: `${cat.color}10`,
      paddingAll: '14px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: buttons.length > 0 ? buttons : [{ type: 'text', text: '全項目選択済み！', size: 'sm', color: '#888' }],
      paddingAll: '12px',
    },
  };
}

/** Quick Reply: "もう1件追加" / "これで完了" */
export function buildAddMoreQuickReply(catKey: string, selectedKeys: string[]) {
  const sel = selectedKeys.join(',');
  const remaining = (OPS_SUB_ITEMS[catKey] || []).filter(s => !selectedKeys.includes(s.key));

  const items: object[] = [];

  if (remaining.length > 0) {
    items.push({
      type: 'action',
      action: {
        type: 'postback',
        label: '🔄 もう1件追加',
        data: `action=ops-more&cat=${catKey}&sel=${sel}`,
        displayText: 'もう1件追加',
      },
    });
  }

  items.push({
    type: 'action',
    action: {
      type: 'postback',
      label: '✅ これで完了',
      data: `action=ops-done&cat=${catKey}&sel=${sel}`,
      displayText: 'これで完了！',
    },
  });

  return { items };
}

/** Confirmation text after selecting a sub-item (with Quick Reply attached) */
export function buildItemRecordedText(catKey: string, allSelectedKeys: string[]): string {
  const cat = OPS_CATEGORIES[catKey];
  const labels = getSubLabels(catKey, allSelectedKeys);
  return `✓ ${labels.join('、')} を記録しました！${cat?.emoji || ''}`;
}

/** Step 2: Completion Flex — shown after "これで完了" */
export function buildCompleteFlex(displayName: string | null, catKey: string, subKeys: string[]): object {
  const cat = OPS_CATEGORIES[catKey];
  if (!cat) return { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: 'エラー' }] } };

  const labels = getSubLabels(catKey, subKeys);
  const tagBubbles = labels.map(l => ({
    type: 'box',
    layout: 'vertical',
    contents: [{ type: 'text', text: l, size: 'xxs', color: '#065f46', align: 'center' }],
    backgroundColor: '#d1fae5',
    cornerRadius: 'xl',
    paddingAll: '6px',
    paddingStart: '12px',
    paddingEnd: '12px',
  }));

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '✨', size: 'xxl', align: 'center' },
        {
          type: 'text',
          text: `${subKeys.length}件の対応ありがとう！`,
          weight: 'bold', size: 'md', color: '#065f46', align: 'center', margin: 'md',
        },
        {
          type: 'box', layout: 'horizontal', contents: tagBubbles,
          spacing: 'xs', margin: 'lg', justifyContent: 'center',
          flexWrap: 'wrap',
        },
        {
          type: 'text',
          text: `${cat.emoji} ${cat.label}カテゴリで記録しました 🙏`,
          size: 'xxs', color: '#9ca3af', align: 'center', margin: 'md',
        },
      ],
      backgroundColor: '#ecfdf5',
      paddingAll: '24px',
    },
  };
}

/** Push notification Flex sent to Ryutaro for task reports */
export function buildTaskNotifyFlex(displayName: string | null, catKey: string, subKeys: string[]): object {
  const cat = OPS_CATEGORIES[catKey];
  if (!cat) return { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: 'エラー' }] } };

  const labels = getSubLabels(catKey, subKeys);
  const name = displayName || '匿名メンバー';
  const now = new Date(Date.now() + 9 * 3600_000);
  const timeStr = `${now.getUTCHours()}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: `${cat.emoji} 対応報告`, weight: 'bold', size: 'sm', color: '#1a1a1a', flex: 1 },
            { type: 'text', text: timeStr, size: 'xxs', color: '#9ca3af', align: 'end' },
          ],
        },
        {
          type: 'text', text: `${name}さん`, size: 'md', weight: 'bold', color: '#1a1a1a', margin: 'md',
        },
        {
          type: 'text',
          text: `${cat.label} → ${labels.join('、')}`,
          size: 'sm', color: '#6b7280', margin: 'sm', wrap: true,
        },
      ],
      paddingAll: '16px',
      backgroundColor: '#f0f9ff',
    },
  };
}

/** Flex notification sent to Ryutaro for order requests */
export function buildOrderNotifyFlex(
  displayName: string | null,
  itemName: string,
  reason: string,
  urgency: string,
  submissionId: string,
  requesterFriendId: string,
): object {
  const name = displayName || '匿名メンバー';
  const urgencyEmoji = urgency === '至急' ? '🔴' : urgency === '今週中' ? '📙' : '🟢';

  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box', layout: 'vertical',
      contents: [
        { type: 'text', text: '📦 新しい発注依頼', weight: 'bold', size: 'md', color: '#1e40af' },
        { type: 'text', text: `${name}さんからの依頼`, size: 'xs', color: '#6b7280', margin: 'sm' },
      ],
      backgroundColor: '#eff6ff',
      paddingAll: '16px',
    },
    body: {
      type: 'box', layout: 'vertical',
      contents: [
        {
          type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '品名', size: 'xs', color: '#6b7280', flex: 2 },
            { type: 'text', text: itemName, size: 'sm', weight: 'bold', color: '#1f2937', flex: 5, align: 'end' },
          ], margin: 'md',
        },
        {
          type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '理由', size: 'xs', color: '#6b7280', flex: 2 },
            { type: 'text', text: reason || '-', size: 'sm', color: '#1f2937', flex: 5, align: 'end', wrap: true },
          ], margin: 'sm',
        },
        {
          type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '緊急度', size: 'xs', color: '#6b7280', flex: 2 },
            { type: 'text', text: `${urgencyEmoji} ${urgency}`, size: 'sm', weight: 'bold', color: '#1f2937', flex: 5, align: 'end' },
          ], margin: 'sm',
        },
      ],
      paddingAll: '16px',
    },
    footer: {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        {
          type: 'button', style: 'primary', color: '#06C755', height: 'sm',
          action: {
            type: 'postback',
            label: '✅ 承認',
            data: `action=ops-approve&sid=${submissionId}&fid=${requesterFriendId}`,
            displayText: '✅ 承認します',
          },
        },
        {
          type: 'button', style: 'secondary', height: 'sm',
          action: {
            type: 'postback',
            label: '❌ 却下',
            data: `action=ops-reject&sid=${submissionId}&fid=${requesterFriendId}`,
            displayText: '❌ 却下します',
          },
        },
      ],
      paddingAll: '12px',
    },
  };
}

/** Quick Reply for comment input after approve/reject */
export function buildCommentQuickReply() {
  return {
    items: [
      {
        type: 'action',
        action: { type: 'message', label: '💬 コメントなしで完了', text: 'コメントなし' },
      },
    ],
  };
}

/** Approval/rejection result Flex sent to the requester */
export function buildOrderResultFlex(
  itemName: string,
  approved: boolean,
  comment?: string | null,
): object {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box', layout: 'vertical',
      contents: [
        { type: 'text', text: approved ? '✅' : '📋', size: 'xxl', align: 'center' },
        {
          type: 'text',
          text: approved ? '承認されました！' : '保留になりました',
          weight: 'bold', size: 'md', align: 'center', margin: 'md',
          color: approved ? '#065f46' : '#991b1b',
        },
        { type: 'text', text: itemName, size: 'sm', color: '#6b7280', align: 'center', margin: 'sm' },
        ...(comment ? [
          { type: 'separator', margin: 'lg' },
          {
            type: 'box', layout: 'vertical', margin: 'lg',
            backgroundColor: '#fffbeb', cornerRadius: 'md', paddingAll: '12px',
            contents: [
              { type: 'text', text: '💬 久保からのコメント', size: 'xxs', color: '#92400E', weight: 'bold' },
              { type: 'text', text: comment, size: 'sm', color: '#1f2937', wrap: true, margin: 'sm' },
            ],
          },
        ] : []),
      ],
      backgroundColor: approved ? '#ecfdf5' : '#fef2f2',
      paddingAll: '24px',
    },
  };
}
