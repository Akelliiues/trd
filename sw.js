/**
 * TradingTools Workstation Service Worker
 * ให้ความเร็วสูงสุดในการโหลดบนมือถือ/แท็บเล็ต พร้อมระบบ Offline Caching และ Auto Force Update
 */

const CACHE_NAME = 'tradingtools-v2.6.9';

// ทรัพยากรหลักที่ต้อง Cache ทันทีที่ติดตั้ง (App Shell)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/index.html?v=2.6.9',
    '/styles.css?v=2.6.9',
    '/manifest.json?v=2.6.9',
    '/js/app.js?v=2.6.9',
    '/js/chart-engine.js?v=2.6.9',
    '/js/smc-ict-engine.js?v=2.6.9',
    '/js/indicators.js?v=2.6.1',
    '/js/lightweight-charts.js?v=2.6.1',
    '/js/replay-engine.js?v=2.6.1',
    '/js/volume-profile.js?v=2.6.1',
    '/js/footprint.js?v=2.6.1',
    '/js/patterns.js?v=2.6.1',
    '/js/journal.js?v=2.6.1',
    '/js/watchlist.js?v=2.6.1',
    '/js/resampler.js?v=2.6.1',
    '/icons/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png',
    '/icons/favicon.ico'
];

// 1. Install Event: Pre-cache App Shell & Skip Waiting Immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).catch((err) => {
            console.warn('[SW] Pre-cache warning:', err);
        })
    );
});

// 2. Activate Event: Clean up old caches & Claim Clients Instantly
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        }).then(() => {
            return self.clients.matchAll({ type: 'window' }).then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: CACHE_NAME
                    });
                });
            });
        })
    );
});

// 3. Fetch Event: Network-First with Cache Fallback for instant update propagation
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Dynamic Live APIs & Market Data: Always Network First
    if (url.pathname.startsWith('/api/') || url.pathname.includes('_1m.json') || url.pathname.startsWith('/data/')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && url.pathname.includes('_1m.json')) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // HTML Navigation requests: Always Network First to immediately receive new updates
    if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request).then(res => res || caches.match('/index.html') || caches.match('/'));
                })
        );
        return;
    }

    // Static Assets (CSS, JS, Fonts, Icons): Network First with Cache Fallback
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request, { ignoreSearch: true });
            })
    );
});

// 4. Message Event: Skip waiting and cache control triggers
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
    if (event.data && event.data.action === 'clearCache') {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
    }
});
