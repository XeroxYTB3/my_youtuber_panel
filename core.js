/* Noyau partagé : GitHub (données + Releases), historique, miniatures, upload, YouTube */
const $=s=>document.querySelector(s),API='https://api.github.com';
const ST=['Idée','Tournage','Montage','Review','Publié'],TY={shoot:'Tournage',edit:'Montage',publish:'Publication'},TC={shoot:'var(--rec)',edit:'var(--blue)',publish:'var(--grn)'};
const S={repo:localStorage.repo||'',tok:localStorage.tok||'',yt:localStorage.yt||'',me:null,d:null,sha:null,tab:'p',pid:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9),isA=()=>S.d.users[S.me]=='admin';
const sz=n=>n>1e9?(n/1e9).toFixed(2)+' Go':(n/1e6).toFixed(1)+' Mo';
const fd=t=>new Date(t).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const msg=t=>{const m=$('#msg');m.textContent=t;m.style.display='block';clearTimeout(msg.t);msg.t=setTimeout(()=>m.style.display='none',9000)};
const gh=(p,o={})=>fetch(p.startsWith('http')?p:API+p,{...o,headers:{Authorization:'Bearer '+S.tok,Accept:'application/vnd.github+json',...(o.headers||{})}});
const b64=s=>btoa(unescape(encodeURIComponent(s))),unb=s=>decodeURIComponent(escape(atob(s.replace(/\n/g,''))));
const pr=(d=S.d)=>d.projects.find(x=>x.id==S.pid);
const strip=(p,click)=>{const i=ST.indexOf(p.status);return`<div class="strip">${ST.map((s,k)=>`<span class="seg ${k<=i?'on':''} ${k==i?'cur':''}" ${click?`onclick="setStatus('${s}')"`:''}>${click?s:''}</span>`).join('')}</div>`};
const thumbH=a=>a.th?`<img src="${a.th}" alt="">`:`<div class="ph">${a.kind=='final'?'MONTAGE':'RUSH'}</div>`;

/* ---- données ---- */
async function load(){
 const r=await gh(`/repos/${S.repo}/contents/data.json`);
 if(r.status==404){S.d={users:{[S.me]:'admin'},projects:[],events:[],log:[]};S.sha=null;return save()}
 if(!r.ok)throw Error('Dépôt inaccessible : vérifie le nom du dépôt et les droits du token');
 const j=await r.json();S.sha=j.sha;let c=j.content;
 if(!c){c=(await(await gh(`/repos/${S.repo}/git/blobs/${j.sha}`)).json()).content} /* fichier > 1 Mo */
 S.d=JSON.parse(unb(c));S.d.log=S.d.log||[];
}
async function save(){
 const r=await gh(`/repos/${S.repo}/contents/data.json`,{method:'PUT',body:JSON.stringify({message:'maj',content:b64(JSON.stringify(S.d)),...(S.sha?{sha:S.sha}:{})})});
 if(r.status==409||r.status==422)throw Error('conflit');if(!r.ok)throw Error('Sauvegarde impossible ('+r.status+')');
 S.sha=(await r.json()).content.sha;
}
async function mut(fn,label,pid){
 for(let i=0;i<5;i++){try{await load();fn(S.d);
  if(label){S.d.log.unshift({at:Date.now(),by:S.me,t:label,p:pid||S.pid||''});S.d.log=S.d.log.slice(0,400)}
  await save();render();return true}catch(e){if(e.message!='conflit'){ulog('mut : '+e.message);msg(e.message);return false}await sleep(400*(i+1)+Math.random()*400)}}
 ulog('mut : conflit de sauvegarde persistant');msg('Sauvegarde impossible (conflit avec une autre modification) : réessaie dans un instant.');return false;
}
async function login(){
 S.repo=$('#rp')?$('#rp').value.trim():S.repo;S.tok=$('#tk')?$('#tk').value.trim():S.tok;
 try{const u=await gh('/user');if(!u.ok)throw Error('Token invalide');S.me=(await u.json()).login;await load();await initKeys();
  if(!S.d.users[S.me])throw Error(`@${S.me} n'a pas accès : demande à l'admin de t'ajouter dans Équipe`);
  localStorage.repo=S.repo;localStorage.tok=S.tok;render();check();setInterval(check,60000)}
 catch(x){S.d=null;msg(x.message);render()}
}
function logout(){localStorage.removeItem('tok');location.reload()}
function loginH(){return`<div class="login"><div class="rec"><i></i>PANEL</div><h2>Connexion</h2>
<p class="t">Dépôt privé de données et token GitHub personnel (Contents + Issues, lecture/écriture).</p>
<input id="rp" placeholder="utilisateur/panel-data" value="${esc(S.repo)}"><input id="tk" type="password" placeholder="Token GitHub" value="${esc(S.tok)}">
<button class="b" onclick="login()">Se connecter</button></div>`}

/* ---- rappels ---- */
function dueList(){const lim=Date.now()+864e5;return S.d.events.filter(e=>!e.done&&e.assignee==S.me&&new Date(e.date)<=lim).sort((a,b)=>a.date<b.date?-1:1)}
function dueH(){const d=dueList();return d.length?`<div class="alert"><b>À faire bientôt</b>${d.map(e=>`<div>${TY[e.type]} · ${esc(e.title)} <span class="t">${fd(e.date)}</span></div>`).join('')}</div>`:''}
function check(){
 if(!S.d||!('Notification'in window)||Notification.permission!='granted')return;const k=new Date().toDateString();
 dueList().forEach(e=>{const key='n'+e.id+k;if(localStorage[key])return;localStorage[key]=1;new Notification('⏰ '+e.title,{body:TY[e.type]+' · '+fd(e.date)})});
}
function evH(e){const late=!e.done&&new Date(e.date)<Date.now(),p=S.d.projects.find(x=>x.id==e.project);
 return`<div class="it row"><i class="dot" style="background:${TC[e.type]}"></i><div><b>${esc(e.title)}</b> ${late?'<span class="tag late">En retard</span>':''}${e.done?'<span class="tag ok">Fait</span>':''}
 <div class="t">${TY[e.type]} · ${fd(e.date)}${e.assignee?' · @'+esc(e.assignee):''}${p?' · '+esc(p.title):''}</div></div><span class="sp row">${!e.done&&(isA()||e.assignee==S.me)?`<button class="g b" onclick="doneE('${e.id}')">Fait</button>`:''}${isA()?`<button class="g b" onclick="delE('${e.id}')">✕</button>`:''}</span></div>`}
const doneE=id=>mut(d=>d.events.find(e=>e.id==id).done=true,'Échéance terminée',(S.d.events.find(e=>e.id==id)||{}).project),
 delE=id=>mut(d=>d.events=d.events.filter(e=>e.id!=id),'Échéance supprimée');

/* ---- projets / commentaires ---- */
const setStatus=v=>mut(d=>pr(d).status=v,'Statut → '+v);
const setP=(k,v,l)=>mut(d=>pr(d)[k]=v,l);
function com(){const t=$('#cm').value.trim();if(!t)return;const v=document.querySelector('#pl video,#pl audio'),tc=v?Math.floor(v.currentTime):null,aid=v?S.cur:null;mut(d=>pr(d).com.push({by:S.me,at:Date.now(),t,tc,a:aid}),'Commentaire ajouté')}
const comH=p=>(p.com||[]).map(c=>`<div class="it"><b>@${esc(c.by)}</b> <span class="t">${fd(c.at)}</span>${c.tc!=null?` <a style="color:var(--acc);cursor:pointer" onclick="seek(${c.tc},'${c.a}')">⏱ ${mmss(c.tc)}</a>`:''}<div>${esc(c.t)}</div></div>`).join('')+
 `<div class="row" style="margin-top:10px"><input id="cm" style="flex:1" placeholder="Un retour (le timecode du lecteur est ajouté)"><button class="b" onclick="com()">Envoyer</button></div>`;
const logH=(arr)=>arr.map(l=>`<div class="it"><span class="t">${fd(l.at)}</span> · <b>@${esc(l.by)}</b> ${esc(l.t)}${l.p&&S.d.projects.find(p=>p.id==l.p)?` <span class="t">— ${esc(S.d.projects.find(p=>p.id==l.p).title)}</span>`:''}</div>`).join('')||'<div class="t">Rien pour l\'instant.</div>';

/* ---- miniatures ---- */
function draw(s,w,h){if(!w)return'';const c=document.createElement('canvas');c.width=240;c.height=Math.round(240*h/w);c.getContext('2d').drawImage(s,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.55)}
function thumb(f){return new Promise(r=>{
 if(!/^(video|image)/.test(f.type))return r('');const u=URL.createObjectURL(f),fin=v=>{URL.revokeObjectURL(u);r(v)};setTimeout(()=>fin(''),8000);
 if(f.type.startsWith('image')){const i=new Image();i.onload=()=>fin(draw(i,i.width,i.height));i.onerror=()=>fin('');return i.src=u}
 const v=document.createElement('video');v.muted=true;v.preload='metadata';v.playsInline=true;
 v.onloadeddata=()=>{v.currentTime=Math.min(1,(v.duration||2)/2)};v.onseeked=()=>fin(draw(v,v.videoWidth,v.videoHeight));v.onerror=()=>fin('');v.src=u})}

/* ---- fichiers (Releases GitHub) ---- */
const BS=1048576,psz=()=>Math.min(64,Math.max(4,Math.round(+localStorage.psz||32))),parts=a=>a.parts||[{id:a.id,size:a.size}];
const b64u=u=>btoa(String.fromCharCode(...u));
const encOn=()=>!!S.key&&localStorage.enc=='1';
const syncCfg=()=>idbSet('cfg',{repo:S.repo,tok:S.tok,key:S.key||null});
const kdf=async(pw,salt)=>{const m=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:200000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])};
async function kUse(pw){const k=S.d.k,key=await kdf(pw,b64d(k.s));
 try{await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(k.iv)},key,b64d(k.c))}catch{throw Error('Mot de passe de chiffrement incorrect')}
 S.key=key;localStorage.kp=pw;await syncCfg()}
async function initKeys(){if(S.d.k&&localStorage.kp){try{await kUse(localStorage.kp)}catch{}}else await syncCfg();
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})}
async function kSet(){const pw=$('#kp').value;if(!pw)return;
 try{if(!S.d.k){if(!isA())return msg("Seul l'admin peut activer le chiffrement");
   const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await kdf(pw,salt),
   c=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('panel-ok'));
   await mut(d=>{d.k={s:b64u(salt),iv:b64u(iv),c:b64u(new Uint8Array(c))}},'Chiffrement activé','')}
  await kUse(pw);msg('Clé enregistrée sur cet appareil');render()}catch(e){msg(e.message)}}
const keyH=()=>`<div class="c"><h3 style="margin-top:0">Chiffrement</h3><p class="t">${S.d.k?"Activé pour l'équipe. Entre le mot de passe sur chaque appareil.":"Désactivé. L'admin choisit un mot de passe d'équipe, stocké nulle part : s'il est perdu, les fichiers chiffrés sont irrécupérables."}</p>
 <div class="row"><input id="kp" type="password" style="flex:1" placeholder="Mot de passe d'équipe"><button class="b" onclick="kSet()">${S.d.k?'Déverrouiller':'Activer'}</button></div>
 ${S.key?`<label class="row" style="margin-top:10px"><input type="checkbox" style="width:auto" ${localStorage.enc=='1'?'checked':''} onchange="localStorage.enc=this.checked?'1':'0'"> Chiffrer les nouveaux uploads</label><div class="t">État : déverrouillé sur cet appareil</div>`:''}</div><div class="c"><h3 style="margin-top:0">Diagnostic lecture</h3><p class="t">Si la vidéo ne démarre pas, lance ce test et copie le résultat.</p><div class="row"><button class="g b" onclick="diag()">Lancer le test</button><button class="b" onclick="testStore()">Tester le stockage GitHub</button></div><pre id="dg" style="white-space:pre-wrap;font-size:.8rem;margin:10px 0 0"></pre></div><div class="c"><h3 style="margin-top:0">Vitesse d'envoi</h3><p class="t">Nombre de chaînes d'envoi en parallèle (1 à 24). Plus haut = plus rapide si ta connexion suit, mais plus de mémoire. Le journal sert à comprendre un échec.</p><div class="row" style="margin-bottom:10px"><button class="g b" onclick="copyLog()">Copier le journal d'envoi</button></div><label class="row" style="margin-bottom:8px"><span class="t">Taille des morceaux (Mo, 4 à 64)</span><input type="number" min="4" max="64" style="width:90px" value="${psz()}" onchange="localStorage.psz=this.value"></label><label class="row"><span class="t">Envois en parallèle</span><input type="number" min="1" max="24" style="width:90px" value="${Math.min(24,Math.max(1,+localStorage.conc||8))}" onchange="localStorage.conc=this.value"></label></div>`;

async function encPart(f,i,nonce,bpp){
 const s0=i*bpp*BS,e=Math.min(s0+bpp*BS,f.size),offs=[];for(let o=s0;o<e;o+=BS)offs.push(o);
 const bl=await Promise.all(offs.map(async(o,j)=>{const iv=new Uint8Array(12);iv.set(nonce);new DataView(iv.buffer).setUint32(8,i*bpp+j);
  return crypto.subtle.encrypt({name:'AES-GCM',iv},S.key,await f.slice(o,Math.min(o+BS,e)).arrayBuffer())}));
 return new Blob(bl)}
/* ---- stockage : dépôts GitHub publics (écriture via l'API Git, lecture via raw.githubusercontent.com) ---- */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const toB64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.slice(r.result.indexOf(',')+1));r.onerror=()=>rej(Error('Lecture du fichier impossible'));r.readAsDataURL(b)});
async function waitS(sec,why){for(let i=Math.ceil(sec);i>0;i--){const el=$('#prog');if(el)el.innerHTML=`<div class="t">⏳ ${why} — reprise automatique dans ${i} s (ne ferme pas et ne recharge pas la page)</div>`;await sleep(1000)}}
async function ghj(path,body,method='POST'){
 for(let t=0;t<12;t++){
  const r=await gh(path,{method,body:JSON.stringify(body)});
  if(r.ok)return r.status==204?{}:r.json();
  if(r.status==403||r.status==429||r.status>=500){const ra=+r.headers.get('retry-after');await waitS((ra?ra+3:Math.min(300,30*(t+1)))+Math.random()*8,'GitHub limite le rythme');continue}
  throw Error(path.split('/').slice(-1)[0]+' : HTTP '+r.status+' '+((await r.json().catch(()=>({}))).message||''));
 }
 throw Error('GitHub refuse trop de requêtes : réessaie dans une heure');
}
function blobPost(r,body,onp){return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('POST',`${API}/repos/${S.me}/${r}/git/blobs`);
 x.setRequestHeader('Authorization','Bearer '+S.tok);x.setRequestHeader('Accept','application/vnd.github+json');x.setRequestHeader('Content-Type','application/json');
 x.upload.onprogress=e=>onp(e.loaded/e.total);x.onload=()=>{let j={};try{j=JSON.parse(x.responseText)}catch{}x.status<300?res(j.sha):rej(Object.assign(Error('HTTP '+x.status+(j.message?' — '+j.message:'')),{st:x.status}))};
 x.onerror=()=>rej(Error('Erreur réseau'));x.send(body)})}
async function blobSafe(r,blob,onp){let b64=await toB64(blob);const body=new Blob(['{"encoding":"base64","content":"',b64,'"}']);b64=null;
 for(let t=0;t<6;t++){try{return await blobPost(r,body,onp)}catch(e){if(t==5||(e.st&&e.st<500&&e.st!=403&&e.st!=429))throw e;const w=20*(t+1);msg('Nouvelle tentative dans '+w+' s…');await sleep(w*1000)}}}
async function mkRepo(name){
 const x=await ghj('/user/repos',{name,description:'Stockage Panel',private:false,auto_init:true}),br=x.default_branch||'main';
 for(let t=0;t<30;t++){const r=await gh(`/repos/${S.me}/${name}/git/ref/heads/${br}`);
  if(r.ok){const head=(await r.json()).object.sha,c=await(await gh(`/repos/${S.me}/${name}/git/commits/${head}`)).json();return{name,br,head,tree:c.tree.sha}}await sleep(400)}
 throw Error('Dépôt de stockage introuvable après création');
}
async function commitBatch(st,items){
 const t=await ghj(`/repos/${S.me}/${st.name}/git/trees`,{base_tree:st.tree,tree:items.map(i=>({path:i.path,mode:'100644',type:'blob',sha:i.sha}))});
 const c=await ghj(`/repos/${S.me}/${st.name}/git/commits`,{message:'chunks',tree:t.sha,parents:[st.head]});
 await ghj(`/repos/${S.me}/${st.name}/git/refs/heads/${st.br}`,{sha:c.sha},'PATCH');
 st.head=c.sha;st.tree=t.sha;return c.sha;
}
/* ---- envoi v2 : API "Contents" (1 requête = 1 partie = 1 commit), chaînes parallèles (1 dépôt par chaîne), reprise, journal ---- */
const CAP=2.5*1024**3,CONCDEF=4;
const ulog=t=>{try{const l=JSON.parse(localStorage.ulog||'[]');l.push(new Date().toLocaleTimeString('fr-FR')+'  '+t);localStorage.ulog=JSON.stringify(l.slice(-200))}catch{}};
async function mkStore(name){
 for(let t=0;t<5;t++){
  const r=await gh('/user/repos',{method:'POST',body:JSON.stringify({name,description:'Stockage Panel',private:false,auto_init:true})});
  if(r.ok)return;
  let jm={};try{jm=await r.json()}catch{}
  const em=(jm.message||'')+' '+JSON.stringify(jm.errors||'');
  if(r.status==422&&/already exists/i.test(em))return;
  ulog('création dépôt '+name+' : HTTP '+r.status+' '+em);
  if(r.status==422)throw Error('Création du dépôt refusée (HTTP 422) : '+em.trim());
  if(r.status==403||r.status==429||r.status>=500){await sleep(5000*(t+1));continue}
  throw Error('Création du dépôt impossible (HTTP '+r.status+' '+(jm.message||'')+'). Le token doit avoir le droit "repo" (ou "Administration" en écriture pour un token fine-grained).');
 }
 throw Error('Création du dépôt impossible : GitHub ne répond pas');
}
async function putPart(repo,path,sl,onp){
 let b64=await toB64(sl);const body=new Blob(['{"message":"c","content":"',b64,'"}']);b64=null;
 for(let t=0;t<7;t++){
  if(S.cancel)throw Error('Envoi annulé');
  try{return await new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('PUT',`${API}/repos/${S.me}/${repo}/contents/${path}`);
    x.setRequestHeader('Authorization','Bearer '+S.tok);x.setRequestHeader('Accept','application/vnd.github+json');x.setRequestHeader('Content-Type','application/json');
    x.upload.onprogress=e=>onp(e.loaded/e.total);
    x.onload=()=>{let j={};try{j=JSON.parse(x.responseText)}catch{}
     if(x.status<300&&j.commit)res(j.commit.sha);else rej(Object.assign(Error('HTTP '+x.status+(j.message?' — '+j.message:'')),{st:x.status}))};
    x.onerror=()=>rej(Object.assign(Error('connexion coupée ou refusée'),{st:0}));x.send(body)})}
  catch(e){
   ulog(`${repo}/${path} essai ${t+1}/7 : ${e.message}`);
   if(e.st==422){try{const r=await gh(`/repos/${S.me}/${repo}/commits?path=${path}&per_page=1`);if(r.ok){const l=await r.json();if(l[0])return l[0].sha}}catch{}}
   if(e.st==422&&t>=2)throw e;
   if(t==6||(e.st&&e.st<500&&![403,404,409,429].includes(e.st)))throw e;
   let w=[3,8,20,40,60,90][t]||90;if(e.st==403||e.st==429)w=Math.max(w,60);
   msg(`Nouvelle tentative (${e.message}) dans ${w} s…`);await sleep(w*1000)}
 }
}
async function up(kind,files){
 if(!encOn()&&!S.okPub){if(!confirm("Sans chiffrement, tes fichiers seront PUBLICS sur GitHub (dépôts publics). Continuer ? Active le chiffrement dans Réglages pour les protéger."))return;S.okPub=1}
 S.cancel=0;
 try{for(const f of files)await upOne(kind,f)}
 catch(e){ulog('ERREUR : '+e.message);msg(e.message+(S.cancel?'':' — tu peux reprendre : renvoie le même fichier.'))}
}
async function upOne(kind,f){
 const t0=Date.now(),E=encOn(),mb=psz(),pp=mb*BS,n=Math.max(1,Math.ceil(f.size/pp)),tot=f.size+(E?Math.ceil(f.size/BS)*16:0),
  fp=`upr:${S.pid}|${f.name}|${f.size}|${f.lastModified}|${E?1:0}`,conc=Math.min(24,Math.max(1,+localStorage.conc||CONCDEF));
 let st=null;try{st=JSON.parse(localStorage[fp]||'null')}catch{}
 if(st&&(st.n!=n||!st.repos))st=null;
 if(st){try{const chk=await Promise.all(st.repos.map(r=>gh(`/repos/${S.me}/${r}`)));if(chk.some(r=>r.status==404)){ulog('reprise abandonnée : dépôt de stockage introuvable, nouvel envoi complet');st=null;localStorage.removeItem(fp)}}catch{}}
 const thP=thumb(f);
 if(!st){
  const nch=Math.max(Math.min(n,conc),Math.ceil(tot/CAP)),aid=uid()+uid();
  st={aid,n,nonce:E?b64u(crypto.getRandomValues(new Uint8Array(8))):null,repos:Array.from({length:nch},(_,k)=>`pnl-${aid}-${k+1}`),done:{}};
  ulog(`début ${f.name} (${sz(f.size)}) : ${n} parties, ${nch} dépôts, chiffré=${E}`);
  await Promise.all(st.repos.map(mkStore));localStorage[fp]=JSON.stringify(st);
 }else ulog(`reprise ${f.name} : ${Object.keys(st.done).length}/${n} parties déjà envoyées`);
 const nch=st.repos.length,nonce=E?b64d(st.nonce):null,loaded=new Array(n).fill(0);let base=0;
 for(const i in st.done){loaded[i]=st.done[i].size;base+=st.done[i].size}
 const queues=Array.from({length:nch},()=>[]);for(let i=0;i<n;i++)if(!st.done[i])queues[i%nch].push(i);
 let last=0;
 const show=(force)=>{const now=Date.now();if(!force&&now-last<250)return;last=now;
  const s2=loaded.reduce((x,y)=>x+y,0),sp=(s2-base)/((now-t0)/1000||1),left=sp>0?Math.round((tot-s2)/sp):0,el=$('#prog');
  if(el)el.innerHTML=`<div class="t">${E?'🔒 ':''}${esc(f.name)} — ${Math.round(s2/tot*100)}% · ${(sp/1e6).toFixed(1)} Mo/s · reste ${left>=3600?Math.floor(left/3600)+' h ':''}${left>=60?Math.floor(left%3600/60)+' min ':''}${left%60} s</div><progress value="${s2}" max="${tot}"></progress>
   <div class="row" style="margin-top:8px"><button class="g b" onclick="S.cancel=1">Annuler</button><span class="t">${nch} chaînes en parallèle</span></div>`};
 const chain=async k=>{for(const i of queues[k]){
   if(S.cancel)throw Error('Envoi annulé');
   const sl=E?await encPart(f,i,nonce,mb):f.slice(i*pp,(i+1)*pp),path=`c/${String(i).padStart(5,'0')}.bin`;
   const c=await putPart(st.repos[k],path,sl,fr=>{loaded[i]=fr*sl.size;show()});
   loaded[i]=sl.size;st.done[i]={r:st.repos[k],c,p:path,size:sl.size};try{localStorage[fp]=JSON.stringify(st)}catch{}
   ulog(`partie ${i+1}/${n} OK (${st.repos[k]})`);show(true)}};
 try{await Promise.all(Array.from({length:nch},(_,k)=>chain(k)))}catch(e){S.cancel=1;throw e}
 const res=Array.from({length:n},(_,i)=>({o:S.me,...st.done[i]}));
 const th=await thP;
 const saved=await mut(d=>pr(d).assets.push({id:st.aid,parts:res,name:f.name,size:f.size,mime:f.type,enc:E?{n:st.nonce,bs:BS}:undefined,kind,by:S.me,at:Date.now(),th}),(kind=='final'?'Montage ajouté : ':'Rush ajouté : ')+f.name+(E?' 🔒':''));
 if(!saved)throw Error('Fichier envoyé mais non enregistré dans le projet : renvoie le même fichier pour réessayer (aucune partie ne sera renvoyée).');
 localStorage.removeItem(fp);
 const sec=(Date.now()-t0)/1000;ulog(`terminé ${f.name} en ${sec.toFixed(0)} s`);
 msg(`Terminé : ${sz(f.size)} en ${sec.toFixed(0)} s (${(f.size/1e6/sec).toFixed(1)} Mo/s, ${nch} chaînes en parallèle)`);
}
async function copyLog(){const t=JSON.parse(localStorage.ulog||'[]').join('\n')||'(journal vide)';const el=$('#dg');if(el)el.textContent=t;try{await navigator.clipboard.writeText(t);msg('Journal copié')}catch{msg('Journal affiché ci-dessous : copie-le à la main')}}
async function blob(id){const r=await gh(`/repos/${S.repo}/releases/assets/${id}`,{headers:{Accept:'application/octet-stream'}});if(!r.ok)throw Error('Téléchargement impossible');return r.blob()}
async function swOk(){if(!('serviceWorker' in navigator))return false;
 try{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller){
   const w=Promise.race([new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true})),new Promise(r=>setTimeout(r,3000))]);
   try{const g=await navigator.serviceWorker.ready;g.active&&g.active.postMessage('claim')}catch{} /* page rechargée avec Ctrl+F5 : on force la prise de contrôle */
   await w}
  return !!navigator.serviceWorker.controller}catch{return false}}
async function prep(a){const ps=parts(a);await idbSet('m:'+a.id,{size:a.size,mime:a.mime,parts:ps,enc:a.enc,encSize:ps.reduce((x,p)=>x+p.size,0)});await syncCfg();return{repo:S.repo,tok:S.tok,key:S.key||null}}
const mmss=t=>Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
async function play(id){
 const a=pr().assets.find(x=>x.id==id);
 if(a.enc&&!S.key)return msg("Fichier chiffré : entre le mot de passe d'équipe dans Réglages");
 try{await prep(a);
  if(!await swOk())return msg('Lecture en direct indisponible dans ce navigateur : télécharge le fichier.');
  const t=(a.mime||'video/mp4').split('/')[0],u='_s/'+a.id,tag=t=='audio'?'audio':'video';S.cur=id;S.fb=null;
  $('#pl').innerHTML=t=='image'?`<img src="${u}" alt="" style="max-width:100%;border-radius:10px;margin-bottom:12px">`:`<${tag} controls autoplay playsinline onerror="vErr('${a.id}')" src="${u}" style="width:100%"></${tag}>`;
  $('#pl').scrollIntoView({behavior:'smooth'})
 }catch(e){msg(e.message)}}
async function seek(t,aid){if(S.cur!=aid)await play(aid);const v=document.querySelector('#pl video,#pl audio');if(v){const go=()=>{v.currentTime=t};v.readyState>0?go():v.addEventListener('loadedmetadata',go,{once:true})}}
async function dl(id){
 const a=pr().assets.find(x=>x.id==id);
 if(a.enc&&!S.key)return msg("Fichier chiffré : entre le mot de passe d'équipe dans Réglages");
 const onp=n=>{const el=$('#prog');if(el)el.innerHTML=`<div class="t">Téléchargement ${esc(a.name)} — ${Math.round(n/a.size*100)}%</div><progress value="${n}" max="${a.size}"></progress>`};
 let w=null,h=null;
 try{
  if(window.showSaveFilePicker)h=await showSaveFilePicker({suggestedName:a.name});
  else if(a.size>=1.5e9)return msg('Fichier trop gros pour ce navigateur : utilise Chrome ou Edge sur ordinateur.');
  const cfg=await prep(a),it=pieces(cfg,a,0,a.size-1,32*1048576),bs=[];let n=0;
  if(h)w=await h.createWritable();
  for(;;){const r=await it.next();if(r.done)break;n+=r.value.length;w?await w.write(r.value):bs.push(r.value);onp(n)}
  if(w){await w.close();msg('Fichier enregistré')}else{const l=document.createElement('a');l.href=URL.createObjectURL(new Blob(bs));l.download=a.name;l.click()}
 }catch(e){if(w)try{await w.abort()}catch{}if(e.name!='AbortError')msg(e.message)}
}
async function delA(id){
 if(!confirm('Supprimer ce fichier ?'))return;const a=pr().assets.find(x=>x.id==id),repos=new Set();let bad=0;
 for(const q of parts(a)){if(q.r)repos.add(q.o+'/'+q.r);else await gh(`/repos/${S.repo}/releases/assets/${q.id}`,{method:'DELETE'})}
 for(const r of repos){const x=await gh('/repos/'+r,{method:'DELETE'});if(!x.ok&&x.status!=404)bad++}
 await mut(d=>{const p=pr(d);p.assets=p.assets.filter(x=>x.id!=id)},'Fichier supprimé : '+a.name);
 if(bad)msg(bad+' dépôt(s) de stockage à supprimer à la main sur GitHub (le token doit avoir le droit delete_repo).');
}
const assetCards=(p,k)=>p.assets.filter(a=>a.kind==k).map(a=>`<div class="ac"><div class="th">${thumbH(a)}</div><div class="ai"><b title="${esc(a.name)}">${a.enc?'🔒 ':''}${esc(a.name)}</b><div class="t">${sz(a.size)}${a.parts?' · '+a.parts.length+' parties':''} · @${esc(a.by)}</div></div>
 <div class="row" style="gap:4px"><button class="g b" onclick="play('${a.id}')">Lire</button><button class="g b" onclick="dl('${a.id}')">⤓</button>${k=='final'&&isA()?`<button class="b" onclick="toYT('${a.id}')">YouTube</button>`:''}${isA()||a.by==S.me?`<button class="g b" onclick="delA('${a.id}')">✕</button>`:''}</div></div>`).join('')||'<div class="t">Rien pour l\'instant.</div>';

/* ---- YouTube ---- */
async function ytTok(){
 await new Promise(r=>{if(window.google?.accounts)return r();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=r;document.head.append(s)});
 return new Promise((res,rej)=>google.accounts.oauth2.initTokenClient({client_id:S.yt,scope:'https://www.googleapis.com/auth/youtube.upload',callback:t=>t.access_token?res(t.access_token):rej(Error('Connexion YouTube refusée'))}).requestAccessToken());
}
async function toYT(id){
 if(!S.yt)return msg('Ajoute ton Client ID Google dans Réglages');
 const p=pr(),a=p.assets.find(x=>x.id==id),tags=(p.tags||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(a.enc&&!S.key)return msg("Fichier chiffré : entre le mot de passe d'équipe dans Réglages");
 try{const t=await ytTok(),cfg=await prep(a);msg('Envoi vers YouTube…');
  const i=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({snippet:{title:p.title,description:p.desc||'',tags},status:{privacyStatus:'private'}})});
  if(!i.ok)throw Error('YouTube a refusé la requête ('+i.status+')');
  const loc=i.headers.get('Location'),it=pieces(cfg,a,0,a.size-1,32*1048576);let off=0,j;
  for(;;){const r=await it.next();if(r.done)break;const b=r.value,rr=await fetch(loc,{method:'PUT',headers:{'Content-Range':`bytes ${off}-${off+b.length-1}/${a.size}`},body:b});off+=b.length;
   if(rr.status==200||rr.status==201)j=await rr.json();else if(rr.status!=308)throw Error('Envoi YouTube échoué ('+rr.status+')');
   const el=$('#prog');if(el)el.innerHTML=`<div class="t">YouTube — ${Math.round(off/a.size*100)}%</div><progress value="${off}" max="${a.size}"></progress>`}
  if(!j||!j.id)throw Error('Envoi YouTube incomplet');
  await mut(d=>{const q=pr(d);q.yt=j.id;q.status='Publié'},'Publié sur YouTube (privé)');msg('Publié en privé. Passe-la en publique dans YouTube Studio.')}
 catch(e){msg(e.message)}
}

/* ---- icônes ---- */
const ICP={p:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 5 6 9M13 5l-2 4M18 5l-2 4"/>',
 c:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 h:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 t:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.6 14.7c1.7.7 2.7 2.4 2.9 5.3"/>',
 s:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
 m:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'};
const IC=k=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICP[k]}</svg>`;

/* ---- mode secours (sans requêtes par plages) + diagnostic ---- */
async function noRange(a){const cfg=await prep(a),raws=[];
 for(const p of parts(a)){const r=p.r?await fetch(`https://raw.githubusercontent.com/${p.o}/${p.r}/${p.c}/${p.p}`):await gh(`/repos/${S.repo}/releases/assets/${p.id}`,{headers:{Accept:'application/octet-stream'}});if(!r.ok)throw Error('Téléchargement impossible ('+r.status+')');raws.push(new Uint8Array(await r.arrayBuffer()))}
 const type=a.mime||'video/mp4';if(!a.enc)return new Blob(raws,{type});
 const raw=new Uint8Array(raws.reduce((x,y)=>x+y.length,0));let o=0;for(const x of raws){raw.set(x,o);o+=x.length}
 return new Blob([await decBlocks(cfg,a,raw,0)],{type})}
async function probe(a){const cfg=await prep(a),o={};
 try{const b=await fetchPlain(cfg,a,0,Math.min(65535,a.size-1));o.head=b.length;o.sig=String.fromCharCode(...b.slice(4,8))}catch(e){o.headErr=e.message}
 try{const b=await fetchPlain(cfg,a,Math.max(0,a.size-65536),a.size-1);o.tail=b.length}catch(e){o.tailErr=e.message}
 return o}
async function vErr(id){
 const a=pr().assets.find(x=>x.id==id);if(!a||S.fb==id)return;S.fb=id;
 let o;try{o=await probe(a)}catch(e){o={headErr:e.message}}
 if(o.headErr||o.tailErr)return msg('Lecture impossible : '+(o.headErr||o.tailErr)+' — Réglages → Diagnostic lecture.');
 if(!/ftyp|moov|mdat|free|wide|skip/.test(o.sig||''))return msg("Les octets reçus ne ressemblent pas à un MP4 (parties dans le mauvais ordre ou corrompues). Renvoie le fichier.");
 if(a.size>1.6e9)return msg("Les données arrivent correctement mais le lecteur échoue. Réglages → Diagnostic lecture, puis envoie-moi le résultat.");
 try{msg('Mode secours (chargement complet)…');const b=await noRange(a);
  $('#pl').innerHTML=`<video controls autoplay playsinline src="${URL.createObjectURL(b)}" style="width:100%"></video>`;msg('Mode secours actif')}catch(e){msg(e.message)}}
async function diag(){
 const o=[],L=(k,v)=>{o.push(k+' : '+v);$('#dg').textContent=o.join('\n')};
 L('Version du panel','v5c — lecteur '+(typeof KINDS!='undefined'?'multi-méthodes (à jour)':'ANCIEN : reader.js pas à jour'));
 L('Page sécurisée (https)',isSecureContext?'oui':'NON');L('Service worker supporté',('serviceWorker' in navigator)?'oui':'NON');
 const a=S.d.projects.flatMap(p=>p.assets).find(()=>true);
 if(!a)return L('Fichier de test',"aucun : uploade d'abord un petit fichier");
 L('Fichier testé',a.name+(a.enc?' 🔒':'')+' ('+sz(a.size)+', '+parts(a).length+' partie(s))');
 if(parts(a)[0].r){
  const p0=parts(a)[0],u=`https://raw.githubusercontent.com/${p0.o}/${p0.r}/${p0.c}/${p0.p}`;
  try{const r=await fetch(u,{headers:{Range:'bytes=0-99'}});L('raw.githubusercontent.com (plage)',r.status+(r.status==206?' OK':r.status==200?' OK sans plages':' ERREUR'))}
  catch(e){L('raw.githubusercontent.com','INJOIGNABLE : '+e.message+' (bloqueur de pub / pare-feu ? le panel utilisera l\'API GitHub en secours)')}
  try{const r=await gh(`/repos/${p0.o}/${p0.r}/contents/${p0.p}?ref=${p0.c}`,{headers:{Accept:'application/vnd.github.raw+json',Range:'bytes=0-99'}});L('API GitHub (secours)','statut '+r.status+(r.ok?' OK':' ERREUR'))}
  catch(e){L('API GitHub (secours)','ERREUR : '+e.message)}
 }else{
 try{const r=await fetch(`${API}/repos/${S.repo}/releases/assets/${parts(a)[0].id}`,{headers:{Authorization:'Bearer '+S.tok,Accept:'application/octet-stream',Range:'bytes=0-99'}});
  L('Plage via API GitHub',r.status+(r.status==206?' OK':' (attendu 206)'));
  if(r.status==206){const r2=await fetch(r.url,{headers:{Range:'bytes=100-199'}});L('Plage via lien signé',r2.status+(r2.status==206?' OK':' (attendu 206)'))}}
 catch(e){L('Lecture par plages','BLOQUÉE par le navigateur : '+e.message)}
 const cfg0={repo:S.repo,tok:S.tok,key:S.key||null},p0=parts(a)[0];
 for(const k of KINDS){try{const b=await viaKind(k,cfg0,p0,0,99);L('Méthode '+k,'OK ('+b.length+' octets)')}catch(e){L('Méthode '+k,'échec : '+e.message)}}
 try{const r=await fetch(`https://uploads.github.com/repos/${S.repo}/releases/1/assets?name=t`,{headers:{Authorization:'Bearer '+S.tok}});L('Upload direct navigateur (uploads.github.com)','joignable (statut '+r.status+')')}catch(e){L('Upload direct navigateur (uploads.github.com)','BLOQUÉ : '+e.message)}
 }
 try{const g=await navigator.serviceWorker.getRegistration();L('Service worker enregistré',g?'oui ('+g.scope+')':'non');L('Service worker actif ici',navigator.serviceWorker.controller?'oui':'non (recharge la page)')}catch(e){L('Service worker',e.message)}
 if(a.enc)L('Clé de chiffrement',S.key?'chargée':'MANQUANTE');
 try{const o=await probe(a);L('Lecture du début du fichier',o.headErr?'ERREUR '+o.headErr:o.head+' octets, signature "'+o.sig+'" '+(/ftyp/.test(o.sig)?'(MP4 OK)':'(inattendue)'));L('Lecture de la fin du fichier',o.tailErr?'ERREUR '+o.tailErr:o.tail+' octets OK')}catch(e){L('Lecture des octets','ERREUR '+e.message)}
 try{const r=await fetch('_s/'+a.id,{headers:{Range:'bytes=0-65535'}}),b=await r.arrayBuffer();L('Service worker (octets réellement reçus)',r.status+', '+b.byteLength+' octets')}catch(e){L('Service worker (octets réellement reçus)','ERREUR '+e.message)}
 const v=document.createElement('video');L('Navigateur lit H.264',v.canPlayType('video/mp4; codecs="avc1.640028"')||'non');L('Navigateur lit H.265/HEVC',v.canPlayType('video/mp4; codecs="hvc1.1.6.L120.B0"')||'non');
 L('Fin',"copie ce texte et envoie-le moi")}

async function testStore(){
 const o=[],L=(k,v)=>{o.push(k+' : '+v);$('#dg').textContent=o.join('\n')};let st=null;
 try{
  L('Version stockage','v5c (dépôts GitHub + raw.githubusercontent.com)');
  st=await mkRepo('pnl-test-'+uid());L('1. Création d\'un dépôt de test','OK ('+st.name+')');
  const data=new Uint8Array(1048576);for(let i=0;i<data.length;i+=65536)crypto.getRandomValues(data.subarray(i,i+65536));const sha=await blobSafe(st.name,new Blob([data]),()=>{});
  const c=await commitBatch(st,[{path:'c/test.bin',sha}]);L('2. Envoi de 1 Mo (API Git)','OK');
  const u=`https://raw.githubusercontent.com/${S.me}/${st.name}/${c}/c/test.bin`;let done=false;
  for(let t=0;t<6&&!done;t++){
   try{const r=await fetch(u,{headers:{Range:'bytes=100-199'}}),b=new Uint8Array(await r.arrayBuffer());
    if(r.status==206&&b.length==100&&b.every((x,i)=>x==data[100+i])){L('3. Lecture par plage (raw.githubusercontent.com)','OK (206, octets exacts)');done=true}
    else if(r.status==200&&b.length==data.length&&b.every((x,i)=>x==data[i])){L('3. Lecture (raw.githubusercontent.com)','OK mais sans plages : le panel lira des parties entières de 32 Mo');done=true}
    else if(t==5)L('3. Lecture','statut '+r.status+', '+b.length+' octets (inattendu)');
   }catch(e){if(t==5)L('3. Lecture (raw.githubusercontent.com)','BLOQUÉE : '+e.message);}
   if(!done)await sleep(2500);
  }
 }catch(e){L('ERREUR',e.message)}
 if(st){const x=await gh(`/repos/${S.me}/${st.name}`,{method:'DELETE'});L('4. Nettoyage du dépôt de test',x.ok?'OK':'à supprimer à la main ('+st.name+')')}
 L('Fin','copie ce texte et envoie-le moi');
}
window.addEventListener('unhandledrejection',e=>{try{const m=(e.reason&&e.reason.message)||String(e.reason);ulog('Erreur non gérée : '+m);msg('Erreur : '+m)}catch{}});
