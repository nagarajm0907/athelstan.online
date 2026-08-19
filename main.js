// =========================================================
// Athelstan.Online — main.js
// Canvas network, scroll reveals, cursor glow, counters, nav
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile menu ---------- */
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      menuToggle.classList.toggle('active');
    });
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        menuToggle.classList.remove('active');
      })
    );
  }

  /* ---------- Sticky header shadow ---------- */
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  /* ---------- Scroll progress bar ---------- */
  const progress = document.getElementById('scrollProgress');
  function updateProgress() {
    if (!progress) return;
    const h = document.documentElement;
    const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    progress.style.width = scrolled + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  /* ---------- Back to top ---------- */
  const toTop = document.getElementById('toTop');
  if (toTop) {
    window.addEventListener('scroll', () => {
      toTop.classList.toggle('show', window.scrollY > 700);
    }, { passive: true });
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ---------- Cursor glow (desktop only) ---------- */
  const glow = document.getElementById('cursorGlow');
  if (glow && window.innerWidth > 980 && !prefersReduced) {
    let gx = 0, gy = 0, cx = 0, cy = 0;
    window.addEventListener('mousemove', e => {
      gx = e.clientX; gy = e.clientY;
      glow.style.opacity = '1';
    });
    document.addEventListener('mouseleave', () => glow.style.opacity = '0');
    function loop() {
      cx += (gx - cx) * 0.12;
      cy += (gy - cy) * 0.12;
      glow.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    }
    loop();
  }

  /* ---------- Animated background network (hero canvas) ---------- */
  const canvas = document.getElementById('network-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h, nodes = [];

    function resize() {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    }
    function initNodes() {
      const count = window.innerWidth < 720 ? 22 : 46;
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.35 * devicePixelRatio,
        r: (Math.random() * 1.6 + 1) * devicePixelRatio
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 160 * devicePixelRatio;
          if (dist < maxDist) {
            ctx.strokeStyle = `rgba(230,171,0,${(1 - dist / maxDist) * 0.35})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,195,0,0.85)';
        ctx.fill();
      }
      if (!prefersReduced) requestAnimationFrame(draw);
    }
    resize(); initNodes(); draw();
    window.addEventListener('resize', () => { resize(); initNodes(); });
  }

  /* ---------- Reveal-on-scroll (fade-up) ---------- */
  const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ---------- Timeline draw-in ---------- */
  const timeline = document.querySelector('.timeline');
  if (timeline) {
    const tlObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          tlObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });
    tlObserver.observe(timeline);
  }

  /* ---------- Counters, bars, rings ---------- */
  const animateOnce = new WeakSet();
  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !animateOnce.has(entry.target)) {
        animateOnce.add(entry.target);

        entry.target.querySelectorAll('.bar-fill').forEach(bar => {
          bar.style.width = bar.dataset.fill + '%';
        });

        entry.target.querySelectorAll('[data-count]').forEach(el => {
          const target = parseInt(el.dataset.count, 10);
          let cur = 0;
          const step = Math.max(1, Math.round(target / 40));
          const iv = setInterval(() => {
            cur += step;
            if (cur >= target) { cur = target; clearInterval(iv); }
            el.textContent = cur + '%';
          }, 22);
        });

        entry.target.querySelectorAll('#growthBars .bar').forEach(bar => {
          bar.style.height = bar.dataset.h + '%';
        });

        entry.target.querySelectorAll('.ring-card').forEach(card => {
          const pct = parseInt(card.dataset.pct, 10);
          const circle = card.querySelector('.ring-fill');
          const offset = 314 - (314 * pct / 100);
          circle.style.strokeDashoffset = offset;
        });
      }
    });
  }, { threshold: 0.35 });

  document.querySelectorAll('.pulse-panel, .chart-card, .ring-grid')
    .forEach(el => statObserver.observe(el));

  /* ---------- Tilt effect on service / ring cards (desktop) ---------- */
  if (window.innerWidth > 980 && !prefersReduced) {
    document.querySelectorAll('.svc-card, .ring-card, .ctype-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rx = ((y / rect.height) - 0.5) * -6;
        const ry = ((x / rect.width) - 0.5) * 6;
        card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }
});
