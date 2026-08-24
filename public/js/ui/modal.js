// public/js/ui/modal.js
// Dynamic modal builder with a promise-based API.

/**
 * Open a modal.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string|Node} opts.body   HTML string or DOM node
 * @param {boolean} [opts.wide]
 * @param {Array<{label:string,variant?:string,value?:any,keep?:boolean,onClick?:(ctx)=>any}>} [opts.actions]
 * @returns {{el:HTMLElement, close:(value?)=>void, promise:Promise<any>, body:HTMLElement}}
 */
export function openModal({ title, body, actions = [], wide = false, onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = `modal${wide ? ' wide' : ''}`;
  overlay.appendChild(modal);

  const head = document.createElement('div');
  head.className = 'modal-head';
  const h = document.createElement('h3');
  h.textContent = title || '';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost btn-icon';
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('aria-label', 'Close');
  head.append(h, closeBtn);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);

  modal.append(head, bodyEl);

  let resolveFn;
  const promise = new Promise((resolve) => (resolveFn = resolve));

  const close = (value) => {
    if (!overlay.isConnected) return;
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.(value);
    resolveFn(value);
  };

  if (actions.length) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.className = `btn ${a.variant ? `btn-${a.variant}` : ''}`;
      btn.textContent = a.label;
      btn.addEventListener('click', async () => {
        const result = a.onClick ? await a.onClick({ close, bodyEl, btn }) : undefined;
        if (!a.keep) close(a.value !== undefined ? a.value : result);
      });
      footer.appendChild(btn);
    }
    modal.appendChild(footer);
  }

  const onKey = (e) => {
    if (e.key === 'Escape') close(undefined);
  };
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', () => close(undefined));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(undefined);
  });

  document.body.appendChild(overlay);
  // Focus the first input if present.
  setTimeout(() => bodyEl.querySelector('input,textarea,select')?.focus(), 30);

  return { el: overlay, modal, body: bodyEl, close, promise };
}

/** Simple confirm dialog. Resolves true/false. */
export function confirmModal(message, { title = 'Confirm', danger = false } = {}) {
  const { promise } = openModal({
    title,
    body: `<p>${message}</p>`,
    actions: [
      { label: 'Cancel', value: false },
      { label: 'Confirm', variant: danger ? 'danger' : 'primary', value: true },
    ],
  });
  return promise;
}
