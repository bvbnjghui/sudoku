// sw.js
const CACHE_NAME = 'sudoku-cache-v1.1'; // 每次更新資源時，記得修改版本號！
const urlsToCache = [
  '.', // 代表根目錄，通常是 index.html
  'index.html',
  'style.css',
  'app.js',
  'sudoku.js',
  'manifest.json',
  'icons/icon-192x192.png', // 加入你的圖示路徑
  'icons/icon-512x512.png'  // 加入你的圖示路徑
  // 如果你有其他資源 (例如字型檔)，也要加進來
];

// 安裝 Service Worker 並快取核心資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // 強制新的 Service Worker 立即啟用
      .catch(error => {
        console.error('Failed to cache resources during install:', error);
      })
  );
});

// 啟用 Service Worker 並清除舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 讓新的 Service Worker 控制所有客戶端
  );
});

// 攔截網路請求，優先從快取提供資源
self.addEventListener('fetch', event => {
  // 對於非 GET 請求或非 http/https 協議的請求，直接使用網路
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
      event.respondWith(fetch(event.request));
      return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果快取中有，直接回傳快取的資源
        if (response) {
          return response;
        }

        // 如果快取中沒有，嘗試從網路獲取
        return fetch(event.request).then(
          networkResponse => {
            // 檢查回應是否有效
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // 把從網路獲取的有效資源複製一份存入快取
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
          // 網路請求失敗 (離線狀態)
          console.error('Fetch failed; returning offline page instead.', error);
          // 你可以回傳一個預先快取的離線頁面，或者對於非必要資源直接失敗
          // 對於這個遊戲，如果核心檔案已快取，理論上不會到這裡
          // return caches.match('/offline.html'); // 如果你有離線頁面
        });
      })
  );
});