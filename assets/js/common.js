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
