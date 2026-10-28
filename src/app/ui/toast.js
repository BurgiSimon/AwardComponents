// One polite toast at a time, announced through a live region.
let box = null;
let timer = 0;

// The live region exists from start-up: screen readers skip text inserted together with its region.
export function initToast() {
  if (box) return;
  box = document.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  document.body.append(box);
}

export function toast(message, { icon = '' } = {}) {
  initToast();
  box.innerHTML = `${icon}<span></span>`;
  box.querySelector('span').textContent = message;
  box.classList.add('is-on');
  clearTimeout(timer);
  timer = setTimeout(() => box.classList.remove('is-on'), 2200);
}
