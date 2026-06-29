/* =====================================================================
   Study Sphere AI  -  sidebar.js  (2026 Premium Redesign)
   ---------------------------------------------------------------------
   A single-source sidebar renderer powering every authenticated page.
   Inspired by Notion · Linear · Discord · Raycast.

   Layout
     ┌──────────────────────────────┐
     │  LOGO  +  collapse button     │  ← header
     ├──────────────────────────────┤
     │  New chat (primary)           │
     │  ── Workspace ──              │  ← nav (scrollable)
     │  AI Models / History / …      │
     │  ── Insights ──               │
     │  Analytics / Settings         │
     ├──────────────────────────────┤
     │  THEME TOGGLE                 │  ← footer
     │  ┌──────────────────────────┐ │
     │  │ avatar  name      ⋮      │ │  ← PROFILE block w/ dropdown
     │  │         email            │ │
     │  └──────────────────────────┘ │
     └──────────────────────────────┘

   Collapsed (desktop): icons only, centered, profile shows avatar +
   notification dot + settings shortcut. Expanded: full profile + ⋮ menu.

   Styling lives in /css/sidebar.css (new) which layers over the legacy
   /css/sidebar-mobile.css. Behaviour preserved (mobile drawer, collapse
   persistence, keyboard nav, ripples, guest mode).
   ===================================================================== */

(function () {
  'use strict';

  var aside = document.getElementById('sidebar');
  if (!aside) return;

  /* ---- Guest mode: render first, login in background ---- */
  if (!SS.isAuthed()) {
    SS.api('/api/auth/guest', { method: 'POST', auth: false })
      .then(function (data) {
        if (data && data.token) {
          SS.setSession(data.token, data.user);
          renderUserFooter(SS.getUser());
        }
      })
      .catch(function (err) { console.warn('Guest login pending:', err && err.message); });
  }

  var active = aside.dataset.active || '';
  var user = SS.getUser();

  /* ---- Navigation catalogue ---- */
  var items = [
    { id: 'chat', href: '/chat', icon: 'fa-pen-to-square', label: 'New Chat', primary: true },
    { section: 'Workspace' },
    { id: 'dashboard', href: '/dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
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

  var navHtml = items.map(function (it) {
    if (it.section) {
      return '<div class="nav-section" role="separator">' + escapeHtml(it.section) + '</div>';
    }
    var classes = [it.id === active ? 'active' : '', it.primary ? 'nav-primary' : ''].filter(Boolean).join(' ');
    return '' +
      '<a class="' + classes + '" href="' + escapeHtml(it.href) + '" title="' + escapeHtml(it.label) + '" ' +
      'role="menuitem" aria-label="' + escapeHtml(it.label) + '" data-tooltip-pos="right">' +
        '<i class="fas ' + escapeHtml(it.icon) + '" aria-hidden="true"></i>' +
        '<span>' + escapeHtml(it.label) + '</span>' +
      '</a>';
  }).join('');

  /* ---- Restore collapsed state ---- */
  var isCollapsed = localStorage.getItem('ainb_sidebar_collapsed') === 'true';
  if (isCollapsed) aside.classList.add('collapsed');

  /* ---- Render shell ---- */
  aside.setAttribute('role', 'complementary');
  aside.innerHTML =
    '<div class="side-head">' +
      '<a class="brand" href="/dashboard" aria-label="Study Sphere home">' +
        '<span class="logo" aria-hidden="true"><img src="/assets/logo.png" alt="Study Sphere logo" class="logo-img" /></span>' +
        '<span class="brand-text">Study <span class="grad-text">Sphere</span></span>' +
      '</a>' +
      '<button id="sidebarCollapse" class="collapse-btn" aria-label="Toggle sidebar" ' +
        'aria-expanded="' + (!isCollapsed) + '" aria-controls="sidebar" data-tooltip="Collapse">' +
        '<i class="fas fa-chevron-' + (isCollapsed ? 'right' : 'left') + '" aria-hidden="true"></i>' +
      '</button>' +
    '</div>' +
    '<nav class="side-nav" role="navigation" aria-label="Main navigation">' + navHtml + '</nav>' +
    '<div class="side-foot" id="sideFoot">' + footerHtml(user) + '</div>';

  /* ---- Collapse / expand ---- */
  var collBtn = document.getElementById('sidebarCollapse');
  if (collBtn) {
    collBtn.addEventListener('click', function () {
      var collapsed = aside.classList.toggle('collapsed');
      localStorage.setItem('ainb_sidebar_collapsed', collapsed);
      var icon = collBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-chevron-' + (collapsed ? 'right' : 'left');
      collBtn.setAttribute('aria-expanded', String(!collapsed));
      collBtn.setAttribute('data-tooltip', collapsed ? 'Expand' : 'Collapse');
      closeProfileMenu();
    });
  }

  /* ---- Footer markup ---- */
  function footerHtml(u) {
    var light = (function () {
      try { return (localStorage.getItem('ss_theme') || 'dark') === 'light'; } catch (e) { return false; }
    })();
    return '' +
      '<button class="theme-toggle side-theme" id="sideThemeToggle" type="button" ' +
        'aria-label="Toggle dark and light mode" data-tooltip-pos="right" data-tooltip="Theme">' +
        '<i class="fas ' + (light ? 'fa-sun' : 'fa-moon') + '" aria-hidden="true"></i>' +
        '<span>' + (light ? 'Light mode' : 'Dark mode') + '</span>' +
      '</button>' +
      userFooterHtml(u);
  }

  function userFooterHtml(u) {
    var name = u.name || (u.is_guest ? 'Guest' : 'User');
    var init = (name || 'G').trim().charAt(0).toUpperCase() || 'G';
    var sub = u.email || u.username || (u.is_guest ? 'Guest mode' : '');
    var isGuest = !!u.is_guest || !SS.isAuthed();

    return '' +
      '<div class="side-user-card" id="sideUserCard">' +
        '<button class="side-user-trigger" id="sideUserTrigger" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">' +
          '<span class="avatar" aria-hidden="true">' + escapeHtml(init) +
            '<span class="status-dot' + (isGuest ? ' guest' : '') + '"></span>' +
          '</span>' +
          '<span class="meta">' +
            '<b>' + escapeHtml(name) + '</b>' +
            '<span>' + escapeHtml(sub) + '</span>' +
          '</span>' +
          '<i class="fas fa-ellipsis-vertical chev" aria-hidden="true"></i>' +
        '</button>' +
        // Collapsed-only quick actions (settings shortcut shown beside avatar)
        '<a class="side-user-quick" href="/settings" title="Settings" aria-label="Settings" data-tooltip-pos="right" data-tooltip="Settings">' +
          '<i class="fas fa-gear"></i>' +
        '</a>' +
        // Dropdown menu (expanded mode)
        '<div class="dropdown-menu side-user-menu" id="sideUserMenu" role="menu">' +
          '<a class="dropdown-item" href="/profile" role="menuitem"><i class="fas fa-user"></i> View profile</a>' +
          '<a class="dropdown-item" href="/settings" role="menuitem"><i class="fas fa-gear"></i> Settings</a>' +
          '<a class="dropdown-item" href="/analytics" role="menuitem"><i class="fas fa-chart-pie"></i> Analytics</a>' +
          '<div class="dropdown-sep"></div>' +
          '<button class="dropdown-item danger" id="logoutBtn" role="menuitem">' +
            '<i class="fas fa-right-from-bracket"></i> ' + (isGuest ? 'Exit guest mode' : 'Log out') +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function renderUserFooter(u) {
    var foot = document.getElementById('sideFoot');
    if (!foot) return;
    foot.innerHTML = footerHtml(u);
    bindFooter();
  }

  /* ---- Profile dropdown ---- */
  function closeProfileMenu() {
    var menu = document.getElementById('sideUserMenu');
    var trigger = document.getElementById('sideUserTrigger');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function bindFooter() {
    var trigger = document.getElementById('sideUserTrigger');
    var menu = document.getElementById('sideUserMenu');
    if (trigger && menu && !trigger.dataset.bound) {
      trigger.dataset.bound = '1';
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        // In collapsed desktop mode, clicking avatar goes to profile instead
        if (aside.classList.contains('collapsed') && window.innerWidth > 880) {
          window.location.href = '/profile';
          return;
        }
        var open = menu.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('#sideUserCard')) closeProfileMenu();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeProfileMenu();
      });
    }

    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = '1';
      logoutBtn.addEventListener('click', function () {
        SS.clearSession();
        window.location.href = '/';
      });
    }

    var themeBtn = document.getElementById('sideThemeToggle');
    if (themeBtn && !themeBtn.dataset.bound) {
      themeBtn.dataset.bound = '1';
      themeBtn.addEventListener('click', function () {
        var next = SS.toggleTheme ? SS.toggleTheme() : null;
        if (window.SSMotion) SSMotion.applyPreferences();
        var light = next ? next === 'light'
          : document.documentElement.getAttribute('data-theme') === 'light';
        var icon = themeBtn.querySelector('i');
        var label = themeBtn.querySelector('span');
        if (icon) icon.className = 'fas ' + (light ? 'fa-sun' : 'fa-moon');
        if (label) label.textContent = light ? 'Light mode' : 'Dark mode';
      });
    }
  }
  bindFooter();

  /* ---- Mobile drawer ---- */
  var toggle = document.getElementById('sidebarToggle');
  var overlay = document.getElementById('sideOverlay');
  var isMobile = function () { return window.innerWidth <= 880; };

  function openSidebar() {
    aside.classList.add('open');
    aside.setAttribute('aria-hidden', 'false');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    var firstLink = aside.querySelector('.side-nav a');
    if (firstLink) setTimeout(function () { firstLink.focus(); }, 100);
  }

  function closeSidebar() {
    aside.classList.remove('open');
    aside.setAttribute('aria-hidden', isMobile() ? 'true' : 'false');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    if (toggle && isMobile()) setTimeout(function () { toggle.focus(); }, 100);
  }

  if (toggle) {
    toggle.setAttribute('aria-controls', 'sidebar');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      aside.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }

  aside.setAttribute('aria-hidden', isMobile() ? 'true' : 'false');

  if (overlay) {
    overlay.addEventListener('click', function (e) { e.stopPropagation(); closeSidebar(); });
  }

  /* ---- Keyboard navigation ---- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && aside.classList.contains('open')) {
      e.preventDefault();
      closeSidebar();
      return;
    }
    if (aside.classList.contains('open')) {
      var navLinks = Array.prototype.slice.call(aside.querySelectorAll('.side-nav a'));
      var idx = navLinks.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && idx !== -1) {
        e.preventDefault();
        navLinks[(idx + 1) % navLinks.length].focus();
      } else if (e.key === 'ArrowUp' && idx !== -1) {
        e.preventDefault();
        navLinks[idx === 0 ? navLinks.length - 1 : idx - 1].focus();
      }
    }
  });

  /* ---- Same-page hash links ---- */
  aside.querySelectorAll('.side-nav a').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href') || '';
      var hashIdx = href.indexOf('#');
      if (hashIdx > -1) {
        var targetPath = href.slice(0, hashIdx) || window.location.pathname;
        var targetHash = href.slice(hashIdx);
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

  /* ---- Resize ---- */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
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

  document.addEventListener('touchmove', function (e) {
    if (aside.classList.contains('open') && !aside.contains(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
