/* =====================================================================
   Study Sphere AI  -  confetti.js  (celebratory confetti effect)
   Displays colorful papers falling down when user opens dashboard.
   ===================================================================== */

function createConfetti() {
  const confettiPieces = [];
  const colors = ['#6d7bff', '#a855f7', '#22d3ee', '#fb923c', '#34d399', '#f472b6'];
  
  // Create confetti container
  const container = document.createElement('div');
  container.id = 'confetti-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999;
  `;
  document.body.appendChild(container);

  // Create confetti pieces
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 4;
    const duration = Math.random() * 2 + 2.5;
    const delay = Math.random() * 0.5;
    const left = Math.random() * 100;
    const rotation = Math.random() * 360;
    
    piece.style.cssText = `
      position: absolute;
      left: ${left}%;
      top: -10px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      opacity: 0.8;
      animation: fall ${duration}s linear ${delay}s forwards;
      transform: rotate(${rotation}deg);
    `;
    
    container.appendChild(piece);
    confettiPieces.push(piece);
  }

  // Add keyframe animation
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes fall {
        to {
          transform: translateY(100vh) rotate(720deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Remove confetti after animation completes
  setTimeout(() => {
    container.remove();
  }, 4500);
}

// Trigger confetti on dashboard load
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/dashboard' || window.location.pathname === '/dashboard.html') {
    // Check if user just logged in (within last 2 seconds)
    const lastLoginTime = sessionStorage.getItem('lastLoginTime');
    const now = Date.now();
    
    if (lastLoginTime && now - parseInt(lastLoginTime) < 2000) {
      setTimeout(() => createConfetti(), 300);
      sessionStorage.removeItem('lastLoginTime');
    }
  }
});
