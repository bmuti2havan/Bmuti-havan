const CACHE = 'hais-v35';
const ASSETS = ['./', './index.html'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    var url = new URL(e.request.url);

    // Tile ve API istekleri — network first, cache yok (canlı veri)
    if (url.hostname.includes('arcgisonline') ||
        url.hostname.includes('openstreetmap') ||
        url.hostname.includes('opentopomap') ||
        url.hostname.includes('open-elevation') ||
        url.hostname.includes('open-meteo') ||
        url.hostname.includes('opentopodata') ||
        url.hostname.includes('groq.com') ||
        url.hostname.includes('anthropic')) {
        e.respondWith(fetch(e.request).catch(() => new Response('', {status:503})));
        return;
    }

    // Leaflet ve diğer kütüphane CDN'leri (cdnjs/unpkg) — network first, cache'e düş
    if (url.hostname.includes('cdnjs.cloudflare') || url.hostname.includes('unpkg.com')) {
        e.respondWith(
            fetch(e.request).then(res => {
                if (res && res.status === 200) {
                    var copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                }
                return res;
            }).catch(() => caches.match(e.request))
        );
        return;
    }

    // Ana doküman (HTML/navigasyon) — network first, ağ yoksa cache'e düş.
    // KRİTİK: cache boşsa (hiç ziyaret edilmemişse) burada da başarısız olur —
    // bu yüzden install aşamasında './' ve './index.html' önceden cache'leniyor.
    if (e.request.mode === 'navigate' ||
        e.request.destination === 'document' ||
        url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
        e.respondWith(
            fetch(e.request).then(res => {
                if (res && res.status === 200) {
                    var copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                }
                return res;
            }).catch(() =>
                caches.match(e.request)
                    .then(c => c || caches.match('./index.html'))
                    .then(c => c || caches.match('./'))
            )
        );
        return;
    }

    // Diğerleri (statik varlıklar) — cache first
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res && res.status === 200) {
                    caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                }
                return res;
            }).catch(() => caches.match('./index.html'));
        })
    );
});
