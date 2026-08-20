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

  /* ---------- Animated neural-network background (reusable, multi-canvas) ---------- */
  function initNetworkCanvas(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let w, h, nodes = [], pulses = [], running = true, rafId = null;
    const isSmall = window.innerWidth < 720;
    const density = opts.density || (isSmall ? 0.55 : 1);
    const baseCount = isSmall ? 26 : 52;
    const nodeColor = opts.nodeColor || '255,195,0';
    const lineColor = opts.lineColor || '230,171,0';
    const pulseColor = opts.pulseColor || '255,225,140';

    function resize() {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    }
    function initNodes() {
      const count = Math.round(baseCount * density);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.3 * devicePixelRatio,
        r: (Math.random() * 1.8 + 1.3) * devicePixelRatio
      }));
      pulses = Array.from({ length: isSmall ? 3 : 7 }, () => ({ t: Math.random(), a: null, b: null, speed: 0.004 + Math.random() * 0.006 }));
    }
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      const maxDist = 210 * devicePixelRatio;
      const activeLinks = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const strength = 1 - dist / maxDist;
            ctx.strokeStyle = `rgba(${lineColor},${strength * 0.6})`;
            ctx.lineWidth = 1.1 * devicePixelRatio * strength + 0.3;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            if (strength > 0.45) activeLinks.push([a, b]);
          }
        }
      }
      for (const p of pulses) {
        if (!p.a || p.t >= 1 || Math.random() < 0.002) {
          if (activeLinks.length) {
            const link = activeLinks[Math.floor(Math.random() * activeLinks.length)];
            p.a = link[0]; p.b = link[1]; p.t = 0;
          }
        }
        if (p.a && p.b) {
          p.t += p.speed;
          const px = p.a.x + (p.b.x - p.a.x) * p.t;
          const py = p.a.y + (p.b.y - p.a.y) * p.t;
          ctx.beginPath();
          ctx.arc(px, py, 2.6 * devicePixelRatio, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${pulseColor},0.95)`;
          ctx.shadowColor = `rgba(${lineColor},0.9)`;
          ctx.shadowBlur = 12 * devicePixelRatio;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${nodeColor},0.95)`;
        ctx.shadowColor = `rgba(${nodeColor},0.55)`;
        ctx.shadowBlur = 6 * devicePixelRatio;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (!prefersReduced && running) rafId = requestAnimationFrame(draw);
    }
    resize(); initNodes(); draw();
    window.addEventListener('resize', () => { resize(); initNodes(); });

    // Pause when off-screen to keep multiple canvases cheap
    const vis = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const wasRunning = running;
        running = entry.isIntersecting;
        if (running && !wasRunning && !prefersReduced) {
          if (rafId) cancelAnimationFrame(rafId);
          draw();
        }
        if (!running && rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      });
    }, { threshold: 0.01 });
    vis.observe(canvas);
  }

  const heroCanvas = document.getElementById('network-canvas');
  if (heroCanvas) initNetworkCanvas(heroCanvas, { density: 1.3 });

  document.querySelectorAll('.section-network').forEach(c => initNetworkCanvas(c, { density: 0.85 }));

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

  /* ---------- Tilt effect on service / ring / kb cards (desktop) ---------- */
  if (window.innerWidth > 980 && !prefersReduced) {
    document.querySelectorAll('.svc-card, .ring-card, .ctype-card, .kb-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rx = ((y / rect.height) - 0.5) * -5;
        const ry = ((x / rect.width) - 0.5) * 5;
        card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ---------- Typewriter cycling text ---------- */
  document.querySelectorAll('[data-typewriter]').forEach(el => {
    const words = el.dataset.typewriter.split('|');
    const cursor = document.createElement('span');
    cursor.className = 'tw-cursor';
    const textNode = document.createElement('span');
    el.textContent = '';
    el.classList.add('typewriter');
    el.appendChild(textNode);
    el.appendChild(cursor);

    if (prefersReduced) {
      textNode.textContent = words[0];
      return;
    }

    let wordIndex = 0, charIndex = 0, deleting = false;
    const typeSpeed = 55, deleteSpeed = 30, holdTime = 1400, gapTime = 300;

    function tick() {
      const current = words[wordIndex];
      if (!deleting) {
        charIndex++;
        textNode.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          setTimeout(tick, holdTime);
          return;
        }
        setTimeout(tick, typeSpeed);
      } else {
        charIndex--;
        textNode.textContent = current.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
          setTimeout(tick, gapTime);
          return;
        }
        setTimeout(tick, deleteSpeed);
      }
    }
    tick();
  });

  /* ---------- Orbit rings: position satellites ---------- */
  document.querySelectorAll('.orbit-ring').forEach(ring => {
    const size = ring.dataset.size || 120;
    const duration = ring.dataset.duration || 14;
    ring.style.width = size + 'px';
    ring.style.height = size + 'px';
    ring.style.animationDuration = duration + 's';
  });

  /* ---------- Knowledge Base: filter tabs ---------- */
  const kbFilters = document.querySelectorAll('.kb-filter-btn');
  const kbCards = document.querySelectorAll('.kb-card');
  if (kbFilters.length) {
    kbFilters.forEach(btn => {
      btn.addEventListener('click', () => {
        kbFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        kbCards.forEach(card => {
          const match = filter === 'all' || card.dataset.category === filter;
          if (match) {
            card.classList.remove('hidden-card');
            card.style.animation = 'none';
            requestAnimationFrame(() => {
              card.style.animation = '';
              card.classList.add('reveal');
              requestAnimationFrame(() => card.classList.add('in'));
            });
          } else {
            card.classList.add('hidden-card');
          }
        });
      });
    });
  }

  /* ---------- Chatbot Widget ---------- */
  (function () {
    const FORMSPREE_ID = 'YOUR_FORM_ID'; // <-- paste your Formspree form ID here

    const toggle = document.getElementById('chatToggle');
    const panel = document.getElementById('chatPanel');
    const closeBtn = document.getElementById('chatClose');
    const body = document.getElementById('chatBody');
    if (!toggle || !panel) return;

    let opened = false;

    function addBubble(text, from) {
      const b = document.createElement('div');
      b.className = 'chat-bubble ' + from;
      b.textContent = text;
      body.appendChild(b);
      body.scrollTop = body.scrollHeight;
    }

    function addOptions(options) {
      const wrap = document.createElement('div');
      wrap.className = 'chat-options';
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'chat-opt-btn';
        btn.textContent = opt.label;
        btn.onclick = () => {
          addBubble(opt.label, 'user');
          wrap.remove();
          opt.action();
        };
        wrap.appendChild(btn);
      });
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    }

    function askEmail(context) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <input type="email" id="chatEmailInput" placeholder="you@company.com" />
        <button class="chat-send-btn" id="chatEmailSend">Send</button>
      `;
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;

      document.getElementById('chatEmailSend').onclick = async () => {
        const emailInput = document.getElementById('chatEmailInput');
        const email = emailInput.value.trim();
        if (!email || !email.includes('@')) {
          emailInput.style.borderColor = '#e05555';
          return;
        }
        wrap.remove();
        addBubble(email, 'user');

        try {
          await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, interest: context })
          });
          addBubble("Got it — I'll be in touch shortly. You can also email athelstan.online@gmail.com directly anytime.", 'bot');
        } catch (e) {
          addBubble("Something went wrong sending that — please email athelstan.online@gmail.com directly.", 'bot');
        }
      };
    }

    function startChat() {
      body.innerHTML = '';
      addBubble("Hi! I'm here to help. What are you looking for?", 'bot');
      addOptions([
        { label: 'SEO / AIO services', action: () => {
          addBubble("We handle technical SEO plus AI Optimization (GEO/AEO) — getting you ranked in Google and cited in ChatGPT, Perplexity and AI Overviews.", 'bot');
          addBubble("Want a free audit of where you currently stand?", 'bot');
          addOptions([{ label: 'Yes, send me an audit', action: () => askEmail('Free AIO audit request') }]);
        }},
        { label: 'Website development', action: () => {
          addBubble("We build fast, SEO-ready sites — WordPress or custom code — with schema and Core Web Vitals handled from day one.", 'bot');
          addOptions([{ label: 'Get a quote', action: () => askEmail('Website development quote') }]);
        }},
        { label: 'Pricing', action: () => {
          addBubble("Pricing depends on scope — leave your email and we'll send a tailored quote within a day.", 'bot');
          askEmail('Pricing enquiry');
        }},
        { label: 'Just leave my email', action: () => askEmail('General enquiry') }
      ]);
    }

    toggle.addEventListener('click', () => {
      opened = !opened;
      panel.classList.toggle('open', opened);
      if (opened && body.children.length === 0) startChat();
    });
    closeBtn.addEventListener('click', () => {
      opened = false;
      panel.classList.remove('open');
    });
  })();
});
