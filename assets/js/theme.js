/* Site-wide light/dark theme toggle. */
(function () {
    var root = document.documentElement;
    var button = document.getElementById('site-theme-toggle');

    if (!button) return;

    var SUN =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4.2" fill="currentColor"></circle>' +
        '<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
        '<path d="M12 2.5v2.2"></path><path d="M12 19.3v2.2"></path>' +
        '<path d="M2.5 12h2.2"></path><path d="M19.3 12h2.2"></path>' +
        '<path d="M5.1 5.1l1.6 1.6"></path><path d="M17.3 17.3l1.6 1.6"></path>' +
        '<path d="M18.9 5.1l-1.6 1.6"></path><path d="M6.7 17.3l-1.6 1.6"></path>' +
        '</g></svg>';

    var MOON =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path fill="currentColor" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>' +
        '</svg>';

    function isDark() {
        return root.getAttribute('data-theme') === 'dark';
    }

    function syncButton() {
        var dark = isDark();
        button.innerHTML = dark ? SUN : MOON;
        button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        button.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }

    function setTheme(theme) {
        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
        }

        localStorage.setItem('site-theme', theme);
        syncButton();

        // Let visual widgets react if they need theme-specific rendering.
        window.dispatchEvent(new CustomEvent('site-theme-change', {
            detail: { theme: theme }
        }));
    }

    button.addEventListener('click', function () {
        setTheme(isDark() ? 'light' : 'dark');
    });

    syncButton();
})();
