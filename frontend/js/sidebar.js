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
    { id: 'notes', href: '/tools#notes', icon: 'fa-note-sticky', label: 'Notes Generator' },
    { id: 'quiz', href: '/tools#quiz', icon: 'fa-circle-question', label: 'Quiz Generator' },
    { id: 'flashcards', href: '/tools#flashcards', icon: 'fa-layer-group', label: 'Flashcards' },
    { id: 'planner', href: '/tools#planner', icon: 'fa-calendar-days', label: 'Study Planner' },
    { id: 'summarizer', href: '/tools#summarizer', icon: 'fa-file-pdf', label: 'PDF Summarizer' },
    { id: 'homework', href: '/tools#homework', icon: 'fa-pen-to-square', label: 'Homework Helper' },
  ];

  // Add Analytics for admin (simulated check)
  if (user.id == 1 || user.is_admin) {
    items.push({ section: 'Admin' });
    items.push({ id: 'analytics', href: '/analytics', icon: 'fa-chart-pie', label: 'Analytics' });
  }

  const navHtml = items.map((it) => {
    if (it.section) return `<div class="nav-section">${it.section}</div>`;
    const cls = it.id === active ? 'active' : '';
    return `<a class="${cls}" href="${it.href}"><i class="fas ${it.icon}"></i> ${it.label}</a>`;
  }).join('');

  const isCollapsed = localStorage.getItem('ss_sidebar_collapsed') === 'true';
  if (isCollapsed) aside.classList.add('collapsed');

  aside.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;padding:0 .5rem;">
      <a class="brand" href="/dashboard" style="padding:0;margin:0;">
        <span class="logo"><img src="/assets/logo.png" alt="Logo" /></span>
        <span style="transition:opacity .2s;${isCollapsed ? 'opacity:0;width:0;pointer-events:none;' : ''}">Study<span class="grad-text">Sphere</span></span>
      </a>
      <button id="sidebarCollapse" class="btn ghost" style="padding:0;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;${window.innerWidth < 880 ? 'display:none;' : ''}">
        <i class="fas fa-chevron-${isCollapsed ? 'right' : 'left'}" style="font-size:.8rem;"></i>
      </button>
    </div>
    <nav class="side-nav">${navHtml}</nav>
    <div class="side-foot">
      <button class="theme-toggle side-theme" id="themeToggle" aria-label="Toggle theme" title="Toggle light / dark">
        <i class="fas fa-moon"></i><i class="fas fa-sun"></i>
        <span class="lbl">Theme</span>
      </button>
      <div class="side-user">
        <span class="avatar">${initial}</span>
        <div class="meta">
          <b>${escapeHtml(user.name || 'User')}</b>
          <span>${escapeHtml(user.email || '')}</span>
        </div>
      </div>

    </div>`;

  // Collapse logic
  const collBtn = document.getElementById('sidebarCollapse');
  if (collBtn) {
    collBtn.addEventListener('click', () => {
      const collapsed = aside.classList.toggle('collapsed');
      localStorage.setItem('ss_sidebar_collapsed', collapsed);
      const icon = collBtn.querySelector('i');
      icon.className = `fas fa-chevron-${collapsed ? 'right' : 'left'}`;
      
      const brandSpan = aside.querySelector('.brand span:not(.logo)');
      if (brandSpan) {
        brandSpan.style.opacity = collapsed ? '0' : '1';
        brandSpan.style.width = collapsed ? '0' : 'auto';
        brandSpan.style.pointerEvents = collapsed ? 'none' : 'auto';
      }
    });
  }

  // Bind the theme toggle that was just injected (app.js initTheme runs on
  // DOMContentLoaded, before this sidebar HTML exists, so bind it here too).
  if (window.SS && SS.toggleTheme) {
    const tbtn = document.getElementById('themeToggle');
    if (tbtn && !tbtn.dataset.bound) {
      tbtn.dataset.bound = '1';
      tbtn.addEventListener('click', () => SS.toggleTheme());
    }
  }



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

  // On mobile, tapping a nav link should close the drawer (it navigates anyway).
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
