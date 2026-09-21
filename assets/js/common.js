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

document.addEventListener('DOMContentLoaded', function () {
    var githubStarCache = {};

    document.querySelectorAll('[data-github-repo]').forEach(function (button) {
        var repo = button.getAttribute('data-github-repo');
        if (!repo) return;

        if (!githubStarCache[repo]) {
            var encodedRepo = repo.split('/').map(encodeURIComponent).join('/');
            githubStarCache[repo] = fetch('https://api.github.com/repos/' + encodedRepo, {
                headers: { 'Accept': 'application/vnd.github+json' }
            }).then(function (response) {
                if (!response.ok) throw new Error('GitHub API request failed');
                return response.json();
            });
        }

        githubStarCache[repo].then(function (data) {
            if (typeof data.stargazers_count !== 'number') return;
            var count = button.querySelector('[data-github-star-count]');
            var stars = button.querySelector('[data-github-stars]');
            if (!count || !stars) return;

            count.textContent = data.stargazers_count.toLocaleString('en-US');
            stars.hidden = false;
        }).catch(function () {
            // Keep the Code button usable even when the unauthenticated GitHub API is rate-limited.
        });
    });
});
