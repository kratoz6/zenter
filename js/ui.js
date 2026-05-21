// HallMate — DOM helpers, shared component loader, toast + loader primitives.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(el, event, handler, options) {
  if (!el) return noop;
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

const noop = () => {};

// Fetches an HTML partial and injects it into every element matching `selector`.
// Used by pages to mount the shared navbar + footer.
export async function mountPartial(selector, url) {
  const targets = $$(selector);
  if (targets.length === 0) return;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const html = await res.text();
    targets.forEach((node) => { node.innerHTML = html; });
  } catch (err) {
    console.error('[ui] mountPartial failed', err);
  }
}

// Loads the navbar + footer in parallel into their mount points.
export function mountChrome() {
  return Promise.all([
    mountPartial('[data-include="navbar"]', '/components/navbar.html'),
    mountPartial('[data-include="footer"]', '/components/footer.html'),
  ]);
}

// --- Toast --------------------------------------------------------------------
let toastRoot;
function ensureToastRoot() {
  if (toastRoot) return toastRoot;
  toastRoot = document.createElement('div');
  toastRoot.className = 'hm-toast-container';
  toastRoot.setAttribute('aria-live', 'polite');
  toastRoot.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toastRoot);
  return toastRoot;
}

export function toast(message, { variant = 'info', duration = 3200 } = {}) {
  const root = ensureToastRoot();
  const el = document.createElement('div');
  el.className = `hm-toast hm-toast--${variant}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 220);
  }, duration);
}

// --- Full-screen loader -------------------------------------------------------
let loaderEl;
export function showLoader(label = 'Loading…') {
  if (loaderEl) { loaderEl.querySelector('.hm-loader__label').textContent = label; return; }
  loaderEl = document.createElement('div');
  loaderEl.className = 'hm-loader-overlay';
  loaderEl.innerHTML = `
    <div class="hm-loader" role="status" aria-live="polite">
      <div class="hm-loader__spinner" aria-hidden="true"></div>
      <div class="hm-loader__label">${label}</div>
    </div>`;
  document.body.appendChild(loaderEl);
}
export function hideLoader() {
  if (!loaderEl) return;
  loaderEl.remove();
  loaderEl = null;
}

// Toggle button busy state — disables and swaps in a spinner without losing label.
export function setButtonBusy(btn, busy, busyLabel) {
  if (!btn) return;
  if (busy) {
    btn.dataset.originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${busyLabel ?? 'Please wait…'}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalLabel) {
      btn.innerHTML = btn.dataset.originalLabel;
      delete btn.dataset.originalLabel;
    }
  }
}

// Highlights the active navbar link based on `data-route` attributes.
export function highlightActiveNav(route) {
  $$('[data-route]').forEach((el) => {
    el.classList.toggle('active', el.dataset.route === route);
  });
}
