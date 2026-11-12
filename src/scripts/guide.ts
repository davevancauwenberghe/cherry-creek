/** Player guide: checklist, claim planner, command finder and contents highlight. */

// ---- First-day checklist ---------------------------------------------------
const STORAGE_KEY = 'cherry-creek:first-day';
const checklist = document.querySelector<HTMLElement>('[data-checklist]');

if (checklist) {
  const boxes = [...checklist.querySelectorAll<HTMLInputElement>('[data-step]')];
  const countEl = checklist.querySelector('[data-checklist-count]');
  const bar = checklist.querySelector<HTMLElement>('[data-checklist-bar]');
  const message = checklist.querySelector('[data-checklist-message]');
  const reset = checklist.querySelector<HTMLButtonElement>('[data-checklist-reset]');

  // Storage can be unavailable (private mode, blocked): the list still works.
  const load = (): string[] => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
    } catch {
      return [];
    }
  };
  const save = (done: string[]) => {
    try {
      if (done.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* not remembered this time */
    }
  };

  const update = () => {
    const done = boxes.filter((box) => box.checked).length;
    if (countEl) countEl.textContent = String(done);
    if (bar) bar.style.width = `${(done / boxes.length) * 100}%`;
    if (reset) reset.hidden = done === 0;
    if (message) {
      message.textContent =
        done === boxes.length
          ? "That's everything. Welcome to Cherry Creek!"
          : 'Tick things off as you go. Your browser remembers them.';
    }
  };

  const saved = new Set(load());
  for (const box of boxes) box.checked = saved.has(box.dataset.step ?? '');
  update();

  checklist.addEventListener('change', () => {
    save(boxes.filter((box) => box.checked).map((box) => box.dataset.step ?? ''));
    update();
  });
  reset?.addEventListener('click', () => {
    for (const box of boxes) box.checked = false;
    save([]);
    update();
    boxes[0]?.focus();
  });
}

// ---- Claim planner ---------------------------------------------------------
const planner = document.querySelector<HTMLElement>('[data-planner]');

if (planner) {
  const number = (key: string) => Number(planner.dataset[key]);
  const start = number('start');
  const perHour = number('perHour');
  const maxAccrued = number('maxAccrued');
  const price = number('price');

  const width = planner.querySelector<HTMLInputElement>('[data-planner-width]')!;
  const length = planner.querySelector<HTMLInputElement>('[data-planner-length]')!;
  const hours = planner.querySelector<HTMLInputElement>('[data-planner-hours]')!;
  const hoursOut = planner.querySelector('[data-planner-hours-out]')!;
  const needs = planner.querySelector('[data-planner-needs]')!;
  const has = planner.querySelector('[data-planner-has]')!;
  const verdict = planner.querySelector<HTMLElement>('[data-planner-verdict]')!;

  const format = (n: number) => n.toLocaleString('en-GB');
  const side = (input: HTMLInputElement) =>
    Math.min(500, Math.max(1, Math.floor(Number(input.value)) || 1));

  const calculate = () => {
    const area = side(width) * side(length);
    const played = Number(hours.value);
    const owned = start + Math.min(played * perHour, maxAccrued);
    const short = area - owned;

    hoursOut.textContent = String(played);
    needs.textContent = format(area);
    has.textContent = format(owned);

    if (short <= 0) {
      verdict.removeAttribute('data-short');
      verdict.textContent =
        short === 0
          ? 'It fits exactly. Every block you have goes into this claim.'
          : `It fits, with ${format(-short)} blocks to spare.`;
    } else {
      const moreHours = Math.ceil(short / perHour);
      verdict.setAttribute('data-short', '');
      verdict.textContent = `You're ${format(short)} blocks short. That's about ${format(moreHours)} more ${
        moreHours === 1 ? 'hour' : 'hours'
      } of play, or €${format(short * price)} with /buyclaimblocks ${short}.`;
    }
  };

  planner.addEventListener('input', calculate);
  planner.hidden = false;
  calculate();
}

// ---- Command finder --------------------------------------------------------
const finder = document.querySelector<HTMLElement>('[data-finder]');

if (finder) {
  const controls = finder.querySelector<HTMLElement>('[data-finder-controls]');
  const search = finder.querySelector<HTMLInputElement>('[data-finder-search]');
  const chips = [...finder.querySelectorAll<HTMLButtonElement>('[data-finder-category]')];
  const rows = [...finder.querySelectorAll<HTMLElement>('[data-finder-row]')];
  const countEl = finder.querySelector('[data-finder-count]');
  let category = '';

  const apply = () => {
    const words = (search?.value ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const row of rows) {
      const text = row.dataset.text ?? '';
      const match =
        (!category || row.dataset.category === category) && words.every((w) => text.includes(w));
      row.hidden = !match;
      if (match) shown++;
    }
    if (countEl) {
      countEl.textContent =
        shown === 0
          ? 'No commands match. Try a shorter search, or ask on Discord.'
          : `${shown} ${shown === 1 ? 'command' : 'commands'}. Select one to copy it.`;
    }
  };

  search?.addEventListener('input', apply);
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      category = chip.dataset.finderCategory ?? '';
      for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
      apply();
    });
  }
  if (controls) controls.hidden = false;
}

// ---- Contents: highlight the section being read ----------------------------
const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc] a')];
const targets = new Map<Element, HTMLAnchorElement>();
for (const link of tocLinks) {
  const section = document.getElementById(link.hash.slice(1));
  if (section) targets.set(section, link);
}

if (targets.size > 0) {
  const order = [...targets.keys()];
  const setCurrent = () => {
    // The last heading that has passed the top third of the screen.
    const line = window.innerHeight * 0.33;
    let current = order[0]!;
    for (const section of order) {
      if (section.getBoundingClientRect().top <= line) current = section;
    }
    for (const [section, link] of targets) {
      if (section === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  };
  let queued = false;
  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setCurrent();
      });
    },
    { passive: true },
  );
  setCurrent();
}
