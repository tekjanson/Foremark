// public/js/ui/toast.js
// Lightweight notification toasts.

let stack = null;

function ensureStack() {
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export function toast(message, type = 'info', timeout = 3200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${ICONS[type] || 'ℹ'}</span><span class="toast-msg"></span>`;
  el.querySelector('.toast-msg').textContent = message;
  ensureStack().appendChild(el);

  const remove = () => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s';
    setTimeout(() => el.remove(), 200);
  };
  const timer = setTimeout(remove, timeout);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
  return el;
}

toast.success = (m, t) => toast(m, 'success', t);
toast.error = (m, t) => toast(m, 'error', t ?? 5000);
toast.info = (m, t) => toast(m, 'info', t);
