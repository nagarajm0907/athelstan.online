document.addEventListener('DOMContentLoaded', () => {

  // 1. Interactive Cursor Glow
  const follower = document.getElementById('cursor-follower');
  if (follower) {
    document.addEventListener('mousemove', (e) => {
      follower.style.left = `${e.clientX}px`;
      follower.style.top = `${e.clientY}px`;
    });
  }

  // 2. Typing Effect for Search Bar
  const queries = [
    "web development + seo chennai",
    "freelance social media growth",
    "top ranking digital marketing"
  ];
  const typedEl = document.getElementById('typed-query');
  let qi = 0, ci = 0, deleting = false;

  function typeLoop() {
    if (!typedEl) return;
    const current = queries[qi];
    if (!deleting) {
      ci++;
      typedEl.textContent = current.slice(0, ci);
      if (ci === current.length) { deleting = true; setTimeout(typeLoop, 1800); return; }
      setTimeout(typeLoop, 40);
    } else {
      ci--;
      typedEl.textContent = current.slice(0, ci);
      if (ci === 0) { deleting = false; qi = (qi + 1) % queries.length; setTimeout(typeLoop, 350); return; }
      setTimeout(typeLoop, 20);
    }
  }
  typeLoop();

  // 3. 3D Tilt Effect on Hero Card
  const serp = document.querySelector('.serp');
  const serpContainer = document.querySelector('.serp-container');

  if (serpContainer && serp) {
    serpContainer.addEventListener('mousemove', (e) => {
      const rect = serpContainer.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const rotateX = (-y / rect.height) * 18;
      const rotateY = (x / rect.width) * 18;

      serp.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });

    serpContainer.addEventListener('mouseleave', () => {
      serp.style.transform = `rotateX(0deg) rotateY(0deg) translateY(0px)`;
    });
  }

  // 4. Background Particle Animation Canvas
  const canvas = document.getElementById('particle-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 3 + 1,
      dx: (Math.random() - 0.5) * 0.6,
      dy: (Math.random() - 0.5) * 0.6,
      alpha: Math.random() * 0.4 + 0.1
    }));

    function drawParticles() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;

        if (p.x < 0 || p.x > width) p.dx *= -1;
        if (p.y < 0 || p.y > height) p.dy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 82, 50, ${p.alpha})`;
        ctx.fill();
      });
      requestAnimationFrame(drawParticles);
    }
    drawParticles();
  }

  // 5. GSAP Scroll Animations (Triggered via CDN)
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    gsap.from(".hero-content > *", {
      opacity: 0,
      y: 30,
      duration: 0.8,
      stagger: 0.15,
      ease: "power2.out"
    });

    gsap.from(".service-card", {
      scrollTrigger: {
        trigger: ".services-grid",
        start: "top 80%"
      },
      opacity: 0,
      y: 40,
      duration: 0.7,
      stagger: 0.12,
      ease: "power2.out"
    });

    gsap.from(".person-card", {
      scrollTrigger: {
        trigger: ".people",
        start: "top 80%"
      },
      opacity: 0,
      y: 30,
      duration: 0.8,
      stagger: 0.2,
      ease: "power2.out"
    });
  }
});
