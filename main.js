document.addEventListener('DOMContentLoaded', () => {

  // Safe GSAP Initialization
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // Hero content entrance
    gsap.from(".hero-content > *", {
      opacity: 0,
      y: 30,
      duration: 0.8,
      stagger: 0.15,
      ease: "power2.out"
    });

    // Service cards scroll reveal
    gsap.from(".service-card", {
      scrollTrigger: {
        trigger: ".services-grid",
        start: "top 85%",
        toggleActions: "play none none none"
      },
      opacity: 0,
      y: 40,
      duration: 0.7,
      stagger: 0.12,
      ease: "power2.out"
    });

    // Person cards scroll reveal
    gsap.from(".person-card", {
      scrollTrigger: {
        trigger: ".people",
        start: "top 85%",
        toggleActions: "play none none none"
      },
      opacity: 0,
      y: 30,
      duration: 0.8,
      stagger: 0.2,
      ease: "power2.out"
    });

    // Refresh triggers to compute accurate card positions
    ScrollTrigger.refresh();
  } else {
    // If GSAP fails to load from CDN, keep elements visible
    document.querySelectorAll('.service-card, .person-card').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

});
