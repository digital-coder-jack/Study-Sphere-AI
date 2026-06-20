/* =====================================================================
   Study Sphere AI  -  sidebar.js  (shared app navigation)
   Renders the sidebar into <aside id="sidebar" data-active="...">.
   ===================================================================== */

(function () {
  if (!SS.requireAuth()) return;

  const aside = document.getElementById('sidebar');
  if (!aside) return;
  const active = aside.dataset.active || '';
  const user = SS.getUser();
  const initial = (user.name || 'U').trim().charAt(0).toUpperCase();

  const items = [
    { id: 'dashboard', href: '/dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
    { id: 'chat', href: '/chat', icon: 'fa-comments', label: 'AI Chat' },
    { section: 'Study tools' },
    { id: 'notes', href: '/tools#notes', icon: 'fa-note-sticky', label: 'Notes' },
    { id: 'flashcards', href: '/tools#flashcards', icon: 'fa-layer-group', label: 'Flashcards' },
    { id: 'quiz', href: '/tools#quiz', icon: 'fa-circle-question', label: 'Quizzes' },
    { id: 'planner', href: '/tools#planner', icon: 'fa-calendar-days', label: 'Study Planner' },
    { id: 'uploads', href: '/tools#summarizer', icon: 'fa-file-arrow-up', label: 'File Uploads' },
    { section: 'Personal' },
    { id: 'analytics', href: '/analytics', icon: 'fa-chart-pie', label: 'Analytics' },
    { id: 'profile', href: '/profile', icon: 'fa-user', label: 'Profile' },
    { id: 'settings', href: '/profile#settings', icon: 'fa-gear', label: 'Settings' },
  ];

  const navHtml = items.map((it) => {
    if (it.section) return `<div class="nav-section">${it.section}</div>`;
    const cls = it.id === active ? 'active' : '';
    return `
      <a class="${cls}" href="${it.href}" title="${it.label}">
        <i class="fas ${it.icon}"></i> 
        <span>${it.label}</span>
      </a>`;
  }).join('');

  const isCollapsed = localStorage.getItem('ss_sidebar_collapsed') === 'true';
  if (isCollapsed) aside.classList.add('collapsed');

  aside.innerHTML = `
    <div class="side-head">
      <a class="brand" href="/dashboard">
        <span class="logo">🌌</span>
        <span class="brand-text">Study<span class="grad-text">Sphere</span></span>
      </a>
      <button id="sidebarCollapse" class="collapse-btn" aria-label="Toggle Sidebar">
        <i class="fas fa-chevron-${isCollapsed ? 'right' : 'left'}"></i>
      </button>
    </div>
    <nav class="side-nav">${navHtml}</nav>
    <div class="side-foot">
      <div class="side-user-wrap">
        <a href="/profile" class="side-user">
          <span class="avatar">${initial}</span>
          <div class="meta">
            <b>${escapeHtml(user.name || 'User')}</b>
            <span>${escapeHtml(user.username || user.email || '')}</span>
          </div>
        </a>
        <button class="logout-btn" id="logoutBtn" title="Logout">
          <i class="fas fa-right-from-bracket"></i>
        </button>
      </div>
    </div>`;

  // Add styles for enhanced sidebar
  if (!document.getElementById('sidebar-styles')) {
    const style = document.createElement('style');
    style.id = 'sidebar-styles';
    style.textContent = `
      /* ============ Cool sidebar (PC + mobile) ============ */

      /* Animated gradient sheen behind the whole sidebar */
      .sidebar { position: relative; overflow: hidden; isolation: isolate; }
      .sidebar::before {
        content: ''; position: absolute; inset: -40% -60% auto -60%; height: 60%;
        background: radial-gradient(60% 80% at 50% 0%, rgba(109,123,255,0.30), transparent 70%);
        filter: blur(28px); z-index: -1; pointer-events: none;
        animation: sideGlow 9s ease-in-out infinite alternate;
      }
      @keyframes sideGlow {
        0%   { transform: translateX(-10%) translateY(0);   opacity: 0.7; }
        100% { transform: translateX(12%)  translateY(6%);  opacity: 1;   }
      }

      .side-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.6rem; padding: 0.2rem 0.4rem 0.9rem; border-bottom: 1px solid var(--border); }
      .brand { display: flex; align-items: center; gap: 0.7rem; text-decoration: none; color: inherit; }
      .brand .logo {
        font-size: 1.4rem; line-height: 1; display: grid; place-items: center;
        width: 40px; height: 40px; border-radius: 13px; flex-shrink: 0;
        background: var(--grad); box-shadow: 0 8px 22px rgba(109,123,255,0.45);
        transition: transform 0.35s cubic-bezier(.34,1.56,.64,1);
      }
      .brand:hover .logo { transform: rotate(-8deg) scale(1.08); }
      .brand-text { font-weight: 800; font-size: 1.18rem; letter-spacing: -0.02em; transition: opacity 0.2s, width 0.2s; overflow: hidden; white-space: nowrap; }
      .grad-text {
        background: var(--grad); -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent; color: transparent;
      }
      .sidebar.collapsed .brand-text { opacity: 0; width: 0; pointer-events: none; }

      .collapse-btn {
        background: var(--glass); border: 1px solid var(--border); color: var(--text);
        width: 30px; height: 30px; border-radius: 10px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; font-size: 0.72rem;
        transition: all 0.25s ease;
      }
      .collapse-btn:hover { background: var(--glass-strong); border-color: var(--accent); color: var(--accent); transform: scale(1.08); }
      @media (max-width: 880px) { .collapse-btn { display: none; } }

      /* Nav links: animated gradient active bar + icon pop */
      .side-nav a { position: relative; overflow: hidden; }
      .side-nav a i { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1); }
      .side-nav a:hover i { transform: scale(1.18) rotate(-4deg); }
      .side-nav a::before {
        content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%) scaleY(0);
        width: 4px; height: 55%; border-radius: 0 4px 4px 0;
        background: var(--grad); transition: transform 0.28s ease; z-index: 1;
      }
      .side-nav a:hover:not(.active)::before { transform: translateY(-50%) scaleY(1); }
      .side-nav a.active { box-shadow: 0 8px 22px rgba(109,123,255,0.45); }
      .side-nav a.active i { animation: navPop 0.4s ease; }
      @keyframes navPop { 0% { transform: scale(0.7); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }
      .side-nav a span { transition: opacity 0.2s; }
      .sidebar.collapsed .side-nav a span { opacity: 0; width: 0; display: none; }
      .sidebar.collapsed .nav-section { opacity: 0; height: 0; margin: 0; padding: 0; overflow: hidden; }

      /* Footer user card */
      .side-user-wrap {
        display: flex; align-items: center; gap: 0.5rem;
        background: var(--glass); padding: 0.55rem; border-radius: 16px;
        border: 1px solid var(--border); transition: border-color 0.25s, background 0.25s;
      }
      .side-user-wrap:hover { border-color: rgba(109,123,255,0.45); background: var(--glass-strong); }
      .sidebar.collapsed .side-user-wrap { padding: 0.4rem; justify-content: center; }
      .side-user { display: flex; align-items: center; gap: 0.8rem; text-decoration: none; color: inherit; flex: 1; overflow: hidden; }
      .side-user .avatar {
        position: relative; transition: transform 0.3s cubic-bezier(.34,1.56,.64,1);
        box-shadow: 0 6px 16px rgba(109,123,255,0.4);
      }
      .side-user-wrap:hover .avatar { transform: scale(1.06); }
      /* tiny online dot */
      .side-user .avatar::after {
        content: ''; position: absolute; right: -2px; bottom: -2px;
        width: 11px; height: 11px; border-radius: 50%;
        background: var(--success); border: 2px solid var(--bg-1);
      }
      .sidebar.collapsed .side-user .meta { display: none; }

      .logout-btn {
        background: transparent; border: none; color: var(--text-dim);
        cursor: pointer; padding: 0.55rem; border-radius: 10px; transition: all 0.25s;
      }
      .logout-btn:hover { color: #fff; background: var(--danger); transform: rotate(8deg) scale(1.05); }
      .sidebar.collapsed .logout-btn { display: none; }

      /* Tooltips for collapsed mode */
      .sidebar.collapsed .side-nav a { position: relative; }
      .sidebar.collapsed .side-nav a:hover::after {
        content: attr(title);
        position: absolute;
        left: calc(100% + 15px);
        top: 50%;
        transform: translateY(-50%);
        background: var(--glass-strong);
        color: var(--text);
        padding: 0.5rem 0.8rem;
        border-radius: 8px;
        font-size: 0.8rem;
        white-space: nowrap;
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
        z-index: 1000;
        pointer-events: none;
      }

      /* ============ Mobile drawer polish ============ */
      @media (max-width: 880px) {
        .sidebar {
          border-right: none;
          border-radius: 0 22px 22px 0;
          box-shadow: 18px 0 60px rgba(0,0,0,0.55);
          padding-top: 1.2rem;
        }
        /* stagger nav items in when the drawer opens */
        .sidebar .side-nav a, .sidebar .side-nav .nav-section { opacity: 0; transform: translateX(-14px); }
        .sidebar.open .side-nav a, .sidebar.open .side-nav .nav-section {
          opacity: 1; transform: translateX(0);
          transition: opacity 0.32s ease, transform 0.32s ease;
        }
        .sidebar.open .side-nav > *:nth-child(1)  { transition-delay: 0.04s; }
        .sidebar.open .side-nav > *:nth-child(2)  { transition-delay: 0.07s; }
        .sidebar.open .side-nav > *:nth-child(3)  { transition-delay: 0.10s; }
        .sidebar.open .side-nav > *:nth-child(4)  { transition-delay: 0.13s; }
        .sidebar.open .side-nav > *:nth-child(5)  { transition-delay: 0.16s; }
        .sidebar.open .side-nav > *:nth-child(6)  { transition-delay: 0.19s; }
        .sidebar.open .side-nav > *:nth-child(7)  { transition-delay: 0.22s; }
        .sidebar.open .side-nav > *:nth-child(8)  { transition-delay: 0.25s; }
        .sidebar.open .side-nav > *:nth-child(9)  { transition-delay: 0.28s; }
        .sidebar.open .side-nav > *:nth-child(10) { transition-delay: 0.31s; }
        .sidebar.open .side-nav > *:nth-child(n+11){ transition-delay: 0.34s; }
        /* bigger tap targets on touch */
        .side-nav a { padding: 0.95rem 1rem; }
      }

      /* smoother overlay fade */
      .side-overlay {
        background: rgba(3,5,16,0.6);
        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
        opacity: 0; transition: opacity 0.3s ease;
      }
      .side-overlay.show { opacity: 1; }

      @media (prefers-reduced-motion: reduce) {
        .sidebar::before { animation: none; }
        .side-nav a.active i { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // Collapse logic
  const collBtn = document.getElementById('sidebarCollapse');
  if (collBtn) {
    collBtn.addEventListener('click', () => {
      const collapsed = aside.classList.toggle('collapsed');
      localStorage.setItem('ss_sidebar_collapsed', collapsed);
      const icon = collBtn.querySelector('i');
      icon.className = `fas fa-chevron-${collapsed ? 'right' : 'left'}`;
    });
  }

  // Logout logic
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to log out?')) {
      SS.clearSession();
      window.location.href = '/';
    }
  });

  // Mobile sidebar toggle.
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sideOverlay');
  
  const openSidebar = () => {
    aside.classList.add('open');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  };
  
  const closeSidebar = () => {
    aside.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  };
	
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      aside.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }
  
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Nav link handling.
  aside.querySelectorAll('.side-nav a').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href') || '';
      const hashIdx = href.indexOf('#');

      // Same-page hash links (e.g. /tools#flashcards while already on /tools):
      // the browser won't fire hashchange if the hash is unchanged, so we
      // dispatch it manually to switch the tab. This is what was broken on
      // mobile — the drawer closed but the tool panel never changed.
      if (hashIdx > -1) {
        const targetPath = href.slice(0, hashIdx) || window.location.pathname;
        const targetHash = href.slice(hashIdx); // includes '#'
        if (targetPath === window.location.pathname) {
          e.preventDefault();
          if (window.location.hash === targetHash) {
            // Hash unchanged → fire a synthetic event so listeners react.
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } else {
            window.location.hash = targetHash;
          }
        }
      }

      if (window.innerWidth <= 880) closeSidebar();
    });
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aside.classList.contains('open')) closeSidebar();
  });

  // Close on resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 880 && aside.classList.contains('open')) closeSidebar();
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
