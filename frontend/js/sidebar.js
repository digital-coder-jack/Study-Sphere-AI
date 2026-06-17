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
    { id: 'mindmap', href: '/tools#mindmap', icon: 'fa-sitemap', label: 'Mindmap' },
    { section: 'Account' },
    { id: 'profile', href: '/profile', icon: 'fa-user-gear', label: 'Profile & Settings' },
  ];

  const navHtml = items.map((it) => {
    if (it.section) return `<div class="nav-section">${it.section}</div>`;
    const cls = it.id === active ? 'active' : '';
    return `<a class="${cls}" href="${it.href}"><i class="fas ${it.icon}"></i> ${it.label}</a>`;
  }).join('');

  aside.innerHTML = `
    <a class="brand" href="/dashboard"><span class="logo">🌌</span><span>Study<span class="grad-text">Sphere</span></span></a>
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
      <a class="side-nav" href="#" id="logoutBtn" style="display:flex;align-items:center;gap:.85rem;padding:.7rem .95rem;border-radius:12px;color:var(--danger);margin-top:.4rem;">
        <i class="fas fa-right-from-bracket"></i> Log out
      </a>
    </div>`;

  // Bind the theme toggle that was just injected (app.js initTheme runs on
  // DOMContentLoaded, before this sidebar HTML exists, so bind it here too).
  if (window.SS && SS.toggleTheme) {
    const tbtn = document.getElementById('themeToggle');
    if (tbtn && !tbtn.dataset.bound) {
      tbtn.dataset.bound = '1';
      tbtn.addEventListener('click', () => SS.toggleTheme());
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    SS.toast('Logged out. See you soon!');
    setTimeout(() => SS.logout(), 400);
  });

  // Mobile sidebar toggle.
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sideOverlay');
  if (toggle) {
    toggle.addEventListener('click', () => {
      aside.classList.toggle('open');
      if (overlay) overlay.classList.toggle('show');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      aside.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
