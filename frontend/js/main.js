/* =====================================================================
   AI Notebook  -  main.js  (landing page only)
   Loads app.js first via a dynamic injection so SS is available.
   ===================================================================== */

// Inject shared app.js if it hasn't loaded yet (index.html only includes main.js).
(function loadShared() {
  if (window.SS) return init();
  const s = document.createElement('script');
  s.src = '/js/app.js';
  s.onload = init;
  document.head.appendChild(s);
})();

function init() {
  // AOS scroll animations
  if (window.AOS) AOS.init({ duration: 800, once: true, offset: 60 });

  // If already logged in, swap "Get started" CTA to Dashboard
  if (window.SS && SS.isAuthed()) {
    document.querySelectorAll('a[href="/signup.html"], a[href="/login.html"]').forEach((a) => {
      a.setAttribute('href', '/dashboard.html');
    });
  }

  // Wire Start Learning buttons to guest login
  document.getElementById('startLearning')?.addEventListener('click', startAsGuest);
  document.getElementById('ctaButton')?.addEventListener('click', startAsGuest);

  typingEffect();
  countUp();
  faqAccordion();
  gsapHero();
}

/* ---------- Start as guest ---------- */
async function startAsGuest(e) {
  if (e) e.preventDefault();
  const btn = e.currentTarget;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
  
  try {
    const data = await SS.api('/api/auth/guest', { method: 'POST', auth: false });
    SS.setSession(data.token, data.user);
    sessionStorage.setItem('ss_show_welcome', 'true');
    SS.toast('Welcome! Let\'s start learning.');
    setTimeout(() => (window.location.href = '/dashboard.html'), 500);
  } catch (err) {
    SS.toast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

/* ---------- Typing text effect ---------- */
function typingEffect() {
  const el = document.getElementById('typed');
  if (!el) return;
  const phrases = [
    'Ask anything. Learn everything.',
    'Generate notes in seconds.',
    'Build quizzes & flashcards instantly.',
    'Summarise PDFs with one click.',
    'Plan your study weeks with AI.',
  ];
  let p = 0, c = 0, deleting = false;

  function tick() {
    const full = phrases[p];
    el.textContent = deleting ? full.slice(0, c--) : full.slice(0, c++);
    let delay = deleting ? 40 : 75;
    if (!deleting && c > full.length) { deleting = true; delay = 1600; }
    else if (deleting && c < 0) { deleting = false; c = 0; p = (p + 1) % phrases.length; delay = 350; }
    setTimeout(tick, delay);
  }
  tick();
}

/* ---------- Animated counters ---------- */
function countUp() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.count, 10);
      let cur = 0;
      const step = Math.max(1, Math.ceil(target / 45));
      const t = setInterval(() => {
        cur += step;
        if (cur >= target) { cur = target; clearInterval(t); }
        el.textContent = cur;
      }, 28);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  els.forEach((el) => obs.observe(el));
}

/* ---------- FAQ accordion ---------- */
function faqAccordion() {
  document.querySelectorAll('.faq-q').forEach((q) => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach((i) => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

/* ---------- GSAP hero entrance + scroll parallax ---------- */
function gsapHero() {
  if (!window.gsap) return;
  gsap.from('.hero .badge', { y: -20, opacity: 0, duration: 0.7 });
  gsap.from('.hero h1', { y: 30, opacity: 0, duration: 0.9, delay: 0.1 });
  gsap.from('.hero .lead', { y: 24, opacity: 0, duration: 0.9, delay: 0.25 });

  if (window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('.feature').forEach((card) => {
      gsap.to(card, {
        scrollTrigger: { trigger: card, start: 'top 90%' },
        duration: 0.6,
      });
    });
  }
}
