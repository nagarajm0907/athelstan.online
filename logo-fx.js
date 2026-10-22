// Athelstan.Online: hero logo effect (3D tilt that follows the cursor, moving glare, gentle idle motion)
(function () {
  var wrap = document.getElementById('heroLogo');
  if (!wrap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var stage = wrap.querySelector('.hero-logo-stage');
  var sheen = wrap.querySelector('.hero-logo-sheen');
  var tx = 0, ty = 0;      // target rotation (degrees)
  var cx = 0, cy = 0;      // current rotation
  var lastMove = 0;
  var visible = true;
  var raf = null;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  window.addEventListener('mousemove', function (e) {
    var r = wrap.getBoundingClientRect();
    var px = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
    var py = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
    ty = clamp(px, -1, 1) * 22;
    tx = clamp(py, -1, 1) * -16;
    lastMove = performance.now();
  }, { passive: true });

  function frame(now) {
    if (visible) {
      // when nobody is moving the mouse (or on touch screens), drift gently on its own
      if (now - lastMove > 1800) {
        ty = Math.sin(now / 1700) * 18;
        tx = Math.cos(now / 2300) * 9;
      }
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      stage.style.transform = 'rotateX(' + cx.toFixed(2) + 'deg) rotateY(' + cy.toFixed(2) + 'deg)';
      sheen.style.setProperty('--gx', (50 + cy * 2.4).toFixed(1) + '%');
      sheen.style.setProperty('--gy', (32 - cx * 2.6).toFixed(1) + '%');
    }
    raf = requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0.05 }).observe(wrap);
  }
  raf = requestAnimationFrame(frame);
})();
