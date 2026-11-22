// v5
/* Sert /_s/<id> au lecteur du navigateur : requêtes Range, déchiffrement, passage d'une partie à l'autre */
importScripts('reader.js');
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url),i=u.pathname.indexOf('/_s/');
 if(i<0)return;
 e.respondWith(serve(e.request,decodeURIComponent(u.pathname.slice(i+4))));
});
async function serve(req,id){
 const [cfg,a]=await Promise.all([idbGet('cfg'),idbGet('m:'+id)]);
 if(!cfg||!a)return new Response('Session expirée : rouvre le fichier depuis le panel',{status:503});
 const total=a.size;let s=0,e=total-1;const rg=req.headers.get('Range');
 if(rg){const m=/bytes=(\d*)-(\d*)/.exec(rg);
  if(m){if(m[1]!==''){s=+m[1];if(m[2]!=='')e=Math.min(+m[2],total-1)}else if(m[2]!==''){s=Math.max(0,total-+m[2])}}}
 if(s>=total)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+total}});
 const h={'Content-Type':a.mime||'video/mp4','Accept-Ranges':'bytes','Content-Length':String(e-s+1),'Cache-Control':'no-store'};
 if(rg)h['Content-Range']=`bytes ${s}-${e}/${total}`;
 return new Response(makeStream(cfg,a,s,e),{status:rg?206:200,headers:h});
}
