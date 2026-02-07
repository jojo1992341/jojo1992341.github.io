const CACHE_NAME = 'coach-progression-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './script.js',
    './js/config.js',
    './js/app.js',
    './js/services/audio.service.js',
    './js/services/chart.service.js',
    './js/services/filter.service.js',
    './js/services/storage.service.js',
    './js/services/timer.service.js',
    './js/models/training.model.js',
    './css/main.css',
    './css/variables.css',
    './css/base.css',
    './css/layout.css',
    './css/components/buttons.css',
    './css/components/cards.css',
    './css/components/chart.css',
    './css/components/feedback.css',
    './css/components/forms.css',
    './css/components/history.css',
    './css/components/program.css',
    './css/components/table.css',
    './css/components/timer.css'
];

// Installation : Mise en cache des ressources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Mise en cache des fichiers');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

// Interception des requêtes : Cache First, falling back to Network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Si trouvé dans le cache, on le retourne
                if (response) {
                    return response;
                }
                // Sinon, on fait la requête réseau
                return fetch(event.request);
            })
    );
});