/* Taccuino — service worker
   L'app si apre anche senza rete. Le tessere della mappa che hai già guardato
   restano in cache, con un tetto massimo, così le zone che frequenti funzionano offline. */

var VERSIONE = 'taccuino-v1';
var C_APP = VERSIONE + '-app';        // pagina, icone, manifest
var C_LIB = VERSIONE + '-lib';        // leaflet e font, presi da CDN
var C_TILE = VERSIONE + '-tessere';   // mappe
var MAX_TESSERE = 500;

var GUSCIO = ['./', './index.html', './manifest.webmanifest',
  './icone/icona-192.png', './icone/icona-512.png', './icone/icona-maskable-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(C_APP).then(function(c){
      return Promise.all(GUSCIO.map(function(u){
        return c.add(new Request(u, {cache:'reload'})).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(k){
      return Promise.all(k.map(function(n){
        if(n.indexOf(VERSIONE) !== 0) return caches.delete(n);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function eTessera(u){
  return /(tile|basemaps|cartocdn|opentopomap)/i.test(u.hostname);
}
function eLibreria(u){
  return /(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/i.test(u.hostname);
}
function pota(nome, max){
  caches.open(nome).then(function(c){
    c.keys().then(function(k){
      for(var i = 0; i < k.length - max; i++) c.delete(k[i]);
    });
  });
}
// cache prima, rete come riserva: quello che hai già visto si apre subito
function primaCache(req, nome, max){
  return caches.open(nome).then(function(c){
    return c.match(req).then(function(hit){
      var rete = fetch(req).then(function(res){
        if(res && (res.status === 200 || res.type === 'opaque')){
          c.put(req, res.clone());
          if(max) pota(nome, max);
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || rete;
    });
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);

  if(eTessera(url)){ e.respondWith(primaCache(req, C_TILE, MAX_TESSERE)); return; }
  if(eLibreria(url)){ e.respondWith(primaCache(req, C_LIB, 0)); return; }
  if(url.origin !== location.origin) return;

  // pagina e icone: rete se c'è, altrimenti la copia salvata
  e.respondWith(
    fetch(req).then(function(res){
      if(res && res.status === 200 && res.type === 'basic'){
        var copia = res.clone();
        caches.open(C_APP).then(function(c){ c.put(req, copia); });
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});
