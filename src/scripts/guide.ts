/** Player guide: checklist, claim planner, command finder and contents highlight. */
import { planClaim, type ClaimLimits, type ClaimPlan } from '@/lib/claims.ts';

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
  const limits: ClaimLimits = {
    startingBlocks: number('start'),
    blocksPerHour: number('perHour'),
    maxAccruedBlocks: number('maxAccrued'),
    minWidth: number('minWidth'),
    minArea: number('minArea'),
    blockPrice: number('price'),
  };

  const width = planner.querySelector<HTMLInputElement>('[data-planner-width]')!;
  const length = planner.querySelector<HTMLInputElement>('[data-planner-length]')!;
  const hours = planner.querySelector<HTMLInputElement>('[data-planner-hours]')!;
  const starter = planner.querySelector<HTMLInputElement>('[data-planner-starter]');
  const starterArea = number('starterArea');
  const hoursOut = planner.querySelector('[data-planner-hours-out]')!;
  const needs = planner.querySelector('[data-planner-needs]')!;
  const has = planner.querySelector('[data-planner-has]')!;
  const verdict = planner.querySelector<HTMLElement>('[data-planner-verdict]')!;

  const format = (n: number) => n.toLocaleString('en-GB');
  const blocksText = (n: number) => `${format(n)} ${n === 1 ? 'block' : 'blocks'}`;
  const hoursText = (n: number) => `${format(n)} more ${n === 1 ? 'hour' : 'hours'} of play`;
  const side = (input: HTMLInputElement) =>
    Math.min(500, Math.max(0, Math.floor(Number(input.value)) || 0));

  const describe = (plan: ClaimPlan): string => {
    if (!plan.ok) {
      return plan.reason === 'too-narrow'
        ? `Too narrow. A claim must be at least ${limits.minWidth} blocks wide on every side.`
        : `Too small. A claim must cover at least ${format(limits.minArea)} blocks, for example 10 × 10.`;
    }
    if (plan.short === 0) return 'It fits exactly. Every block you have goes into this claim.';
    if (plan.short < 0) return `It fits, with ${blocksText(-plan.short)} to spare.`;

    const buyAll = `€${format(plan.costToBuy)} with /buyclaimblocks ${plan.short}`;
    if (plan.hoursToEarn !== null) {
      return `You're ${blocksText(plan.short)} short. That's about ${hoursText(plan.hoursToEarn)}, or ${buyAll}.`;
    }
    // Playing can never cover this: say so instead of quoting impossible hours.
    const limit = `Playing earns at most ${format(limits.maxAccruedBlocks)} blocks`;
    return plan.earnable === 0
      ? `You're ${blocksText(plan.short)} short. ${limit} and you've reached that, so the rest has to be bought: ${buyAll}.`
      : `You're ${blocksText(plan.short)} short. ${limit}, so even after earning the remaining ${format(plan.earnable)} you would have to buy ${format(plan.mustBuy)}. Buying the whole shortfall today costs ${buyAll}.`;
  };

  const calculate = () => {
    const used = starter?.checked ? starterArea : 0;
    const plan = planClaim(side(width), side(length), Number(hours.value), limits, used);
    hoursOut.textContent = hours.value;
    needs.textContent = plan.ok ? format(plan.area) : '–';
    has.textContent = format(plan.owned);
    verdict.textContent = describe(plan);
    verdict.toggleAttribute('data-short', !plan.ok || plan.short > 0);
    for (const input of [width, length]) {
      input.setAttribute('aria-invalid', String(!plan.ok));
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
