document.addEventListener('DOMContentLoaded', () => {

  // 1. Reliable Scroll Reveal Animations using IntersectionObserver
  const observerOptions = {
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // Trigger once safely
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // 2. Interactive Typing Effect with Bound Safeguards
  const queryList = [
    "top-ranking web agency",
    "technical seo experts",
    "social media acceleration"
  ];
  const targetEl = document.getElementById('type-writer');
  let qIdx = 0, charIdx = 0, isDeleting = false;

  function runTyping() {
    if (!targetEl) return;
    const currentQuery = queryList[qIdx];

    if (!isDeleting) {
      charIdx++;
      targetEl.textContent = currentQuery.slice(0, charIdx);
      if (charIdx >= currentQuery.length) {
        isDeleting = true;
        setTimeout(runTyping, 1800);
        return;
      }
      setTimeout(runTyping, 50);
    } else {
      charIdx--;
      targetEl.textContent = currentQuery.slice(0, charIdx);
      if (charIdx <= 0) {
        isDeleting = false;
        qIdx = (qIdx + 1) % queryList.length;
        setTimeout(runTyping, 300);
        return;
      }
      setTimeout(runTyping, 25);
    }
  }
  runTyping();

  // 3. 3D Card Hover Effect on Preview Container
  const cardPreview = document.querySelector('.hero-card-preview');
  if (cardPreview) {
    cardPreview.addEventListener('mousemove', (e) => {
      const rect = cardPreview.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      cardPreview.style.transform = `perspective(1000px) rotateX(${-y / 20}deg) rotateY(${x / 20}deg)`;
    });

    cardPreview.addEventListener('mouseleave', () => {
      cardPreview.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  }

});
