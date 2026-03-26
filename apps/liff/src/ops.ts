/**
 * LIFF Ops Page — Checkbox-based task/order reporting
 *
 * URL: ?page=ops&mode=task&cat=clean
 * URL: ?page=ops&mode=order
 *
 * Opens inside LINE app as overlay. User taps checkboxes, hits submit.
 * Submits to POST /api/ops/report, then closes back to chat.
 */

declare const liff: {
  init(config: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(opts?: { redirectUri?: string }): void;
  getProfile(): Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
  isInClient(): boolean;
  closeWindow(): void;
};

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8787';

interface SubItem {
  key: string;
  label: string;
}

interface Category {
  label: string;
  emoji: string;
  color: string;
  items: SubItem[];
}

const CATEGORIES: Record<string, Category> = {
  tidy: {
    label: '整理・片付け', emoji: '📦', color: '#3B82F6',
    items: [
      { key: 'desk', label: 'デスク周り' },
      { key: 'shelf', label: '本棚・ラック' },
      { key: 'kitchen', label: 'キッチン周り' },
      { key: 'meeting', label: '会議スペース' },
      { key: 'other', label: 'その他' },
    ],
  },
  clean: {
    label: '掃除', emoji: '🧹', color: '#10B981',
    items: [
      { key: 'table', label: 'テーブル拭き' },
      { key: 'floor', label: '床掃除' },
      { key: 'toilet', label: 'トイレ' },
      { key: 'trash', label: 'ゴミ捨て' },
      { key: 'window', label: '窓・ガラス' },
      { key: 'other', label: 'その他' },
    ],
  },
  restock: {
    label: '補充', emoji: '🧴', color: '#F59E0B',
    items: [
      { key: 'paper', label: 'コピー用紙' },
      { key: 'tp', label: 'トイレットペーパー' },
      { key: 'soap', label: 'ソープ・洗剤' },
      { key: 'drink', label: 'コーヒー・お茶' },
      { key: 'bag', label: 'ゴミ袋' },
      { key: 'other', label: 'その他' },
    ],
  },
  parcel: {
    label: '荷物対応', emoji: '📮', color: '#EF4444',
    items: [
      { key: 'receive', label: '宅配便受け取り' },
      { key: 'sort', label: '郵便物の仕分け' },
      { key: 'notify', label: '届け先に連絡済み' },
      { key: 'other', label: 'その他' },
    ],
  },
};

const ORDER_ITEMS: SubItem[] = [
  { key: 'paper', label: 'コピー用紙' },
  { key: 'tp', label: 'トイレットペーパー' },
  { key: 'soap', label: 'ソープ・洗剤' },
  { key: 'drink', label: 'コーヒー・お茶' },
  { key: 'bag', label: 'ゴミ袋' },
  { key: 'tissue', label: 'ティッシュ' },
  { key: 'towel', label: 'ペーパータオル' },
];

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export async function initOps() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || 'task'; // task or order
  const catKey = params.get('cat') || '';

  const profile = await liff.getProfile();
  const app = document.getElementById('app')!;

  if (mode === 'task') {
    renderTaskPage(app, profile, catKey);
  } else {
    renderOrderPage(app, profile);
  }
}

function renderTaskPage(
  app: HTMLElement,
  profile: { userId: string; displayName: string },
  catKey: string,
) {
  // No category selected → show category picker
  if (!catKey || !CATEGORIES[catKey]) {
    renderCategoryPicker(app, profile);
    return;
  }

  const cat = CATEGORIES[catKey];
  const selected = new Set<string>();

  function render() {
    const count = selected.size;
    app.innerHTML = `
      <div class="ops-page">
        <div class="ops-header" style="border-left: 4px solid ${cat.color}">
          <span class="ops-emoji">${cat.emoji}</span>
          <div>
            <div class="ops-title">${cat.label}</div>
            <div class="ops-sub">やったところを選んでね</div>
          </div>
        </div>
        <div class="ops-list">
          ${cat.items.map(item => `
            <label class="ops-item ${selected.has(item.key) ? 'checked' : ''}" data-key="${item.key}">
              <div class="ops-checkbox" style="${selected.has(item.key) ? `background:${cat.color};border-color:${cat.color}` : ''}">
                ${selected.has(item.key) ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </div>
              <span>${escapeHtml(item.label)}</span>
            </label>
          `).join('')}
        </div>
        <button class="ops-submit ${count > 0 ? 'active' : ''}" id="submitBtn">
          ${count > 0 ? `${count}件を報告する ✓` : '選択してください'}
        </button>
      </div>
    `;

    // Bind click events
    app.querySelectorAll('.ops-item').forEach(el => {
      el.addEventListener('click', () => {
        const key = (el as HTMLElement).dataset.key!;
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        render();
      });
    });

    const btn = document.getElementById('submitBtn')!;
    if (count > 0) {
      btn.addEventListener('click', () => submitTask(app, profile, catKey, Array.from(selected)));
    }
  }

  render();
}

function renderCategoryPicker(
  app: HTMLElement,
  profile: { userId: string; displayName: string },
) {
  app.innerHTML = `
    <div class="ops-page">
      <div class="ops-header">
        <span class="ops-emoji">☕</span>
        <div>
          <div class="ops-title">おつかれさまです！</div>
          <div class="ops-sub">何を対応しましたか？</div>
        </div>
      </div>
      <div class="ops-categories">
        ${Object.entries(CATEGORIES).map(([key, c]) => `
          <button class="ops-cat-btn" data-cat="${key}" style="border-left: 3px solid ${c.color}">
            <span>${c.emoji}</span>
            <span>${c.label}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  app.querySelectorAll('.ops-cat-btn').forEach(el => {
    el.addEventListener('click', () => {
      const key = (el as HTMLElement).dataset.cat!;
      renderTaskPage(app, profile, key);
    });
  });
}

function renderOrderPage(
  app: HTMLElement,
  profile: { userId: string; displayName: string },
) {
  const selected = new Set<string>();
  let customItem = '';
  let urgency = 'low';

  function render() {
    const count = selected.size + (customItem.trim() ? 1 : 0);
    app.innerHTML = `
      <div class="ops-page">
        <div class="ops-header" style="border-left: 4px solid #3B82F6">
          <span class="ops-emoji">📦</span>
          <div>
            <div class="ops-title">発注依頼</div>
            <div class="ops-sub">必要なものを選んでください</div>
          </div>
        </div>
        <div class="ops-list">
          ${ORDER_ITEMS.map(item => `
            <label class="ops-item ${selected.has(item.key) ? 'checked' : ''}" data-key="${item.key}">
              <div class="ops-checkbox" style="${selected.has(item.key) ? 'background:#3B82F6;border-color:#3B82F6' : ''}">
                ${selected.has(item.key) ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </div>
              <span>${escapeHtml(item.label)}</span>
            </label>
          `).join('')}
          <div class="ops-custom">
            <input type="text" id="customInput" placeholder="その他（品名を入力）" value="${escapeHtml(customItem)}" />
          </div>
        </div>
        <div class="ops-urgency">
          <div class="ops-sub" style="margin-bottom:8px">緊急度</div>
          <div class="ops-urgency-btns">
            <button class="urg-btn ${urgency === 'low' ? 'active' : ''}" data-urg="low">🟢 急ぎでない</button>
            <button class="urg-btn ${urgency === 'mid' ? 'active' : ''}" data-urg="mid">📙 今週中</button>
            <button class="urg-btn ${urgency === 'high' ? 'active' : ''}" data-urg="high">🔴 至急</button>
          </div>
        </div>
        <button class="ops-submit ${count > 0 ? 'active' : ''}" id="submitBtn">
          ${count > 0 ? `${count}件を発注依頼する` : '品目を選んでください'}
        </button>
      </div>
    `;

    // Bind events
    app.querySelectorAll('.ops-item').forEach(el => {
      el.addEventListener('click', () => {
        const key = (el as HTMLElement).dataset.key!;
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        render();
      });
    });

    document.getElementById('customInput')?.addEventListener('input', (e) => {
      customItem = (e.target as HTMLInputElement).value;
      // Don't re-render, just update submit button text
      const btn = document.getElementById('submitBtn');
      const newCount = selected.size + (customItem.trim() ? 1 : 0);
      if (btn) {
        btn.className = `ops-submit ${newCount > 0 ? 'active' : ''}`;
        btn.textContent = newCount > 0 ? `${newCount}件を発注依頼する` : '品目を選んでください';
      }
    });

    app.querySelectorAll('.urg-btn').forEach(el => {
      el.addEventListener('click', () => {
        urgency = (el as HTMLElement).dataset.urg!;
        render();
      });
    });

    const btn = document.getElementById('submitBtn')!;
    const finalCount = selected.size + (customItem.trim() ? 1 : 0);
    if (finalCount > 0) {
      btn.addEventListener('click', () => {
        const items = Array.from(selected).map(k => ORDER_ITEMS.find(i => i.key === k)?.label || k);
        if (customItem.trim()) items.push(customItem.trim());
        submitOrder(app, profile, items, urgency);
      });
    }
  }

  render();
}

async function submitTask(
  app: HTMLElement,
  profile: { userId: string; displayName: string },
  catKey: string,
  subKeys: string[],
) {
  app.innerHTML = '<div class="ops-loading"><div class="spinner"></div>送信中...</div>';

  try {
    const res = await fetch(`${API_URL}/api/ops/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineUserId: profile.userId,
        type: 'task',
        category: catKey,
        subItems: subKeys,
      }),
    });
    const data = await res.json() as { success: boolean };

    if (data.success) {
      const cat = CATEGORIES[catKey];
      const labels = subKeys.map(k => cat?.items.find(i => i.key === k)?.label || k);
      app.innerHTML = `
        <div class="ops-done">
          <div class="ops-done-icon">✨</div>
          <div class="ops-done-title">${subKeys.length}件の対応ありがとう！</div>
          <div class="ops-done-tags">
            ${labels.map(l => `<span class="ops-tag">${escapeHtml(l)}</span>`).join('')}
          </div>
          <div class="ops-done-sub">${cat?.emoji || ''} ${cat?.label || ''}カテゴリで記録しました 🙏</div>
        </div>
      `;
    } else {
      app.innerHTML = '<div class="ops-done"><div class="ops-done-icon">❌</div><div class="ops-done-title">エラーが発生しました</div></div>';
    }
  } catch (err) {
    app.innerHTML = '<div class="ops-done"><div class="ops-done-icon">❌</div><div class="ops-done-title">通信エラー</div></div>';
  }

  // Auto-close after 2s
  setTimeout(() => {
    if (liff.isInClient()) liff.closeWindow();
  }, 2000);
}

async function submitOrder(
  app: HTMLElement,
  profile: { userId: string; displayName: string },
  items: string[],
  urgency: string,
) {
  app.innerHTML = '<div class="ops-loading"><div class="spinner"></div>送信中...</div>';

  try {
    const res = await fetch(`${API_URL}/api/ops/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineUserId: profile.userId,
        type: 'order',
        items,
        urgency,
      }),
    });
    const data = await res.json() as { success: boolean };

    if (data.success) {
      app.innerHTML = `
        <div class="ops-done">
          <div class="ops-done-icon">📦</div>
          <div class="ops-done-title">発注依頼を送りました！</div>
          <div class="ops-done-tags">
            ${items.map(l => `<span class="ops-tag">${escapeHtml(l)}</span>`).join('')}
          </div>
          <div class="ops-done-sub">⏳ 承認待ち</div>
        </div>
      `;
    } else {
      app.innerHTML = '<div class="ops-done"><div class="ops-done-icon">❌</div><div class="ops-done-title">エラーが発生しました</div></div>';
    }
  } catch (err) {
    app.innerHTML = '<div class="ops-done"><div class="ops-done-icon">❌</div><div class="ops-done-title">通信エラー</div></div>';
  }

  setTimeout(() => {
    if (liff.isInClient()) liff.closeWindow();
  }, 2000);
}
