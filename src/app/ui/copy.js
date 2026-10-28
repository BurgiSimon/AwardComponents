// Clipboard with a fallback for insecure contexts, and a button helper that flips to "Copied".
import { icon } from '../icons.js';
import { toast } from './toast.js';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export function bindCopy(button, getText, { message = 'Copied to the clipboard' } = {}) {
  const label = button.querySelector('[data-label]');
  const original = label?.textContent;
  button.addEventListener('click', async () => {
    const ok = await copyText(typeof getText === 'function' ? getText() : getText);
    if (!ok) { toast('Copy failed — select the text and copy it by hand'); return; }
    button.classList.add('is-copied');
    if (label) label.textContent = 'Copied';
    toast(message, { icon: icon('check') });
    setTimeout(() => {
      button.classList.remove('is-copied');
      if (label) label.textContent = original;
    }, 1600);
  });
}
