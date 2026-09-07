// Applies the saved theme before first paint so dark mode does not flash white.
// 'system' (default) follows prefers-color-scheme; 'light' / 'dark' are explicit.
(function () {
  try {
    var pref = localStorage.getItem('theme') || 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) { /* storage blocked: stay light */ }
})();
