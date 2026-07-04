// Small DOM helpers. Browser only — keep js/lib free of this.

/** Hyperscript-ish element builder. attrs: class, dataset, on* handlers, etc. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open') el[k] = Boolean(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(child));
  }
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/**
 * Append children to an existing element, skipping null/false with the same
 * rules h() uses for its children. Prefer this over a raw `parent.append(...)`
 * whenever a child can be conditional (`cond ? node : null`) or come from a
 * function that may return null — a bare `append(null)` renders the literal
 * string "null" in the DOM.
 */
export function mount(parent, ...children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.append(child.nodeType ? child : document.createTextNode(child));
  }
  return parent;
}

let toastHost = null;
export function toast(message, kind = 'info', ms = 3500) {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const t = h('div', { class: `toast toast--${kind}` }, message);
  toastHost.append(t);
  setTimeout(() => {
    t.classList.add('toast--out');
    setTimeout(() => t.remove(), 400);
  }, ms);
}

export function download(filename, text, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.click();
  });
}

let confirmDialogEl = null;
function getConfirmDialog() {
  if (!confirmDialogEl) confirmDialogEl = document.getElementById('confirm-dialog');
  return confirmDialogEl;
}

/**
 * In-app replacement for window.confirm — native dialogs are unstylable,
 * break the brand, and are suppressed in some kiosk/webview contexts
 * (AAR Studio hero review 2026-07-03, AAR-2). Resolves true/false.
 */
export function confirmDanger(message, { confirmLabel = 'Delete', cancelLabel = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    const dialog = getConfirmDialog();
    clear(dialog);
    dialog.append(
      h('form', { method: 'dialog' },
        h('p', { class: 'dialog__message' }, message),
        h('div', { class: 'dialog__actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => { dialog.close(); resolve(false); } }, cancelLabel),
          h('button', { class: 'btn btn--danger', type: 'button', onclick: () => { dialog.close(); resolve(true); } }, confirmLabel),
        ),
      ),
    );
    dialog.showModal();
  });
}

/**
 * In-app replacement for window.prompt (AAR-2). Resolves the trimmed value on
 * submit, or null if cancelled/closed (Escape, backdrop, Cancel button).
 */
export function promptDialog(message, defaultValue = '', { confirmLabel = 'Save' } = {}) {
  return new Promise((resolve) => {
    const dialog = getConfirmDialog();
    clear(dialog);
    const input = h('input', { type: 'text', value: defaultValue });
    let resolved = false;
    dialog.addEventListener('close', () => { if (!resolved) resolve(null); }, { once: true });
    dialog.append(
      h('form', {
        method: 'dialog',
        onsubmit: () => { resolved = true; resolve(input.value.trim()); },
      },
        h('p', { class: 'dialog__message' }, message),
        input,
        h('div', { class: 'dialog__actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
          h('button', { class: 'btn btn--primary', type: 'submit' }, confirmLabel),
        ),
      ),
    );
    dialog.showModal();
    input.focus();
    input.select();
  });
}
