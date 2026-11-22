/* Lecture par blocs : fichiers découpés + chiffrés AES-GCM. Utilisé par la page ET par sw.js */
const idbOpen=()=>new Promise((res,rej)=>{const r=indexedDB.open('panel',1);r.onupgradeneeded=()=>r.result.createObjectStore('k');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const idbGet=async k=>{const d=await idbOpen();return new Promise((res,rej)=>{const q=d.transaction('k').objectStore('k').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})};
const idbSet=async(k,v)=>{const d=await idbOpen();return new Promise((res,rej)=>{const t=d.transaction('k','readwrite');t.objectStore('k').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})};
const b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

/* Les URL signées renvoyées par GitHub sont réutilisées : pas d'appel API à chaque morceau */
const urlCache=new Map();
async function getRange(cfg,p,lo,hi,sig){
 const h={Range:`bytes=${lo}-${hi}`};
 for(let t=0;t<3;t++){
  let r;const c=urlCache.get(p.id);
  if(c&&Date.now()-c.t<240000){try{r=await fetch(c.u,{headers:h,signal:sig})}catch(e){if(sig&&sig.aborted)throw e}}
  if(!r||r.status!=206){
   r=await fetch(`https://api.github.com/repos/${cfg.repo}/releases/assets/${p.id}`,{headers:{Authorization:'Bearer '+cfg.tok,Accept:'application/octet-stream',...h},signal:sig});
   if(r.status==206)urlCache.set(p.id,{u:r.url,t:Date.now()});
  }
  if(r.status==206)return new Uint8Array(await r.arrayBuffer());
  urlCache.delete(p.id);
 }
 throw Error('Lecture impossible (plage d\'octets refusée)');
}

/* Octets bruts [s,e] du fichier logique = parties mises bout à bout (lues en parallèle si on franchit une frontière) */
async function readRaw(cfg,a,s,e,sig){
 const out=new Uint8Array(e-s+1),jobs=[];let base=0;
 for(const p of a.parts){const ps=base,pe=base+p.size-1;base+=p.size;if(pe<s)continue;if(ps>e)break;
  const lo=Math.max(s,ps),hi=Math.min(e,pe);jobs.push(getRange(cfg,p,lo-ps,hi-ps,sig).then(b=>out.set(b,lo-s)))}
 await Promise.all(jobs);return out;
}
async function decBlocks(cfg,a,raw,b0){
 const EB=a.enc.bs+16,nonce=b64d(a.enc.n),n=Math.ceil(raw.length/EB);
 const bl=await Promise.all(Array.from({length:n},(_,i)=>{const iv=new Uint8Array(12);iv.set(nonce);new DataView(iv.buffer).setUint32(8,b0+i);
  return crypto.subtle.decrypt({name:'AES-GCM',iv},cfg.key,raw.subarray(i*EB,(i+1)*EB)).then(x=>new Uint8Array(x))}));
 const out=new Uint8Array(bl.reduce((s,b)=>s+b.length,0));let o=0;for(const b of bl){out.set(b,o);o+=b.length}return out;
}
/* Octets en clair [p,q] (inclus), déchiffrés si besoin */
async function fetchPlain(cfg,a,p,q,sig){
 if(!a.enc)return readRaw(cfg,a,p,q,sig);
 if(!cfg.key)throw Error('Clé de chiffrement manquante');
 const bs=a.enc.bs,EB=bs+16,b0=Math.floor(p/bs),b1=Math.floor(q/bs);
 const raw=await readRaw(cfg,a,b0*EB,Math.min((b1+1)*EB,a.encSize)-1,sig);
 const plain=await decBlocks(cfg,a,raw,b0),o=p-b0*bs;
 return plain.subarray(o,o+(q-p+1));
}
/* Itérateur avec lecture anticipée : le morceau suivant se charge pendant qu'on consomme le courant */
function pieces(cfg,a,s,e,PC,sig){
 let cur=s,nx=null;
 const plan=()=>{if(cur>e)return null;const q=Math.min(cur+PC-1,e),pr=fetchPlain(cfg,a,cur,q,sig);pr.catch(()=>{});cur=q+1;return pr};
 return{async next(){const pr=nx||plan();if(!pr)return{done:true};nx=plan();return{done:false,value:await pr}}};
}
function makeStream(cfg,a,s,e){
 const ab=new AbortController(),it=pieces(cfg,a,s,e,8*1048576,ab.signal);
 return new ReadableStream({async pull(c){try{const r=await it.next();r.done?c.close():c.enqueue(r.value)}catch(x){c.error(x)}},cancel(){ab.abort()}});
}
