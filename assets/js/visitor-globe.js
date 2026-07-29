(function() {
    'use strict';

    var root = document.getElementById('visitor-community');
    if (!root) {
        return;
    }

    var apiBase = (root.getAttribute('data-api-base') || '').replace(/\/+$/, '');
    var globeElement = document.getElementById('visitor-globe');
    var loadingElement = document.getElementById('visitor-globe-loading');
    var badgeElement = document.getElementById('visitor-data-badge');
    var totalVisitsElement = document.getElementById('visitor-total-visits');
    var totalPlacesElement = document.getElementById('visitor-total-places');
    var countriesElement = document.getElementById('visitor-countries');
    var currentCountElement = document.getElementById('visitor-current-count');
    var listElement = document.getElementById('visitor-location-list');
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-visitor-tab]'));

    var WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
    var ACTIVE_WINDOW_MS = 5 * 60 * 1000;
    var currentTab = 'past';
    var latestStats = null;
    var globe = null;
    var resizeFrame = null;

    var markerColors = ['#ef7d83', '#f18a4a', '#f4b181', '#e96972', '#e99a62', '#d96f77'];

    var previewStats = {
        totalVisits: 0,
        places: 0,
        countries: [],
        pastVisitors: [],
        currentVisitors: []
    };
    function formatNumber(value) {
        var numeric = Number(value);
        return Number.isFinite(numeric) ? numeric.toLocaleString('en-US') : '—';
    }

    function isChinese() {
        return document.documentElement.classList.contains('lang-active-zh');
    }

    function safeNumber(value, fallback) {
        var numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function normalizeVisitor(visitor) {
        visitor = visitor || {};
        return {
            country: String(visitor.country || visitor.countryName || 'Unknown'),
            region: String(visitor.region || ''),
            city: String(visitor.city || ''),
            visits: Math.max(1, safeNumber(visitor.visits || visitor.count, 1)),
            lat: safeNumber(visitor.lat !== undefined ? visitor.lat : visitor.latitude, 0),
            lng: safeNumber(visitor.lng !== undefined ? visitor.lng : visitor.longitude, 0),
            lastSeen: safeNumber(visitor.lastSeen || visitor.last_seen, Date.now())
        };
    }

    function normalizeStats(payload) {
        var past = Array.isArray(payload.pastVisitors) ? payload.pastVisitors : [];
        var current = Array.isArray(payload.currentVisitors) ? payload.currentVisitors : [];
        return {
            totalVisits: safeNumber(payload.totalVisits, 0),
            places: safeNumber(payload.places, 0),
            countries: Array.isArray(payload.countries) ? payload.countries.map(String) : [],
            pastVisitors: past.map(normalizeVisitor),
            currentVisitors: current.map(normalizeVisitor)
        };
    }

    function setDataStatus(mode) {
        var label = badgeElement.querySelector('.visitor-data-label');
        badgeElement.classList.remove('is-live', 'is-preview');
        if (mode === 'live') {
            badgeElement.classList.add('is-live');
            label.textContent = isChinese() ? '实时' : 'Live';
        } else {
            badgeElement.classList.add('is-preview');
            label.textContent = isChinese() ? '预览' : 'Preview';
        }
    }

    function displayLocation(visitor) {
        var parts = [visitor.country];
        if (visitor.region && visitor.region !== visitor.country) {
            parts.push(visitor.region);
        }
        if (visitor.city && visitor.city !== visitor.region) {
            parts.push(visitor.city);
        }
        return parts.filter(Boolean).join(', ');
    }

    function relativeTime(timestamp) {
        var difference = Math.max(0, Date.now() - timestamp);
        var minutes = Math.floor(difference / 60000);
        if (minutes < 1) {
            return isChinese() ? '当前在线' : 'Active now';
        }
        if (minutes < 60) {
            return isChinese() ? minutes + ' 分钟前' : minutes + ' min ago';
        }
        var hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return isChinese() ? hours + ' 小时前' : hours + ' hr ago';
        }
        return isChinese() ? Math.floor(hours / 24) + ' 天前' : Math.floor(hours / 24) + ' d ago';
    }

    function renderSummary(stats) {
        totalVisitsElement.textContent = formatNumber(stats.totalVisits);
        totalPlacesElement.textContent = formatNumber(stats.places);
        countriesElement.textContent = stats.countries.length ? stats.countries.join(', ') : '—';
        currentCountElement.textContent = formatNumber(stats.currentVisitors.length);
    }

    function createEmptyState(tab) {
        var wrapper = document.createElement('div');
        wrapper.className = 'visitor-empty';

        var icon = document.createElement('i');
        icon.className = tab === 'current' ? 'fas fa-satellite-dish' : 'fas fa-map-marker-alt';
        icon.setAttribute('aria-hidden', 'true');

        var message = document.createElement('p');
        message.className = 'mb-0';
        message.textContent = tab === 'current'
            ? (isChinese() ? '当前暂无在线访客。' : 'No visitors are currently online.')
            : (isChinese() ? '暂时还没有历史访客。' : 'No visitor history yet.');

        wrapper.appendChild(icon);
        wrapper.appendChild(message);
        return wrapper;
    }

    function renderList() {
        if (!latestStats) {
            return;
        }

        var items = currentTab === 'current'
            ? latestStats.currentVisitors
            : latestStats.pastVisitors;

        listElement.textContent = '';
        listElement.setAttribute(
            'aria-labelledby',
            currentTab === 'current' ? 'visitor-tab-current' : 'visitor-tab-past'
        );

        if (!items.length) {
            listElement.appendChild(createEmptyState(currentTab));
            return;
        }

        items.slice(0, 30).forEach(function(visitor, index) {
            var item = document.createElement('article');
            item.className = 'visitor-location-item';

            var marker = document.createElement('span');
            marker.className = 'visitor-location-marker';
            marker.setAttribute('aria-hidden', 'true');
            marker.style.setProperty('--visitor-marker-color', markerColors[index % markerColors.length]);

            var copy = document.createElement('div');
            copy.className = 'visitor-location-copy';

            var name = document.createElement('p');
            name.className = 'visitor-location-name';
            name.textContent = displayLocation(visitor)
                + (currentTab === 'past' ? ' (' + formatNumber(visitor.visits) + ')' : '');

            var meta = document.createElement('p');
            meta.className = 'visitor-location-meta';
            meta.textContent = currentTab === 'current'
                ? relativeTime(visitor.lastSeen)
                : (isChinese()
                    ? '最近访问：' + relativeTime(visitor.lastSeen)
                    : 'Last seen ' + relativeTime(visitor.lastSeen).toLowerCase());

            copy.appendChild(name);
            copy.appendChild(meta);
            item.appendChild(marker);
            item.appendChild(copy);
            listElement.appendChild(item);
        });
    }

    function getGlobePoints(stats) {
        var past = stats.pastVisitors.map(function(visitor, index) {
            return Object.assign({}, visitor, {
                current: false,
                color: markerColors[index % markerColors.length]
            });
        });
        var current = stats.currentVisitors.map(function(visitor) {
            return Object.assign({}, visitor, {
                current: true,
                color: '#ef7d83'
            });
        });
        return past.concat(current).filter(function(point) {
            return Number.isFinite(point.lat) && Number.isFinite(point.lng);
        });
    }

    function updateGlobeData(stats) {
        if (!globe) {
            return;
        }
        var points = getGlobePoints(stats);
        var currentPoints = points.filter(function(point) {
            return point.current;
        });

        globe
            .pointsData(points)
            .pointLat('lat')
            .pointLng('lng')
            .pointColor('color')
            .pointAltitude(function(point) {
                return point.current ? 0.035 : 0.018;
            })
            .pointRadius(function(point) {
                return point.current ? 0.34 : Math.min(0.42, 0.16 + Math.log10(point.visits + 1) * 0.12);
            })
            .pointLabel(function(point) {
                return '<strong>' + displayLocation(point) + '</strong><br>'
                    + formatNumber(point.visits) + ' visit' + (point.visits === 1 ? '' : 's');
            })
            .ringsData(currentPoints)
            .ringLat('lat')
            .ringLng('lng')
            .ringColor(function() {
                return '#ef7d83';
            })
            .ringMaxRadius(3.2)
            .ringPropagationSpeed(1.15)
            .ringRepeatPeriod(1100);
    }

    function updateInterface(stats, source) {
        latestStats = normalizeStats(stats);
        renderSummary(latestStats);
        renderList();
        updateGlobeData(latestStats);
        setDataStatus(source);
    }

    function resizeGlobe() {
        if (!globe || !globeElement) {
            return;
        }
        var width = Math.max(200, Math.floor(globeElement.clientWidth || 520)) * 0.5;
        var height = window.innerWidth < 576 ? 390 : Math.min(560, Math.max(470, width * 0.88)) * 0.5;
        globe.width(width).height(height);
    }

    function initializeGlobe() {
        if (typeof window.Globe !== 'function' || !window.topojson) {
            loadingElement.textContent = 'Unable to load the globe renderer.';
            return Promise.reject(new Error('Globe dependencies are unavailable.'));
        }

        globe = window.Globe()(globeElement)
            .backgroundColor('rgba(0,0,0,0)')
            .showAtmosphere(true)
            .atmosphereColor('#8bbce5')
            .atmosphereAltitude(0.08)
            .showGraticules(false)
            .polygonCapColor(function() {
                return '#397fba';
            })
            .polygonSideColor(function() {
                return '#245d8e';
            })
            .polygonStrokeColor(function() {
                return 'rgba(220, 238, 252, 0.92)';
            })
            .polygonAltitude(0.006)
            .polygonsTransitionDuration(500);
    
        var material = globe.globeMaterial();
        material.color.set('#dceeff');
        material.transparent = true;
        material.opacity = 0.96;
        material.shininess = 0.7;
        
        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 1.0;
        globe.controls().enableDamping = true;
        globe.controls().dampingFactor = 0.08;
        globe.pointOfView({ lat: 19, lng: -35, altitude: 2.05 }, 0);
        resizeGlobe();

        return fetch(WORLD_ATLAS_URL)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('World atlas request failed.');
                }
                return response.json();
            })
            .then(function(topology) {
                var countries = window.topojson.feature(topology, topology.objects.countries).features;
                globe.polygonsData(countries);
                loadingElement.classList.add('is-hidden');
            });
    }

    function fetchWithTimeout(url, options, timeout) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = controller
            ? window.setTimeout(function() {
                controller.abort();
            }, timeout)
            : null;
        var requestOptions = Object.assign({}, options || {});
        if (controller) {
            requestOptions.signal = controller.signal;
        }
        return fetch(url, requestOptions).finally(function() {
            if (timer) {
                window.clearTimeout(timer);
            }
        });
    }

    function recordVisit() {
        if (!apiBase || document.visibilityState === 'hidden') {
            return Promise.resolve(false);
        }
        return fetchWithTimeout(apiBase + '/visit', {
            method: 'POST',
            mode: 'cors',
            cache: 'no-store',
            credentials: 'omit'
        }, 4500)
            .then(function(response) {
                return response.ok;
            })
            .catch(function() {
                return false;
            });
    }

    function refreshStats() {
        if (!apiBase) {
            updateInterface(previewStats, 'preview');
            return Promise.resolve(false);
        }

        return fetchWithTimeout(apiBase + '/stats', {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            credentials: 'omit'
        }, 4500)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Visitor API returned ' + response.status + '.');
                }
                return response.json();
            })
            .then(function(payload) {
                updateInterface(payload, 'live');
                return true;
            })
            .catch(function() {
                updateInterface(previewStats, 'preview');
                return false;
            });
    }

    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            currentTab = tab.getAttribute('data-visitor-tab');
            tabs.forEach(function(candidate) {
                var isActive = candidate === tab;
                candidate.classList.toggle('is-active', isActive);
                candidate.setAttribute('aria-selected', String(isActive));
            });
            renderList();
        });
    });

    if (typeof ResizeObserver === 'function') {
        var observer = new ResizeObserver(function() {
            if (resizeFrame) {
                window.cancelAnimationFrame(resizeFrame);
            }
            resizeFrame = window.requestAnimationFrame(resizeGlobe);
        });
        observer.observe(globeElement);
    } else {
        window.addEventListener('resize', resizeGlobe);
    }

    if (typeof MutationObserver === 'function') {
        var languageObserver = new MutationObserver(function() {
            renderList();
            setDataStatus(badgeElement.classList.contains('is-live') ? 'live' : 'preview');
        });
        languageObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'lang']
        });
    }

    initializeGlobe()
        .catch(function() {
            loadingElement.classList.remove('is-hidden');
        })
        .finally(function() {
            updateInterface(previewStats, 'preview');
            recordVisit().then(refreshStats);
        });

    window.setInterval(function() {
        recordVisit();
    }, 60 * 1000);

    window.setInterval(function() {
        refreshStats();
    }, 30 * 1000);

    window.setInterval(function() {
        if (latestStats && latestStats.currentVisitors.some(function(visitor) {
            return Date.now() - visitor.lastSeen > ACTIVE_WINDOW_MS;
        })) {
            refreshStats();
        } else if (currentTab === 'current') {
            renderList();
        }
    }, 30 * 1000);
})();
