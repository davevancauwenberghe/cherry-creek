/** Fills in every [data-status] card from /api/status and keeps it fresh. */
interface PublicStatus {
  state: 'online' | 'offline' | 'unavailable' | 'disabled';
  players: { online: number; max: number } | null;
  version: string | null;
  checkedAt: string;
  lastSuccessAt: string | null;
  ttl: number;
  activity: {
    since: string;
    peak: number;
    low: number;
    buckets: (number | null)[];
  } | null;
}

const cards = [...document.querySelectorAll<HTMLElement>('[data-status]')];
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

let latest: PublicStatus | null = null;
let failed = false;
let nextCheck = 0;
let timer = 0;

function ago(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (seconds > -10) return 'just now';
  if (seconds > -60) return relative.format(Math.round(seconds / 10) * 10, 'second');
  if (seconds > -3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (seconds > -86400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86400), 'day');
}

function timeEl(iso: string): HTMLTimeElement {
  const time = document.createElement('time');
  time.dateTime = iso;
  time.title = new Date(iso).toLocaleString();
  time.textContent = ago(iso);
  return time;
}

const LABELS: Record<PublicStatus['state'] | 'error', string> = {
  online: 'Online',
  offline: 'Offline',
  unavailable: 'Status unavailable',
  disabled: 'Status not shown',
  error: 'Status unavailable',
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Sparkline of anonymous player counts the website has observed. */
function renderActivity(card: HTMLElement) {
  const box = card.querySelector<HTMLElement>('[data-status-activity]');
  if (!box) return;
  const activity = failed ? null : latest?.activity;
  box.hidden = !activity;
  if (!activity) return;

  const plural = (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`;
  const summary = box.querySelector('[data-activity-summary]');
  if (summary) {
    summary.textContent =
      activity.peak === activity.low
        ? `Steady at ${plural(activity.peak)}`
        : `Peak ${activity.peak}, low ${activity.low}`;
  }
  const range = box.querySelector('[data-activity-range]');
  if (range) {
    // The record restarts with the website, so say how far back it really goes.
    const full = Date.now() - new Date(activity.since).getTime() > DAY_MS - 45 * 60 * 1000;
    range.replaceChildren(
      full ? 'Last 24 hours' : 'Players since ',
      ...(full ? [] : [timeEl(activity.since)]),
    );
  }

  const chart = box.querySelector('[data-activity-chart]');
  if (!chart) return;
  const scale = Math.max(activity.peak, 1);
  const width = 192 / activity.buckets.length;
  chart.replaceChildren(
    ...activity.buckets.flatMap((value, i) => {
      if (value === null) return [];
      const bar = document.createElementNS(SVG_NS, 'rect');
      // Empty half hours keep a low stub so quiet time reads differently from no data.
      const height = value === 0 ? 2 : 4 + (value / scale) * 28;
      bar.setAttribute('x', String(i * width + 0.5));
      bar.setAttribute('y', String(32 - height));
      bar.setAttribute('width', String(width - 1));
      bar.setAttribute('height', String(height));
      if (value === 0) bar.setAttribute('data-empty', '');
      return [bar];
    }),
  );
}

function render() {
  const state = failed || !latest ? 'error' : latest.state;
  for (const card of cards) {
    card.dataset.state = state === 'error' ? 'unavailable' : state;

    const label = card.querySelector('[data-status-label]');
    // Only touch the live region when the wording changes, so screen readers
    // are not interrupted on every refresh.
    if (label && label.textContent !== LABELS[state]) label.textContent = LABELS[state];

    const players = card.querySelector('[data-status-players]');
    if (players) {
      players.textContent =
        latest?.players && !failed ? `${latest.players.online} / ${latest.players.max}` : '–';
    }
    const version = card.querySelector('[data-status-version]');
    if (version) version.textContent = (!failed && latest?.version) || '–';

    renderActivity(card);

    const note = card.querySelector('[data-status-note]');
    if (!note) continue;
    if (state === 'disabled') {
      note.replaceChildren('Live status is switched off for this site.');
    } else if (state === 'online' && latest) {
      note.replaceChildren('Checked ', timeEl(latest.checkedAt));
    } else if (latest?.lastSuccessAt) {
      note.replaceChildren('Last successful check ', timeEl(latest.lastSuccessAt));
    } else if (state === 'offline') {
      note.replaceChildren('The server is not accepting connections right now.');
    } else {
      note.replaceChildren('Could not reach the server just now. Trying again shortly.');
    }
  }
}

async function check() {
  window.clearTimeout(timer);
  let ttl = 45;
  try {
    const response = await fetch('/api/status', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    latest = (await response.json()) as PublicStatus;
    failed = false;
    ttl = latest.ttl;
  } catch {
    failed = true;
  }
  render();
  if (latest?.state === 'disabled') return;
  const wait = Math.max(30, Math.min(ttl, 300)) * 1000;
  nextCheck = Date.now() + wait;
  if (!document.hidden) timer = window.setTimeout(check, wait);
}

if (cards.length > 0) {
  check();
  // Keep "x seconds ago" honest between checks.
  window.setInterval(() => {
    if (!document.hidden && latest) render();
  }, 10_000);
  // Pause while the tab is hidden; catch up when it comes back.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return window.clearTimeout(timer);
    if (latest?.state === 'disabled') return;
    if (Date.now() >= nextCheck) check();
    else timer = window.setTimeout(check, nextCheck - Date.now());
  });
}
