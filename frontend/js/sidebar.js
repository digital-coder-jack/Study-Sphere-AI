/* =====================================================================
   AI Notebook  -  sidebar.js  (modern AI workspace navigation)

   A clean, single-source sidebar renderer that powers every authenticated
   page. Built for a modern AI-workspace experience inspired by Notion,
   ChatGPT, Discord and Linear.

   Features
   - Modern AI workspace nav (New Chat, AI Models, History, Notes, Projects,
     Saved Prompts, Files, Analytics, Settings)
   - Collapsible (desktop) with persisted state
   - Mobile-responsive off-canvas drawer with backdrop
   - Smooth, hardware-accelerated animations
   - Glassmorphism styling (driven by /css/sidebar-mobile.css)
   - Dark / light mode toggle
   - Active item highlighting
   - User profile section pinned to the bottom
   - Full keyboard navigation + ARIA accessibility

   Styling lives in /css/sidebar-mobile.css (single source of truth).
   ===================================================================== */

(function () {
  'use strict';

  const aside = document.getElementById('sidebar');
  if (!aside) return;

  /* --------------------------------------------------------------------
     GUEST MODE: always render the sidebar and wire interactions first,
     then kick off guest login in the background. When a token arrives we
     re-render only the user footer in place — no reload required.
     -------------------------------------------------------------------- */
  if (!SS.isAuthed()) {
    SS.api('/api/auth/guest', { method: 'POST', auth: false })
      .then((data) => {
        if (data && data.token) {
          SS.setSession(data.token, data.user);
          renderUserFooter(SS.getUser());
        }
      })
      .catch((err) => console.warn('Guest login pending:', err && err.message));
  }

  const active = aside.dataset.active || '';
  const user = SS.getUser();

  /* ========== NAVIGATION ITEMS (modern AI workspace) ========== */
  const items = [
    { id: 'chat', href: '/chat', icon: 'fa-pen-to-square', label: 'New Chat', primary: true },
    { section: 'Workspace' },
    { id: 'models', href: '/chat#models', icon: 'fa-microchip', label: 'AI Models' },
    { id: 'history', href: '/dashboard#history', icon: 'fa-clock-rotate-left', label: 'History' },
    { id: 'notes', href: '/tools#notes', icon: 'fa-note-sticky', label: 'Notes' },
    { id: 'projects', href: '/tools#planner', icon: 'fa-diagram-project', label: 'Projects' },
    { id: 'prompts', href: '/tools#flashcards', icon: 'fa-lightbulb', label: 'Saved Prompts' },
    { id: 'files', href: '/tools#summarizer', icon: 'fa-folder-open', label: 'Files' },
    { section: 'Insights' },
    { id: 'analytics', href: '/analytics', icon: 'fa-chart-pie', label: 'Analytics' },
    { id: 'settings', href: '/settings', icon: 'fa-gear', label: 'Settings' },
  ];

  /* ========== RENDER NAVIGATION HTML ========== */
  const navHtml = items.map((it) => {
    if (it.section) {
      return `<div class="nav-section" role="separator">${escapeHtml(it.section)}</div>`;
    }
    const classes = [
      it.id === active ? 'active' : '',
      it.primary ? 'nav-primary' : '',
    ].filter(Boolean).join(' ');
    return `
      <a class="${classes}" href="${escapeHtml(it.href)}" title="${escapeHtml(it.label)}"
         role="menuitem" aria-label="${escapeHtml(it.label)}">
        <i class="fas ${escapeHtml(it.icon)}" aria-hidden="true"></i>
        <span>${escapeHtml(it.label)}</span>
      </a>`;
  }).join('');

  /* ========== RESTORE COLLAPSED STATE ========== */
  const isCollapsed = localStorage.getItem('ainb_sidebar_collapsed') === 'true';
  if (isCollapsed) aside.classList.add('collapsed');

  /* ========== RENDER SIDEBAR CONTENT ========== */
  aside.setAttribute('role', 'complementary');
  aside.innerHTML = `
    <div class="side-head">
      <a class="brand" href="/dashboard" aria-label="AI Notebook home">
        <span class="logo" aria-hidden="true">
          <img src="/assets/logo.png" alt="AI Notebook logo" class="logo-img" />
        </span>
        <span class="brand-text">AI <span class="grad-text">Notebook</span></span>
      </a>
      <button id="sidebarCollapse" class="collapse-btn" aria-label="Toggle sidebar"
              aria-expanded="${!isCollapsed}" aria-controls="sidebar">
        <i class="fas fa-chevron-${isCollapsed ? 'right' : 'left'}" aria-hidden="true"></i>
      </button>
    </div>
    <nav class="side-nav" role="navigation" aria-label="Main navigation">${navHtml}</nav>
    <div class="side-foot" id="sideFoot">${footerHtml(user)}</div>`;

  /* ========== COLLAPSE / EXPAND ========== */
  const collBtn = document.getElementById('sidebarCollapse');
  if (collBtn) {
    collBtn.addEventListener('click', () => {
      const collapsed = aside.classList.toggle('collapsed');
      localStorage.setItem('ainb_sidebar_collapsed', collapsed);
      const icon = collBtn.querySelector('i');
      if (icon) icon.className = `fas fa-chevron-${collapsed ? 'right' : 'left'}`;
      collBtn.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  /* ========== FOOTER: theme toggle + user profile ========== */
  function footerHtml(u) {
    const light = (function () {
      try { return (localStorage.getItem('ss_theme') || 'dark') === 'light'; }
      catch { return false; }
    })();
    return `
      <button class="theme-toggle side-theme" id="sideThemeToggle" type="button"
              aria-label="Toggle dark and light mode">
        <i class="fas ${light ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>
        <span>${light ? 'Light mode' : 'Dark mode'}</span>
      </button>
      ${userFooterHtml(u)}`;
  }

  function userFooterHtml(u) {
    const init = (u.name || 'Guest').trim().charAt(0).toUpperCase() || 'G';
    const isGuest = !!u.is_guest || !SS.isAuthed();
    return `
      <div class="side-user-wrap">
        <a href="/profile" class="side-user" aria-label="View profile">
          <span class="avatar" aria-hidden="true">${escapeHtml(init)}</span>
          <div class="meta">
            <b>${escapeHtml(u.name || (isGuest ? 'Guest' : 'User'))}</b>
            <span>${escapeHtml(u.username || u.email || (isGuest ? 'Guest mode' : ''))}</span>
          </div>
        </a>
        <button class="logout-btn" id="logoutBtn"
                title="${isGuest ? 'Exit guest mode' : 'Log out'}"
                aria-label="${isGuest ? 'Exit guest mode' : 'Log out'}">
          <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
        </button>
      </div>`;
  }

  function renderUserFooter(u) {
    const foot = document.getElementById('sideFoot');
    if (!foot) return;
    foot.innerHTML = footerHtml(u);
    bindFooter();
  }

  /* ========== FOOTER BINDINGS ========== */
  function bindFooter() {
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out?')) {
        SS.clearSession();
        window.location.href = '/';
      }
    });

    const themeBtn = document.getElementById('sideThemeToggle');
    if (themeBtn && !themeBtn.dataset.bound) {
      themeBtn.dataset.bound = '1';
      themeBtn.addEventListener('click', () => {
        const next = SS.toggleTheme ? SS.toggleTheme() : null;
        const light = next ? next === 'light'
          : document.documentElement.getAttribute('data-theme') === 'light';
        const icon = themeBtn.querySelector('i');
        const label = themeBtn.querySelector('span');
        if (icon) icon.className = `fas ${light ? 'fa-sun' : 'fa-moon'}`;
        if (label) label.textContent = light ? 'Light mode' : 'Dark mode';
      });
    }
  }
  bindFooter();

  /* ========== MOBILE DRAWER ========== */
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sideOverlay');
  const isMobile = () => window.innerWidth <= 880;

  const openSidebar = () => {
    aside.classList.add('open');
    aside.setAttribute('aria-hidden', 'false');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    const firstLink = aside.querySelector('.side-nav a');
    if (firstLink) setTimeout(() => firstLink.focus(), 100);
  };

  const closeSidebar = () => {
    aside.classList.remove('open');
    aside.setAttribute('aria-hidden', isMobile() ? 'true' : 'false');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    if (toggle && isMobile()) setTimeout(() => toggle.focus(), 100);
  };

  if (toggle) {
    toggle.setAttribute('aria-controls', 'sidebar');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      aside.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }

  aside.setAttribute('aria-hidden', isMobile() ? 'true' : 'false');

  if (overlay) {
    overlay.addEventListener('click', (e) => { e.stopPropagation(); closeSidebar(); });
    aside.addEventListener('click', (e) => e.stopPropagation());
  }

  /* ========== KEYBOARD NAVIGATION ========== */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aside.classList.contains('open')) {
      e.preventDefault();
      closeSidebar();
      return;
    }
    if (aside.classList.contains('open')) {
      const navLinks = Array.from(aside.querySelectorAll('.side-nav a'));
      const idx = navLinks.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && idx !== -1) {
        e.preventDefault();
        navLinks[(idx + 1) % navLinks.length].focus();
      } else if (e.key === 'ArrowUp' && idx !== -1) {
        e.preventDefault();
        navLinks[idx === 0 ? navLinks.length - 1 : idx - 1].focus();
      }
    }
  });

  /* ========== SAME-PAGE HASH LINK HANDLING ========== */
  aside.querySelectorAll('.side-nav a').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href') || '';
      const hashIdx = href.indexOf('#');
      if (hashIdx > -1) {
        const targetPath = href.slice(0, hashIdx) || window.location.pathname;
        const targetHash = href.slice(hashIdx);
        if (targetPath === window.location.pathname) {
          e.preventDefault();
          if (window.location.hash === targetHash) {
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } else {
            window.location.hash = targetHash;
          }
        }
      }
      if (isMobile()) closeSidebar();
    });
  });

  /* ========== RESIZE HANDLING ========== */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!isMobile()) {
        aside.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        aside.setAttribute('aria-hidden', 'false');
      } else if (!aside.classList.contains('open')) {
        aside.setAttribute('aria-hidden', 'true');
      }
    }, 120);
  });

  /* ========== PREVENT BODY SCROLL WHEN DRAWER OPEN ========== */
  document.addEventListener('touchmove', (e) => {
    if (aside.classList.contains('open') && !aside.contains(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  /* ========== UTILITY ========== */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
