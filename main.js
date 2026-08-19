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

      card.style.transform = `perspective(1000px) rotateX(${-y / 20}deg) rotateY(${x / 20}deg) scale3d(1.01, 1.01, 1.01)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  };

  setupTiltEffect('aio-tilt-card');
  setupTiltEffect('analytics-tilt-card');


  /* ==========================================================================
     2. Inject Particles Inside Analytics Cards & Background
     ========================================================================== */
  const generateParticles = (containerSelector, count = 10) => {
    const containers = document.querySelectorAll(containerSelector);

    containers.forEach((container) => {
      if (!container) return;

      for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        const size = Math.floor(Math.random() * 5) + 3; // 3px to 8px
        const posX = Math.floor(Math.random() * 95);   // 0% to 95%
        const posY = Math.floor(Math.random() * 95);   // 0% to 95%
        const duration = (Math.random() * 4 + 4).toFixed(1); // 4s to 8s
        const delay = (Math.random() * -5).toFixed(1);

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.top = `${posY}%`;
        particle.style.left = `${posX}%`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;

        container.appendChild(particle);
      }
    });
  };

  // Inject into background and inside the graphics box
  generateParticles('.particle-container', 15);
  generateParticles('.analytics-graphic-box', 8);


  /* ==========================================================================
     3. Search Bar Typewriter Effect
     ========================================================================== */
  const searchInputs = document.querySelectorAll('.search-typewriter');

  searchInputs.forEach((input) => {
    const phrases = JSON.parse(input.getAttribute('data-phrases') || '["AIO: generative eng", "SEO: rank position"]');
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
        typeSpeed = 2000;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 400;
      }

      setTimeout(type, typeSpeed);
    };

    type();
  });

});
