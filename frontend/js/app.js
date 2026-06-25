/* =====================================================================
   AI Notebook  -  app.js  (shared helpers, loaded on every page)
   - API client with JWT
   - auth/session helpers
   - toasts, ripple effects, particles config, mobile nav
   ===================================================================== */

const SS = (() => {
  const TOKEN_KEY = 'ss_token';
  const USER_KEY = 'ss_user';

  /* ---------- API base URL ----------
     The frontend (Vercel) and backend (Render/Railway) live on DIFFERENT
     origins, so API calls must be prefixed with the backend's URL.
     Resolution order (first match wins):
       1. window.SS_API_BASE   — set via an inline <script> (recommended)
       2. <meta name="api-base" content="https://api.example.com">
       3. '' (empty) — same-origin (works when frontend+backend share a host)
     A trailing slash is stripped so we never produce '//api/...'. */
  function resolveApiBase() {
    let base = '';
    if (typeof window !== 'undefined' && window.SS_API_BASE) {
      base = String(window.SS_API_BASE);
    } else {
      const meta = document.querySelector('meta[name="api-base"]');
      if (meta && meta.content) base = meta.content;
    }
    return base.replace(/\/+$/, '');
  }
  const API_BASE = resolveApiBase();
  // Prefix only absolute API paths ('/api/...'); leave full URLs untouched.
  function apiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return API_BASE + path;
  }

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
  function logout() { clearSession(); window.location.href = '/'; }

  // Prevent repeated guest-login attempts (and reload loops) within a page.
  let _guestLoginInFlight = null;
  function ensureGuestSession() {
    if (isAuthed()) return Promise.resolve(getUser());
    if (_guestLoginInFlight) return _guestLoginInFlight;
    _guestLoginInFlight = api('/api/auth/guest', { method: 'POST', auth: false })
      .then((data) => {
        if (data && data.token) {
          setSession(data.token, data.user);
          return data.user;
        }
        throw new Error('Guest login returned no token');
      })
      .finally(() => { _guestLoginInFlight = null; });
    return _guestLoginInFlight;
  }

  function requireAuth() {
    if (isAuthed()) return true;
    // Kick off a guest session once; reload only after it succeeds so we
    // never spin in an endless reload loop when the endpoint is down.
    ensureGuestSession()
      .then(() => location.reload())
      .catch((err) => console.error('Guest login failed:', err));
    return false;
  }

  /* ---------- API ----------
     A single, robust fetch wrapper.
       - Attaches `Authorization: Bearer <token>` when `auth` is true.
       - On a 401, transparently obtains a fresh guest session and retries
         the request ONCE. The `_retry` guard prevents the infinite 401
         loop that the old code could fall into.
       - `raw: true` returns the raw Response (used by streaming callers).
       - Always surfaces a clean Error message on non-2xx responses. */
  async function api(path, opts = {}) {
    const { method = 'GET', body, auth = true, raw = false, signal, _retry = false } = opts;

    const headers = {};
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (auth && getToken()) headers['Authorization'] = 'Bearer ' + getToken();

    let res;
    try {
      res = await fetch(apiUrl(path), {
        method,
        headers,
        body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        // Pass through an AbortController signal so callers (e.g. chat streaming)
        // can cancel in-flight requests safely.
        signal,
      });
    } catch (err) {
      // Re-throw genuine aborts untouched so callers can detect them.
      if (err && err.name === 'AbortError') throw err;
      throw new Error('Network error. Please check your connection and try again.');
    }

    // 401 handling: obtain a fresh guest session and retry exactly ONCE.
    // `_retry` guarantees we never recurse into an infinite loop, even if
    // the guest endpoint itself keeps returning 401.
    if (res.status === 401 && auth && !_retry) {
      try {
        const data = await api('/api/auth/guest', { method: 'POST', auth: false });
        if (data && data.token) setSession(data.token, data.user);
        else throw new Error('No token returned');
      } catch (err) {
        console.error('Failed to refresh session:', err);
        clearSession();
        throw new Error('Your session expired. Please refresh the page.');
      }
      // Single retry with the refreshed token.
      return api(path, { method, body, auth, raw, signal, _retry: true });
    }

    // Streaming / binary callers want the raw Response object.
    if (raw) return res;

    let data = null;
    try { data = await res.json(); } catch { /* no/empty body */ }

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
      document.body.style.overflow = 'hidden';
      if (backdrop) backdrop.classList.add('show');
    };
    const close = () => {
      links.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (backdrop) backdrop.classList.remove('show');
    };
    const isOpen = () => links.classList.contains('open');

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isOpen() ? close() : open();
    });

    // Close when a menu link/button is tapped.
    links.querySelectorAll('a, .btn').forEach((el) => {
      el.addEventListener('click', () => {
        if (isOpen()) close();
      });
    });

    // Close when tapping the backdrop or pressing Escape.
    if (backdrop) {
      backdrop.addEventListener('click', close);
    }
    
    document.addEventListener('keydown', (e) => { 
      if (e.key === 'Escape' && isOpen()) close(); 
    });

    // Reset state if the viewport grows past the mobile breakpoint.
    window.addEventListener('resize', () => { 
      if (window.innerWidth > 880 && isOpen()) close(); 
    });
  }

  /* ---------- page transitions ---------- */
  function initPageTransitions() {
    // Add page-in animation to body
    document.body.classList.add('animate-fade-in-up');
    
    // Intercept link clicks for smooth transitions
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link || !link.href) return;
      
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return; // External link
      if (link.getAttribute('target') === '_blank') return; // New tab
      if (link.getAttribute('download') !== null) return; // Download
      if (url.pathname === window.location.pathname && url.hash) return; // Anchor on same page

      e.preventDefault();
      document.body.style.opacity = '0';
      document.body.style.transform = 'translateY(10px)';
      document.body.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      
      setTimeout(() => {
        window.location.href = link.href;
      }, 300);
    });
  }

  /* ---------- boot common UI ---------- */
  function boot() {
    initTheme();
    initParticles();
    attachRipples();
    initNav();
    initPageTransitions();
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  return { api, getToken, setSession, getUser, clearSession, isAuthed, logout,
           requireAuth, ensureGuestSession, toast, attachRipples, initParticles,
           toggleTheme, getTheme, applyTheme };
})();
