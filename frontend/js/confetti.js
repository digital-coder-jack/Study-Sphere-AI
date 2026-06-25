/* =====================================================================
   AI Notebook  -  confetti.js
   Premium welcome celebration with confetti and modal
   ===================================================================== */

(function() {
  function showWelcomeCelebration() {
    if (sessionStorage.getItem('ss_show_welcome') !== 'true') return;
    sessionStorage.removeItem('ss_show_welcome');

    const user = SS.getUser();
    const name = user.name || 'Student';

    // 1. Create Confetti
    createConfetti();

    // 2. Create Modal
    const modal = document.createElement('div');
    modal.className = 'welcome-modal-overlay';
    modal.innerHTML = `
      <div class="welcome-modal glass">
        <div class="welcome-icon">🎉</div>
        <h2>Welcome to AI Notebook, ${name}!</h2>
        <p>Your intelligent learning companion is ready. Let's start your journey to success!</p>
        <button class="btn" id="closeWelcome">Let's Go <i class="fas fa-rocket"></i></button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 500);
    };

    document.getElementById('closeWelcome').addEventListener('click', close);
    setTimeout(close, 5000);
  }

  function createConfetti() {
    const container = document.createElement('div');
    container.id = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#6d7bff', '#a855f7', '#22d3ee', '#34d399', '#fb7185'];
    
    for (let i = 0; i < 100; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      p.style.animationDelay = Math.random() * 2 + 's';
      p.style.width = Math.random() * 10 + 5 + 'px';
      p.style.height = Math.random() * 10 + 5 + 'px';
      container.appendChild(p);
    }

    setTimeout(() => container.remove(), 6000);
  }

  // Inject Styles
  const style = document.createElement('style');
  style.id = 'welcome-style';
  style.textContent = `
    .welcome-modal-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: grid; place-items: center;
      background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
      padding: 1.5rem; animation: fadeIn 0.4s ease;
    }
    .welcome-modal {
      max-width: 480px; width: 100%; padding: 3rem 2rem;
      text-align: center; border-radius: 24px;
      box-shadow: 0 30px 60px rgba(0,0,0,0.5);
    }
    .welcome-icon { font-size: 4rem; margin-bottom: 1.5rem; animation: bounce 1s infinite; }
    .welcome-modal h2 { font-size: 1.8rem; margin-bottom: 1rem; }
    .welcome-modal p { color: var(--text-dim); margin-bottom: 2rem; font-size: 1.1rem; }
    .welcome-modal-overlay.fade-out { opacity: 0; transition: opacity 0.5s ease; }
    
    #confetti-container { position: fixed; inset: 0; z-index: 9998; pointer-events: none; }
    .confetti-piece {
      position: absolute; top: -20px;
      border-radius: 2px;
      animation: confetti-fall 4s linear forwards;
    }

    @keyframes confetti-fall {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showWelcomeCelebration);
  } else {
    showWelcomeCelebration();
  }
})();
