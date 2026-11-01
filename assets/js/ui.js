(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal content as it enters the view.
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((element) => observer.observe(element));
  } else {
    reveals.forEach((element) => element.classList.add('is-in'));
  }

  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-stuck', scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('year').textContent = new Date().getFullYear();
})();
