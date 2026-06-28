// Service Worker — кэшируем индекс и ассеты для offline-режима.
// Стратегия: при install — precache основных файлов; при fetch — stale-while-revalidate
// (показываем из кэша немедленно + в фоне обновляем кэш из сети).
const VERSION = "tracker-v0.1.1";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(PRECACHE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  // только same-origin кэшируем
  if(url.origin !== self.location.origin) return;
  e.respondWith((async ()=>{
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, {ignoreSearch:true});
    const networkPromise = fetch(req).then(res=>{
      if(res && res.ok && res.type==="basic") cache.put(req, res.clone());
      return res;
    }).catch(()=>cached);
    return cached || networkPromise;
  })());
});