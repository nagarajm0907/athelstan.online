document.addEventListener('DOMContentLoaded', () => {

  /* 1. Dynamic Particles Generator */
  const particleContainer = document.getElementById('particle-canvas');
  if (particleContainer) {
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.classList.add('particle');
      
      const size = Math.random() * 3 + 2;
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const delay = Math.random() * 5;
      const duration = Math.random() * 6 + 6;

      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${left}%`;
      particle.style.top = `${top}%`;
      particle.style.animationDelay = `${delay}s`;
      particle.style.animationDuration = `${duration}s`;

      particleContainer.appendChild(particle);
    }
  }

  /* 2. Typewriter Loop in Search Card */
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
        typewriterInput.value = current.substring(0, charIdx + 1);
        charIdx++;
      }

      let speed = isDeleting ? 35 : 75;

      if (!isDeleting && charIdx === current.length) {
        speed = 2200;
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        speed = 400;
      }

      setTimeout(typeLoop, speed);
    };

    typeLoop();
  }

  /* 3. Scroll Reveal Animations */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach(el => revealObserver.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  /* 4. Cursor-Following Ambient Glow */
  const cursorGlow = document.getElementById('cursor-glow');
  if (cursorGlow) {
    document.addEventListener('mousemove', (e) => {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY + window.scrollY}px`;
    });
  }

  /* 5. Subtle Card Interactive Physics Tilt */
  const cards = document.querySelectorAll('.glass-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      card.style.transform = `perspective(1000px) rotateX(${-y / 40}deg) rotateY(${x / 40}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });

});
