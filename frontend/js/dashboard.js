/* =====================================================================
   AI Notebook  -  dashboard.js
   ===================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const user = SS.getUser();
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = (user.name || 'there').split(' ')[0];

  // Show guest banner if user is a guest
  if (user.is_guest) {
    const banner = document.createElement('div');
    banner.className = 'guest-banner glass';
    banner.innerHTML = `
      <div class="guest-banner-content">
        <div class="guest-banner-text">
          <i class="fas fa-user-secret"></i>
          <div>
            <strong>You're in Guest Mode!</strong>
            <p>Your data is temporary. Create an account to save your chats and notes permanently.</p>
          </div>
        </div>
        <a href="/signup" class="btn small primary"><i class="fas fa-user-plus"></i> Create Account</a>
      </div>
    `;
    
    // Insert banner right AFTER the topbar so it sits at the top of the
    // scrollable content (not hidden behind the fixed mobile topbar).
    const content = document.querySelector('.content');
    const topbar = content ? content.querySelector('.topbar') : null;
    if (content) {
      if (topbar && topbar.nextSibling) {
        content.insertBefore(banner, topbar.nextSibling);
      } else if (topbar) {
        content.appendChild(banner);
      } else {
        content.insertBefore(banner, content.firstChild);
      }
    }
    
    // Add styles for the banner
    if (!document.getElementById('guest-banner-styles')) {
      const style = document.createElement('style');
      style.id = 'guest-banner-styles';
      style.textContent = `
        .guest-banner {
          margin-bottom: 1.5rem;
          padding: 1rem 1.5rem;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: linear-gradient(90deg, rgba(109, 123, 255, 0.1), rgba(34, 211, 238, 0.1));
          backdrop-filter: blur(12px);
          animation: slideDown 0.4s ease;
        }
        .guest-banner-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .guest-banner-text {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }
        .guest-banner-text i {
          font-size: 1.5rem;
          color: var(--accent);
        }
        .guest-banner-text strong {
          display: block;
          font-size: 1.05rem;
          margin-bottom: 0.2rem;
        }
        .guest-banner-text p {
          font-size: 0.85rem;
          color: var(--text-dim);
          margin: 0;
        }
        @media (max-width: 600px) {
          .guest-banner-content { flex-direction: column; align-items: stretch; gap: 1rem; }
          .guest-banner-text i { font-size: 1.2rem; }
          .guest-banner { padding: 1rem; }
        }
      `;
      document.head.appendChild(style);
    }
  }

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
