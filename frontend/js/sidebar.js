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
      .side-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding: 0 0.5rem; }
      .brand { display: flex; align-items: center; gap: 0.8rem; text-decoration: none; color: inherit; }
      .brand .logo { font-size: 1.5rem; }
      .brand-text { font-weight: 700; font-size: 1.2rem; transition: opacity 0.2s, width 0.2s; overflow: hidden; white-space: nowrap; }
      .sidebar.collapsed .brand-text { opacity: 0; width: 0; pointer-events: none; }
      
      .collapse-btn { 
        background: var(--glass); border: 1px solid var(--border); color: var(--text); 
        width: 28px; height: 28px; border-radius: 8px; cursor: pointer; 
        display: flex; align-items: center; justify-content: center; font-size: 0.7rem;
        transition: all 0.2s;
      }
      .collapse-btn:hover { background: var(--glass-strong); border-color: var(--accent); }
      @media (max-width: 880px) { .collapse-btn { display: none; } }

      .side-nav a span { transition: opacity 0.2s; }
      .sidebar.collapsed .side-nav a span { opacity: 0; width: 0; display: none; }
      .sidebar.collapsed .nav-section { opacity: 0; height: 0; margin: 0; padding: 0; overflow: hidden; }

      .side-user-wrap { display: flex; align-items: center; gap: 0.5rem; background: var(--glass); padding: 0.5rem; border-radius: 16px; border: 1px solid var(--border); }
      .sidebar.collapsed .side-user-wrap { padding: 0.4rem; justify-content: center; }
      .side-user { display: flex; align-items: center; gap: 0.8rem; text-decoration: none; color: inherit; flex: 1; overflow: hidden; }
      .sidebar.collapsed .side-user .meta { display: none; }
      
      .logout-btn { 
        background: transparent; border: none; color: var(--text-dim); 
        cursor: pointer; padding: 0.5rem; border-radius: 8px; transition: all 0.2s;
      }
      .logout-btn:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
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

  // On mobile, tapping a nav link should close the drawer
  aside.querySelectorAll('.side-nav a').forEach((link) => {
    link.addEventListener('click', () => {
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
