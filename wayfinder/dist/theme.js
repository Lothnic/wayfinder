// Run before styles load so a saved dark theme doesn't flash light on startup.
(() => {
  const key = 'wayfinder.theme.v1';
  let current = 'light';
  try { if (localStorage.getItem(key) === 'dark') current = 'dark'; } catch {}

  function apply(theme) {
    current = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = current;
    document.documentElement.style.colorScheme = current;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', current === 'dark' ? '#141d2c' : '#7dd3f7');
    window.dispatchEvent(new Event('themechange'));
  }

  window.WayfinderTheme = {
    toggle() {
      apply(current === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, current); } catch { /* Theme still works without storage. */ }
    },
  };
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
  apply(current);
})();
