$(function () {
    $('.lazy').Lazy({
        scrollDirection: 'vertical',
        effect: 'fadeIn',
        effectTime: 300,
        visibleOnly: true,
        placeholder: "",
        onError: function(element) {
            console.log('[lazyload] Error loading ' + element.data('src'));
        }
    })
    $('[data-toggle="tooltip"]').tooltip()
})

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-collapsible-toggle]').forEach(function (button) {
        button.addEventListener('click', function () {
            var target = button.getAttribute('data-collapsible-toggle');
            var list = document.querySelector('[data-collapsible-list="' + target + '"]');
            if (!list) return;

            var expanded = button.getAttribute('aria-expanded') === 'true';
            list.querySelectorAll('[data-collapsible-extra]').forEach(function (item) {
                item.classList.toggle('d-none', expanded);
            });
            list.classList.toggle('is-expanded', !expanded);

            button.setAttribute('aria-expanded', String(!expanded));
            button.querySelector('[data-collapsible-more]').classList.toggle('d-none', !expanded);
            button.querySelector('[data-collapsible-less]').classList.toggle('d-none', expanded);
        });
    });
});

// GitHub stars: use Shields.io as the public data source and cache counts locally.
(function () {
    var REFRESH_MS = 30 * 60 * 1000;
    var CACHE_PREFIX = 'shengxiang-lin:github-stars:';
    var inFlight = {};

    function getTrackers() {
        return document.querySelectorAll('[data-github-repo]');
    }

    function normalizeCount(value) {
        if (typeof value === 'number') {
            if (!isFinite(value) || value < 0) return null;
            return Math.floor(value).toLocaleString('en-US');
        }

        if (typeof value !== 'string') return null;
        var raw = value.trim();
        if (!raw) return null;

        if (/^\d+$/.test(raw)) {
            return Number(raw).toLocaleString('en-US');
        }

        // Shields may abbreviate larger values, e.g. 1.2k.
        if (/^\d+(?:\.\d+)?[kKmMbBtT]$/.test(raw)) {
            return raw;
        }

        return null;
    }

    function renderCount(repo, value) {
        var formatted = normalizeCount(value);
        if (!formatted) return;

        getTrackers().forEach(function (button) {
            if (button.getAttribute('data-github-repo') !== repo) return;

            var count = button.querySelector('[data-github-star-count]');
            var stars = button.querySelector('[data-github-stars]');
            if (!count || !stars) return;

            count.textContent = formatted;
            stars.setAttribute('aria-label', formatted + ' GitHub stars');
            stars.hidden = false;
        });
    }

    function readCache(repo) {
        try {
            var cached = JSON.parse(localStorage.getItem(CACHE_PREFIX + repo));
            if (!cached || !normalizeCount(cached.count) ||
                typeof cached.updatedAt !== 'number') {
                return null;
            }
            return cached;
        } catch (error) {
            return null;
        }
    }

    function writeCache(repo, value) {
        var formatted = normalizeCount(value);
        if (!formatted) return;

        try {
            localStorage.setItem(CACHE_PREFIX + repo, JSON.stringify({
                count: formatted,
                updatedAt: Date.now()
            }));
        } catch (error) {
            // Star counts still work if storage is blocked; they just are not cached.
        }
    }

    function fetchCount(repo) {
        if (inFlight[repo]) return inFlight[repo];
        if (typeof window.fetch !== 'function') return null;

        var encodedRepo = repo.split('/').map(encodeURIComponent).join('/');
        var request = fetch('https://img.shields.io/github/stars/' + encodedRepo + '.json', {
            credentials: 'omit'
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('Shields star request failed');
            }
            return response.json();
        }).then(function (data) {
            var value = data && data.value;
            var formatted = normalizeCount(value);
            if (!formatted) {
                throw new Error('Invalid Shields star count');
            }

            renderCount(repo, formatted);
            writeCache(repo, formatted);
            return formatted;
        });

        inFlight[repo] = request.then(function (value) {
            delete inFlight[repo];
            return value;
        }, function () {
            delete inFlight[repo];
            return null;
        });

        return inFlight[repo];
    }

    function refreshCounts() {
        if (document.hidden) return;

        var now = Date.now();
        var reposToFetch = {};

        getTrackers().forEach(function (button) {
            var repo = button.getAttribute('data-github-repo');
            if (!repo) return;

            var cached = readCache(repo);
            if (cached) {
                // Render cached data immediately, even if it is stale.
                renderCount(repo, cached.count);
            }

            if (!cached || now - cached.updatedAt >= REFRESH_MS) {
                reposToFetch[repo] = true;
            }
        });

        Object.keys(reposToFetch).forEach(fetchCount);
    }

    function renderCachedCounts() {
        getTrackers().forEach(function (button) {
            var repo = button.getAttribute('data-github-repo');
            if (!repo) return;

            var cached = readCache(repo);
            if (cached) {
                renderCount(repo, cached.count);
            }
        });
    }

    function scheduleRefresh() {
        if (!getTrackers().length) return;

        var run = function () {
            refreshCounts();
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(run, { timeout: 2500 });
        } else {
            window.setTimeout(run, 350);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!getTrackers().length) return;

        // Cached values are local and can be rendered immediately without network work.
        renderCachedCounts();

        // Keep Shields traffic out of the critical rendering/loading path.
        if (document.readyState === 'complete') {
            scheduleRefresh();
        } else {
            window.addEventListener('load', scheduleRefresh, { once: true });
        }
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && getTrackers().length) {
            scheduleRefresh();
        }
    });
})();
