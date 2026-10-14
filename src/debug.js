// On-screen debug badge: proves the script is running and shows the path it
// sees, its last verdict and any error. Flip ENABLED to true when debugging.
// Styled through element.style (CSSOM), which page CSP doesn't block.
(function (root) {
  const ENABLED = false;
  let el = null;
  const state = { path: '', verdict: 'start', error: '' };

  function render() {
    if (!ENABLED) return;
    if (!el) {
      const parent = document.body || document.documentElement;
      if (!parent) return;
      el = document.createElement('div');
      const s = el.style;
      s.setProperty('position', 'fixed');
      s.setProperty('top', '4px');
      s.setProperty('left', '4px');
      s.setProperty('z-index', '2147483647');
      s.setProperty('background', '#c00');
      s.setProperty('color', '#fff');
      s.setProperty('font', '11px/1.3 -apple-system, sans-serif');
      s.setProperty('padding', '2px 6px');
      s.setProperty('border-radius', '4px');
      s.setProperty('pointer-events', 'none');
      s.setProperty('max-width', '90vw');
      parent.appendChild(el);
    }
    if (!el.isConnected) (document.body || document.documentElement).appendChild(el);
    el.textContent = `mf ${state.path} → ${state.verdict}${state.error ? ' ERR ' + state.error : ''}`;
  }

  function set(patch) {
    Object.assign(state, patch);
    render();
  }

  addEventListener('error', (e) => set({ error: String(e.message || e) }));
  setInterval(() => set({ path: location.pathname }), 500);

  root.MF = Object.assign(root.MF || {}, { debug: { set } });
})(globalThis);
