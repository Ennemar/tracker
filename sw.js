// Service Worker — кэшируем индекс и ассеты для offline-режима + локальные напоминания.
// Стратегия: при install — precache основных файлов; при fetch — stale-while-revalidate
// (показываем из кэша немедленно + в фоне обновляем кэш из сети).
const VERSION = "tracker-v0.2";
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
  // Запускаем фоновую проверку напоминалок каждые 5 минут
  startReminderLoop();
});

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
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

// Напоминалки: SW читает config из clients (localStorage недоступен в SW),
// поэтому используем сообщения от страницы. Периодическая отправка проверок.
let reminderConfig = null;
let lastFired = {};

self.addEventListener("message", (e)=>{
  if(e.data && e.data.type==="REMINDER_CONFIG"){
    reminderConfig = e.data.config;
  }
});

// Локальный таймер-петля в SW (работает пока страница открыта хоть где-то).
async function startReminderLoop(){
  async function tick(){
    if(reminderConfig && Array.isArray(reminderConfig.times)){
      const now = new Date();
      const hh = String(now.getHours()).padStart(2,"0");
      const mm = String(now.getMinutes()).padStart(2,"0");
      const key = `${now.toDateString()} ${hh}:${mm}`;
      for(const item of reminderConfig.times){
        if(item.time === `${hh}:${mm}` && item.enabled && lastFired[key] !== item.id){
          lastFired[key] = item.id;
          await showReminder(item.title, item.body);
        }
      }
    }
    const clients = await self.clients.matchAll({type:"window"});
    clients.forEach(c=>c.postMessage({type:"REMINDER_TICK"}));
  }
  setInterval(tick, 30000);
  tick();
}

function showReminder(title, body){
  return self.registration.showNotification(title, {
    body,
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: "tracker"
  }).catch(()=>{ /* silent — может быть запрещено */ });
}