/* =====================================================================
   AI Notebook  -  analytics-tracker.js
   Client-side analytics tracking with guest ID management
   ===================================================================== */

(function() {
  const GUEST_ID_KEY = 'ss_guest_id';
  const SESSION_START_KEY = 'ss_session_start';
  const LAST_ACTIVITY_KEY = 'ss_last_activity';
  const ACTIVITY_INTERVAL = 30000; // 30 seconds

  /* Resolve the backend base URL (same logic as app.js) so analytics works
     when the frontend (Vercel) and backend are on different origins. */
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
  const apiUrl = (p) => (/^https?:\/\//i.test(p) ? p : API_BASE + p);

  class AnalyticsTracker {
    constructor() {
      this.guestId = this.getOrCreateGuestId();
      this.sessionStart = new Date();
      this.lastActivityTime = new Date();
      this.currentPage = window.location.pathname;
      this.activityInterval = null;
      this.init();
    }

    getOrCreateGuestId() {
      let guestId = localStorage.getItem(GUEST_ID_KEY);
      if (!guestId) {
        guestId = this.generateGuestId();
        localStorage.setItem(GUEST_ID_KEY, guestId);
      }
      return guestId;
    }

    generateGuestId() {
      const timestamp = Date.now().toString(36);
      const randomStr = Math.random().toString(36).substring(2, 15);
      return `guest_${timestamp}_${randomStr}`;
    }

    init() {
      this.trackVisit();
      this.startActivityTracking();
      this.setupPageChangeListener();
      this.setupUnloadListener();
    }

    trackVisit() {
      fetch(apiUrl('/api/analytics/track-visit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: this.guestId,
          page_url: this.currentPage
        })
      }).catch(err => console.warn('Analytics tracking failed:', err));
    }

    startActivityTracking() {
      // Track activity every 30 seconds
      this.activityInterval = setInterval(() => {
        const now = new Date();
        const timeSpentOnPage = (now - this.lastActivityTime) / 1000; // in seconds
        this.lastActivityTime = now;

        fetch(apiUrl('/api/analytics/track-activity'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_id: this.guestId,
            current_page: this.currentPage,
            time_spent_on_page: timeSpentOnPage
          })
        }).catch(err => console.warn('Activity tracking failed:', err));
      }, ACTIVITY_INTERVAL);
    }

    setupPageChangeListener() {
      // Track page changes (for SPA navigation)
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      window.history.pushState = (...args) => {
        originalPushState.apply(window.history, args);
        this.onPageChange();
      };

      window.history.replaceState = (...args) => {
        originalReplaceState.apply(window.history, args);
        this.onPageChange();
      };

      // Also listen for popstate events (back/forward buttons)
      window.addEventListener('popstate', () => this.onPageChange());
    }

    onPageChange() {
      const newPage = window.location.pathname;
      if (newPage !== this.currentPage) {
        this.currentPage = newPage;
        this.trackVisit();
      }
    }

    setupUnloadListener() {
      window.addEventListener('beforeunload', () => {
        const sessionEnd = new Date();
        const sessionStart = new Date(localStorage.getItem(SESSION_START_KEY) || this.sessionStart);

        // Send session end data (non-blocking, use sendBeacon if available)
        const data = JSON.stringify({
          guest_id: this.guestId,
          session_start: sessionStart.toISOString(),
          session_end: sessionEnd.toISOString()
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon(apiUrl('/api/analytics/track-session-end'), data);
        } else {
          fetch(apiUrl('/api/analytics/track-session-end'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
          }).catch(err => console.warn('Session end tracking failed:', err));
        }
      });
    }

    trackFeatureUsage(feature) {
      fetch(apiUrl('/api/analytics/track-feature'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: this.guestId,
          feature: feature
        })
      }).catch(err => console.warn('Feature tracking failed:', err));
    }

    getGuestId() {
      return this.guestId;
    }
  }

  // Initialize analytics tracker
  window.AnalyticsTracker = new AnalyticsTracker();

  // Expose feature tracking methods globally
  window.trackAIChat = () => window.AnalyticsTracker.trackFeatureUsage('ai_chat');
  window.trackQuizAttempt = () => window.AnalyticsTracker.trackFeatureUsage('quiz_attempt');
  window.trackNotesGenerated = () => window.AnalyticsTracker.trackFeatureUsage('notes_generated');
})();
