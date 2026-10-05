(function() {
    'use strict';

    var modal = document.getElementById('award-preview-modal');
    if (!modal) return;

    var triggers = Array.prototype.slice.call(document.querySelectorAll('.award-preview-trigger[data-award-source]'));
    if (!triggers.length) return;

    var pagesContainer = document.getElementById('award-preview-pages');
    var statusElement = document.getElementById('award-preview-status');
    var titleElement = document.getElementById('award-preview-title');
    var metaElement = document.getElementById('award-preview-meta');
    var closeButton = modal.querySelector('.award-preview-close');
    var manifestUrl = modal.getAttribute('data-manifest-url');
    var manifestPromise = null;
    var previouslyFocused = null;

    function isChinese() {
        return document.documentElement.classList.contains('lang-active-zh');
    }

    function text(en, zh) {
        return isChinese() ? zh : en;
    }

    function showStatus(message) {
        pagesContainer.textContent = '';
        statusElement.textContent = message;
        statusElement.classList.add('is-visible');
    }

    function hideStatus() {
        statusElement.textContent = '';
        statusElement.classList.remove('is-visible');
    }

    function loadManifest() {
        if (!manifestPromise) {
            manifestPromise = fetch(manifestUrl + '?v=20261005-1', {
                cache: 'no-cache',
                credentials: 'same-origin'
            }).then(function(response) {
                if (!response.ok) {
                    throw new Error('Award preview manifest is unavailable.');
                }
                return response.json();
            }).catch(function(error) {
                manifestPromise = null;
                throw error;
            });
        }
        return manifestPromise;
    }

    function renderPages(entry, title) {
        var pages = entry && Array.isArray(entry.pages) ? entry.pages : [];
        if (!pages.length) {
            showStatus(text('Preview is unavailable for this certificate.', '该奖状暂无预览。'));
            metaElement.textContent = '';
            return;
        }

        hideStatus();
        pagesContainer.textContent = '';
        metaElement.textContent = pages.length === 1
            ? text('1 page', '共 1 页')
            : text(pages.length + ' pages', '共 ' + pages.length + ' 页');

        pages.forEach(function(src, index) {
            var figure = document.createElement('figure');
            figure.className = 'award-preview-page';

            var frame = document.createElement('div');
            frame.className = 'award-preview-page-frame';

            var image = document.createElement('img');
            image.src = src;
            image.alt = title + ' - ' + text('page ', '第 ') + (index + 1) + text(' of ', ' / ') + pages.length;
            image.loading = index === 0 ? 'eager' : 'lazy';
            image.decoding = 'async';
            image.draggable = false;
            image.addEventListener('contextmenu', function(event) {
                event.preventDefault();
            });

            frame.appendChild(image);
            figure.appendChild(frame);

            if (pages.length > 1) {
                var caption = document.createElement('figcaption');
                caption.textContent = isChinese()
                    ? '第 ' + (index + 1) + ' / ' + pages.length + ' 页'
                    : 'Page ' + (index + 1) + ' / ' + pages.length;
                figure.appendChild(caption);
            }

            pagesContainer.appendChild(figure);
        });

        pagesContainer.scrollTop = 0;
    }

    function openPreview(trigger) {
        var source = trigger.getAttribute('data-award-source');
        var title = isChinese()
            ? trigger.getAttribute('data-award-title-zh')
            : trigger.getAttribute('data-award-title-en');

        previouslyFocused = document.activeElement;
        titleElement.textContent = title || '';
        metaElement.textContent = '';
        showStatus(text('Loading certificate preview...', '正在加载奖状预览...'));

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('award-preview-open');

        window.requestAnimationFrame(function() {
            closeButton.focus();
        });

        loadManifest().then(function(manifest) {
            var entries = manifest && manifest.awards ? manifest.awards : {};
            var entry = entries[source];
            if (!entry) {
                showStatus(text('Preview is unavailable for this certificate.', '该奖状暂无预览。'));
                return;
            }
            renderPages(entry, title || 'Certificate');
        }).catch(function() {
            showStatus(text('Preview could not be loaded. Please try again later.', '预览加载失败，请稍后再试。'));
        });
    }

    function closePreview() {
        if (!modal.classList.contains('is-open')) return;

        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('award-preview-open');
        pagesContainer.textContent = '';
        hideStatus();
        metaElement.textContent = '';

        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
            previouslyFocused.focus();
        }
        previouslyFocused = null;
    }

    triggers.forEach(function(trigger) {
        trigger.addEventListener('click', function() {
            openPreview(trigger);
        });
    });

    modal.querySelectorAll('[data-award-preview-close]').forEach(function(element) {
        element.addEventListener('click', closePreview);
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) {
            closePreview();
        }
    });
})();
