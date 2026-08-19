document.addEventListener('DOMContentLoaded', () => {

  // 1. Fail-Safe Intersection Observer for Smooth Scroll Reveal
  const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // 2. Typing Effect for Search Bar Simulator
  const sentences = [
    "top ranking digital agency chennai",
    "AIO: generative engine optimization",
    "technical seo & backlink growth"
  ];
  const typeTarget = document.getElementById('type-output');
  let sentenceIdx = 0, charIdx = 0, deleting = false;

  function handleTyping() {
    if (!typeTarget) return;
    const currentText = sentences[sentenceIdx];

    if (!deleting) {
      charIdx++;
      typeTarget.textContent = currentText.slice(0, charIdx);
      if (charIdx >= currentText.length) {
        deleting = true;
        setTimeout(handleTyping, 2000);
        return;
      }
      setTimeout(handleTyping, 60);
    } else {
      charIdx--;
      typeTarget.textContent = currentText.slice(0, charIdx);
      if (charIdx <= 0) {
        deleting = false;
        sentenceIdx = (sentenceIdx + 1) % sentences.length;
        setTimeout(handleTyping, 400);
        return;
      }
      setTimeout(handleTyping, 30);
    }
  }
  handleTyping();

  // 3. Smooth 3D Card Hover Perspective
  const tiltCard = document.getElementById('hero-tilt-card');
  if (tiltCard) {
    tiltCard.addEventListener('mousemove', (e) => {
      const rect = tiltCard.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      tiltCard.style.transform = `perspective(1000px) rotateX(${-y / 15}deg) rotateY(${x / 15}deg)`;
    });

    tiltCard.addEventListener('mouseleave', () => {
      tiltCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  }

});
