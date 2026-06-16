/* =====================================================================
   Study Sphere AI  -  app.js  (shared helpers, loaded on every page)
   - API client with JWT
   - auth/session helpers
   - toasts, ripple effects, particles config, mobile nav
   ===================================================================== */

const SS = (() => {
  const TOKEN_KEY = 'ss_token';
  const USER_KEY = 'ss_user';

  /* ---------- session ---------- */
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); }
    catch { return {}; }
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function isAuthed() { return !!getToken(); }
  function logout() { clearSession(); window.location.href = '/login'; }
  function requireAuth() {
    if (!isAuthed()) { window.location.href = '/login'; return false; }
    return true;
  }

  /* ---------- API ---------- */
  async function api(path, { method = 'GET', body, auth = true, raw = false } = {}) {
    const headers = {};
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (auth && getToken()) headers['Authorization'] = 'Bearer ' + getToken();

    const res = await fetch(path, {
      method,
      headers,
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    });

    if (res.status === 401 && auth) {
      clearSession();
      if (!location.pathname.includes('login')) window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    if (raw) return res;

    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
  }

  /* ---------- toast ---------- */
  function toast(message, type = 'success', ms = 3800) {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas fa-${type === 'error' ? 'circle-exclamation' : 'circle-check'}"></i> ${message}`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      setTimeout(() => el.remove(), 320);
    }, ms);
  }

  /* ---------- ripple ---------- */
  function attachRipples(root = document) {
    root.querySelectorAll('.btn').forEach((btn) => {
      if (btn.dataset.ripple) return;
      btn.dataset.ripple = '1';
      btn.addEventListener('click', (e) => {
        const circle = document.createElement('span');
        const d = Math.max(btn.clientWidth, btn.clientHeight);
        const rect = btn.getBoundingClientRect();
        circle.style.width = circle.style.height = d + 'px';
        circle.style.left = e.clientX - rect.left - d / 2 + 'px';
        circle.style.top = e.clientY - rect.top - d / 2 + 'px';
        circle.className = 'ripple';
        btn.appendChild(circle);
        setTimeout(() => circle.remove(), 600);
      });
    });
  }

  /* ---------- particles ---------- */
  function initParticles(id = 'particles-js') {
    if (!document.getElementById(id) || typeof particlesJS === 'undefined') return;
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const lineOpacity = light ? 0.18 : 0.25;
    const dotOpacity = light ? 0.5 : 0.45;
    particlesJS(id, {
      particles: {
        number: { value: 60, density: { enable: true, value_area: 900 } },
        color: { value: ['#6d7bff', '#a855f7', '#22d3ee'] },
        shape: { type: 'circle' },
        opacity: { value: dotOpacity, random: true },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: '#6d7bff', opacity: lineOpacity, width: 1 },
        move: { enable: true, speed: 1.6, out_mode: 'out' },
      },
      interactivity: {
        detect_on: 'window',
        events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' }, resize: true },
        modes: { grab: { distance: 160, line_linked: { opacity: 0.5 } }, push: { particles_nb: 3 } },
      },
      retina_detect: true,
    });
  }

  /* ---------- theme (dark / light) ---------- */
  const THEME_KEY = 'ss_theme';
  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch { return 'dark'; }
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }
  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    // Re-init particles so their colours suit the new theme.
    if (typeof particlesJS !== 'undefined' && document.getElementById('particles-js')) {
      initParticles();
    }
    return next;
  }
  function initTheme() {
    applyTheme(getTheme()); // ensure attribute is set even without inline script
    document.querySelectorAll('#themeToggle, .theme-toggle').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', toggleTheme);
    });
  }

  /* ---------- mobile nav (hamburger) ---------- */
  function initNav() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    const backdrop = document.getElementById('navBackdrop');
    if (!toggle || !links) return;

    const open = () => {
      links.classList.add('open');
      toggle.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-open');
      if (backdrop) backdrop.classList.add('show');
    };
    const close = () => {
      links.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
      if (backdrop) backdrop.classList.remove('show');
    };
    const isOpen = () => links.classList.contains('open');

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen() ? close() : open();
    });

    // Close when a menu link/button is tapped.
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));

    // Close when tapping the backdrop or pressing Escape.
    if (backdrop) backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // Reset state if the viewport grows past the mobile breakpoint.
    window.addEventListener('resize', () => { if (window.innerWidth > 880) close(); });
  }

  /* ---------- boot common UI ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initParticles();
    attachRipples();
    initNav();
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  });

  return { api, getToken, setSession, getUser, clearSession, isAuthed, logout,
           requireAuth, toast, attachRipples, initParticles, toggleTheme, getTheme, applyTheme };
})();
