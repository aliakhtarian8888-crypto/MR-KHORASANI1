const CACHE='mr-khorasani-2.9.7-separated-entry';
const FILES=["./", "./index.html", "./guest.html", "./supabase-config.js", "./supabase-client.js", "./guest-runtime.js", "./warehouse-migration.js", "./mrk-data-tools.js", "./mrk-export-store.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./guest-entry-qr.png"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const requestUrl=new URL(event.request.url);
  if(requestUrl.origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
    return response;
  }).catch(()=>caches.match('./index.html'))));
});
