// theme.js — wires up the light/dark toggle button.
//
// The initial theme is already applied by the inline script in <head>
// (that one runs before first paint, to avoid a flash of the wrong
// theme). This file only handles what happens when the user clicks the
// toggle: flip the data-theme attribute, remember the choice.

(function () {
  var toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  toggle.addEventListener('click', function () {
    var root = document.documentElement;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
})();
