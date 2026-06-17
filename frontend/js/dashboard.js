/* =====================================================================
   Study Sphere AI  -  dashboard.js
   ===================================================================== */

document.addEventListener('DOMContentLoaded', async () => {

  const user = SS.getUser();
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = (user.name || 'there').split(' ')[0];

  try {
    const s = await SS.api('/api/stats');
    renderStats(s);
    renderRecent(s.recent_chats || []);
    renderChart(s.daily_activity || []);
  } catch (err) {
    SS.toast(err.message, 'error');
  }
});

function renderStats(s) {
  const grid = document.getElementById('statsGrid');
  const cards = [
    { ic: 'fa-comments', n: s.total_chats, label: 'Total chats' },
    { ic: 'fa-message', n: s.total_messages, label: 'Messages sent' },
    { ic: 'fa-robot', n: s.ai_responses, label: 'AI responses' },
    { ic: 'fa-note-sticky', n: (s.notes || 0) + (s.quizzes || 0), label: 'Notes & quizzes' },
  ];
  grid.innerHTML = cards.map((c) => `
    <div class="stat-card glass">
      <div class="ic"><i class="fas ${c.ic}"></i></div>
      <b data-target="${c.n}">0</b>
      <span>${c.label}</span>
    </div>`).join('');

  // animate counts
  grid.querySelectorAll('b[data-target]').forEach((el) => {
    const target = parseInt(el.dataset.target, 10) || 0;
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 35));
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(t); }
      el.textContent = cur;
    }, 26);
  });
}

function renderRecent(chats) {
  const box = document.getElementById('recentChats');
  if (!chats.length) {
    box.innerHTML = `<div class="empty"><i class="fas fa-comment-dots"></i>No chats yet.<br><a href="/chat" style="color:var(--accent)">Start your first chat →</a></div>`;
    return;
  }
  box.innerHTML = chats.map((c) => `
    <a class="recent-item" href="/chat?id=${c.id}">
      <span class="ttl"><i class="fas fa-comment"></i> <b>${escapeHtml(c.title)}</b></span>
      <small>${formatDate(c.updated_at)}</small>
    </a>`).join('');
}

let chartRef = null;
function renderChart(activity) {
  const canvas = document.getElementById('activityChart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Build last-7-days axis even if some days have no data.
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

  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(109,123,255,0.55)');
  grad.addColorStop(1, 'rgba(109,123,255,0.02)');

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
        borderColor: '#6d7bff',
        borderWidth: 3,
        tension: 0.4,
        pointBackgroundColor: '#22d3ee',
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9aa3c7' } },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9aa3c7', precision: 0 } },
      },
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
