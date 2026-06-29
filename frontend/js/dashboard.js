/* =====================================================================
   Study Sphere AI  -  dashboard.js  (2026 Premium Redesign)
   Populates the redesigned dashboard from the existing /api/stats data.
   No backend changes — all new widgets are derived client-side.
   ===================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const user = SS.getUser();
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = (user.name || 'there').split(' ')[0];

  // Time-aware subtitle
  const subEl = document.getElementById('dashSubtitle');
  if (subEl) {
    const h = new Date().getHours();
    const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    subEl.textContent = `Good ${part} — here's your learning activity at a glance.`;
  }

  // Guest banner
  if (user.is_guest) showGuestBanner();

  try {
    const s = await SS.api('/api/stats');
    renderStats(s);
    renderRecent(s.recent_chats || []);
    renderChart(s.daily_activity || []);
    renderProgress(s);
    renderAiUsage(s);
    renderAchievements(s);
  } catch (err) {
    SS.toast(err.message, 'error');
  }

  loadProvidersMini();
});

/* ---------- Stats ---------- */
function renderStats(s) {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;
  const cards = [
    { ic: 'fa-comments', n: s.total_chats || 0, label: 'Total chats', trend: '+' + (s.total_chats || 0) },
    { ic: 'fa-message', n: s.total_messages || 0, label: 'Messages sent' },
    { ic: 'fa-robot', n: s.ai_responses || 0, label: 'AI responses' },
    { ic: 'fa-note-sticky', n: (s.notes || 0) + (s.quizzes || 0), label: 'Notes & quizzes' },
  ];
  grid.innerHTML = cards.map((c) => `
    <div class="stat-card glass">
      <div class="ic"><i class="fas ${c.ic}"></i></div>
      <b data-count="${c.n}">0</b>
      <span>${c.label}</span>
    </div>`).join('');
  grid.classList.add('in-view');
  if (window.SSMotion) SSMotion.refresh();
}

/* ---------- Recent chats ---------- */
function renderRecent(chats) {
  const box = document.getElementById('recentChats');
  if (!box) return;
  if (!chats.length) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-comment-dots"></i></div>
        <h4>No chats yet</h4>
        <p>Start your first conversation with the AI tutor.</p>
        <a href="/chat" class="btn small"><i class="fas fa-plus"></i> New chat</a>
      </div>`;
    return;
  }
  box.innerHTML = chats.map((c) => `
    <a class="recent-item" href="/chat?id=${c.id}">
      <span class="ttl"><i class="fas fa-comment"></i> <b>${escapeHtml(c.title)}</b></span>
      <small>${formatDate(c.updated_at)}</small>
    </a>`).join('');
}

/* ---------- Study progress (derived) ---------- */
function renderProgress(s) {
  const activity = s.daily_activity || [];
  const map = {};
  activity.forEach((a) => (map[a.day] = a.count));
  let weekMsgs = 0;
  let streak = 0;
  let streakBroken = false;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cnt = map[key] || 0;
    weekMsgs += cnt;
    if (cnt > 0 && !streakBroken) streak++;
    else if (cnt === 0 && i > 0) streakBroken = true;
  }

  // Weekly goal heuristic: 50 messages/week = 100%
  const goal = 50;
  const pct = Math.min(100, Math.round((weekMsgs / goal) * 100));

  const ring = document.getElementById('progressRing');
  const pctEl = document.getElementById('progressPct');
  if (ring) setTimeout(() => { ring.style.setProperty('--p', pct); }, 300);
  if (pctEl) { pctEl.dataset.count = pct; }

  const streakEl = document.getElementById('streakVal');
  const weekEl = document.getElementById('weekMsgs');
  if (streakEl) streakEl.textContent = streak + (streak === 1 ? ' day' : ' days');
  if (weekEl) weekEl.textContent = weekMsgs + (weekMsgs === 1 ? ' msg' : ' msgs');
  if (window.SSMotion) SSMotion.refresh();
}

/* ---------- AI usage ---------- */
function renderAiUsage(s) {
  const responses = s.ai_responses || 0;
  const total = Math.max(responses, s.total_messages || 0, 1);
  const pct = Math.min(100, Math.round((responses / total) * 100));
  const bar = document.getElementById('aiResponsesBar');
  const num = document.getElementById('aiResponses');
  if (num) { num.dataset.count = responses; num.textContent = '0'; }
  if (bar) setTimeout(() => { bar.style.width = pct + '%'; }, 350);
  if (window.SSMotion) SSMotion.refresh();
}

async function loadProvidersMini() {
  const box = document.getElementById('aiProvidersMini');
  if (!box) return;
  try {
    const data = await SS.api('/api/ai/status', { auth: false });
    box.innerHTML = (data.providers || []).map((p) =>
      `<span class="model-badge" title="${p.label}">` +
      `<span class="model-dot ${p.configured ? '' : 'off'}"></span>` +
      `${p.label}${p.configured ? '' : ' (offline)'}</span>`
    ).join(' ');
    if (!box.innerHTML) box.innerHTML = '<span class="model-badge">No providers</span>';
  } catch {
    box.innerHTML = '<span class="model-badge"><span class="model-dot off"></span> Status unavailable</span>';
  }
}

/* ---------- Achievements (derived from stats) ---------- */
function renderAchievements(s) {
  const box = document.getElementById('achievements');
  if (!box) return;
  const chats = s.total_chats || 0;
  const msgs = s.total_messages || 0;
  const notes = (s.notes || 0) + (s.quizzes || 0);
  const ach = [
    { ic: 'fa-rocket', title: 'First steps', desc: 'Start your first chat', done: chats >= 1 },
    { ic: 'fa-comments', title: 'Conversationalist', desc: 'Send 25 messages', done: msgs >= 25 },
    { ic: 'fa-note-sticky', title: 'Note taker', desc: 'Create 5 notes/quizzes', done: notes >= 5 },
    { ic: 'fa-fire', title: 'On a roll', desc: 'Reach 100 messages', done: msgs >= 100 },
  ];
  box.innerHTML = ach.map((a) => `
    <div class="ach-card glass ${a.done ? 'unlocked' : 'locked'}">
      <span class="ach-ic"><i class="fas ${a.done ? a.ic : 'fa-lock'}"></i></span>
      <div><b>${a.title}</b><span>${a.desc}</span></div>
    </div>`).join('');
  box.classList.add('in-view');
  if (window.SSMotion) SSMotion.refresh();
}

/* ---------- Chart ---------- */
let chartRef = null;
function renderChart(activity) {
  const canvas = document.getElementById('activityChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const days = [];
  const counts = [];
  const map = {};
  activity.forEach((a) => (map[a.day] = a.count));
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
    counts.push(map[key] || 0);
  }

  const styles = getComputedStyle(document.documentElement);
  const accent = (styles.getPropertyValue('--accent') || '#7c83ff').trim();
  const textDim = (styles.getPropertyValue('--text-dim') || '#9aa3c7').trim();

  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, hexish(accent, 0.45));
  grad.addColorStop(1, hexish(accent, 0.01));

  if (chartRef) chartRef.destroy();
  chartRef = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: 'Messages',
        data: counts,
        fill: true,
        backgroundColor: grad,
        borderColor: accent,
        borderWidth: 3,
        tension: 0.42,
        pointBackgroundColor: accent,
        pointBorderColor: 'transparent',
        pointRadius: 4,
        pointHoverRadius: 7,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(14,16,32,0.92)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: textDim } },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: textDim, precision: 0 } },
      },
    },
  });
}

/* Convert an hsl()/hex accent to an rgba-ish string with alpha for the gradient */
function hexish(color, alpha) {
  if (color.startsWith('hsl')) {
    return color.replace(')', ` / ${alpha})`).replace('hsl(', 'hsl(');
  }
  // hex fallback
  const c = color.replace('#', '');
  if (c.length === 6) {
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

/* ---------- Guest banner ---------- */
function showGuestBanner() {
  const banner = document.createElement('div');
  banner.className = 'guest-banner glass';
  banner.innerHTML = `
    <div class="guest-banner-content">
      <div class="guest-banner-text">
        <i class="fas fa-user-secret"></i>
        <div>
          <strong>You're in Guest Mode</strong>
          <p>Your data is temporary. Create an account to save your chats and notes permanently.</p>
        </div>
      </div>
      <a href="/signup" class="btn small primary"><i class="fas fa-user-plus"></i> Create account</a>
    </div>`;
  const content = document.querySelector('.content');
  const topbar = content ? content.querySelector('.topbar') : null;
  if (content && topbar) content.insertBefore(banner, topbar.nextSibling);

  if (!document.getElementById('guest-banner-styles')) {
    const style = document.createElement('style');
    style.id = 'guest-banner-styles';
    style.textContent = `
      .guest-banner { margin: 0 0 1.5rem; padding: 1rem 1.4rem; animation: slideDown .4s ease; }
      .guest-banner-content { display:flex; align-items:center; justify-content:space-between; gap:1.5rem; flex-wrap:wrap; }
      .guest-banner-text { display:flex; align-items:center; gap:1rem; flex:1; }
      .guest-banner-text i { font-size:1.4rem; color:var(--accent); }
      .guest-banner-text strong { display:block; font-size:1rem; margin-bottom:.15rem; }
      .guest-banner-text p { font-size:.85rem; color:var(--text-dim); margin:0; }
      @media (max-width:600px){ .guest-banner-content{ flex-direction:column; align-items:stretch; } }
    `;
    document.head.appendChild(style);
  }
}

/* ---------- Utils ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
