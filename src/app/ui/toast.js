// One polite toast at a time, announced through a live region.
let box = null;
let timer = 0;

export function toast(message, { icon = '' } = {}) {
  if (!box) {
    box = document.createElement('div');
    box.className = 'toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  box.innerHTML = `${icon}<span></span>`;
  box.querySelector('span').textContent = message;
  box.classList.add('is-on');
  clearTimeout(timer);
  timer = setTimeout(() => box.classList.remove('is-on'), 2200);
}
