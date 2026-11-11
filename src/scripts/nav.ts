/** Mobile menu disclosure, current-section highlight and scroll reveals. */
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.getElementById('mobile-menu');

function setMenu(open: boolean) {
  if (!toggle || !menu) return;
  toggle.setAttribute('aria-expanded', String(open));
  menu.hidden = !open;
}

toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
menu?.addEventListener('click', (event) => {
  if ((event.target as Element).closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    toggle.focus();
  }
});
document.addEventListener('click', (event) => {
  if (!(event.target as Element).closest('[data-nav]')) setMenu(false);
});
window.matchMedia('(min-width: 64rem)').addEventListener('change', () => setMenu(false));

// Highlight the section currently in view (home page only).
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
const sections = new Map<Element, string>();
for (const link of links) {
  const id = new URL(link.href).hash.slice(1);
  const section = id && location.pathname === '/' ? document.getElementById(id) : null;
  if (section) sections.set(section, id);
}

if (sections.size > 0) {
  const visible = new Set<string>();
  const order = [...sections.values()];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = sections.get(entry.target)!;
        if (entry.isIntersecting) visible.add(id);
        else visible.delete(id);
      }
      // When several sections overlap the band, the one furthest down wins.
      const current = order.filter((id) => visible.has(id)).at(-1);
      for (const link of links) {
        if (new URL(link.href).hash.slice(1) === current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((_, section) => observer.observe(section));
}

// Reveal marked elements as they scroll into view. Elements already on
// screen at load are left alone, and nothing is hidden without JavaScript.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduced) {
  const revealer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('reveal-in');
        entry.target.classList.remove('reveal-pending');
        revealer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if (el.getBoundingClientRect().top < window.innerHeight) continue;
    el.classList.add('reveal-pending');
    revealer.observe(el);
  }
}
