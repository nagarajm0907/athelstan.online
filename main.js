document.addEventListener('DOMContentLoaded', () => {

  /* 1. Dynamic Particles Generator */
  const particleContainer = document.getElementById('particle-canvas');
  if (particleContainer) {
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.classList.add('particle');
      
      const size = Math.random() * 3 + 2; // 2px to 5px
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const delay = Math.random() * 5;
      const duration = Math.random() * 5 + 5;

      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${left}%`;
      particle.style.top = `${top}%`;
      particle.style.animationDelay = `${delay}s`;
      particle.style.animationDuration = `${duration}s`;

      particleContainer.appendChild(particle);
    }
  }

  /* 2. Typewriter Effect for Search Bar */
  const typewriterInput = document.querySelector('.search-typewriter');
  if (typewriterInput) {
    const phrases = JSON.parse(typewriterInput.getAttribute('data-phrases') || '[]');
    let phraseIdx = 0;
    let charIdx = 0;
    let isDeleting = false;

    const typeLoop = () => {
      const current = phrases[phraseIdx];

      if (isDeleting) {
        typewriterInput.value = current.substring(0, charIdx - 1);
        charIdx--;
      } else {
        typewriterInput.value = current.substring(0, charIndex = charIdx + 1);
      }

      let speed = isDeleting ? 40 : 80;

      if (!isDeleting && charIdx === current.length) {
        speed = 2000;
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        speed = 500;
      }

      setTimeout(typeLoop, speed);
    };

    typeLoop();
  }

  /* 3. Subtle Card Tilt Effect */
  const cards = document.querySelectorAll('.glass-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      card.style.transform = `perspective(1000px) rotateX(${-y / 35}deg) rotateY(${x / 35}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });

});
