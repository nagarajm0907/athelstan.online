document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     1. Interactive 3D Card Tilt Effects
     ========================================================================== */
  const setupTiltEffect = (cardId) => {
    const card = document.getElementById(cardId);
    if (!card) return;

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Smooth perspective tilt based on mouse position
      card.style.transform = `perspective(1000px) rotateX(${-y / 18}deg) rotateY(${x / 18}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  };

  // Initialize tilt on interactive cards
  setupTiltEffect('aio-tilt-card');
  setupTiltEffect('analytics-tilt-card');


  /* ==========================================================================
     2. Dynamic Background Dust Particles Generator
     ========================================================================== */
  const particleContainer = document.querySelector('.particle-container');
  if (particleContainer) {
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.classList.add('particle');

      // Randomize sizing, placement, and animations for child-friendly ambient motion
      const size = Math.floor(Math.random() * 6) + 3; // 3px to 8px
      const posX = Math.floor(Math.random() * 100);   // 0% to 100%
      const posY = Math.floor(Math.random() * 100);   // 0% to 100%
      const duration = (Math.random() * 5 + 5).toFixed(1); // 5s to 10s
      const delay = (Math.random() * -5).toFixed(1);      // -0s to -5s

      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.top = `${posY}%`;
      particle.style.left = `${posX}%`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay = `${delay}s`;

      particleContainer.appendChild(particle);
    }
  }


  /* ==========================================================================
     3. Animated Search Input Typewriter Effect
     ========================================================================== */
  const searchInputs = document.querySelectorAll('.search-typewriter');

  searchInputs.forEach((input) => {
    const phrases = JSON.parse(input.getAttribute('data-phrases') || '[]');
    if (phrases.length === 0) return;

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeSpeed = 100;

    const type = () => {
      const currentPhrase = phrases[phraseIndex];

      if (isDeleting) {
        input.value = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 40;
      } else {
        input.value = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 90;
      }

      if (!isDeleting && charIndex === currentPhrase.length) {
        typeSpeed = 2200; // Pause at end of sentence
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 500; // Pause before typing next phrase
      }

      setTimeout(type, typeSpeed);
    };

    type();
  });

});
