/** Copy-to-clipboard buttons: any element with [data-copy="text"]. */
const announcer = document.getElementById('announcer');
const timers = new WeakMap<Element, number>();

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers or non-secure contexts.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function announce(message: string) {
  if (!announcer) return;
  // Clear first so repeating the same message is announced again.
  announcer.textContent = '';
  requestAnimationFrame(() => (announcer.textContent = message));
}

document.addEventListener('click', async (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>('[data-copy]');
  if (!button) return;

  const text = button.dataset.copy ?? '';
  const label = button.querySelector<HTMLElement>('[data-copy-label]');
  const ok = await copyText(text);

  if (ok) button.setAttribute('data-copied', '');
  if (label) label.textContent = ok ? 'Copied' : 'Copy failed';
  announce(ok ? `Copied ${text.trim()} to the clipboard` : `Could not copy ${text.trim()}`);

  window.clearTimeout(timers.get(button));
  timers.set(
    button,
    window.setTimeout(() => {
      button.removeAttribute('data-copied');
      if (label) label.textContent = label.dataset.labelDefault ?? 'Copy';
    }, 2200),
  );
});
