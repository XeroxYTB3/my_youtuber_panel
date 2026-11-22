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
 for(let i=0;i<3;i++){try{await load();fn(S.d);
  if(label){S.d.log.unshift({at:Date.now(),by:S.me,t:label,p:pid||S.pid||''});S.d.log=S.d.log.slice(0,400)}
  await save();return render()}catch(e){if(e.message!='conflit')return msg(e.message)}}
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
const PART=1024*1024*1024,BS=1048576,BPP=512,parts=a=>a.parts||[{id:a.id,size:a.size}];
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
 ${S.key?`<label class="row" style="margin-top:10px"><input type="checkbox" style="width:auto" ${localStorage.enc=='1'?'checked':''} onchange="localStorage.enc=this.checked?'1':'0'"> Chiffrer les nouveaux uploads</label><div class="t">État : déverrouillé sur cet appareil</div>`:''}</div>`;

async function encPart(f,i,nonce){const bl=[],s=i*BPP*BS,e=Math.min(s+BPP*BS,f.size);
 for(let o=s,b=i*BPP;o<e;o+=BS,b++){const iv=new Uint8Array(12);iv.set(nonce);new DataView(iv.buffer).setUint32(8,b);
  bl.push(await crypto.subtle.encrypt({name:'AES-GCM',iv},S.key,await f.slice(o,Math.min(o+BS,e)).arrayBuffer()))}
 return new Blob(bl)}
function xput(url,body,type,onp){return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('POST',url);x.setRequestHeader('Authorization','Bearer '+S.tok);x.setRequestHeader('Content-Type',type);x.upload.onprogress=e=>onp(e.loaded);x.onload=()=>x.status<300?res(JSON.parse(x.responseText)):rej(Error('Upload refusé ('+x.status+')'));x.onerror=()=>rej(Error('Erreur réseau'));x.send(body)})}
async function up(kind,files){
 let p=pr();
 try{
  if(!p.rel){const r=await gh(`/repos/${S.repo}/releases`,{method:'POST',body:JSON.stringify({tag_name:'p-'+p.id,name:p.title})});if(!r.ok)throw Error('Création de la release impossible');const j=await r.json();await mut(d=>pr(d).rel=j.id);p=pr()}
  for(const f of files){
   const E=encOn(),nonce=E?crypto.getRandomValues(new Uint8Array(8)):null,pp=E?BPP*BS:PART,n=Math.max(1,Math.ceil(f.size/pp)),tot=f.size+(E?Math.ceil(f.size/BS)*16:0);
   const th=await thumb(f),base=Date.now()+'-'+f.name.replace(/[^\w.-]/g,'_'),ps=[];let sent=0;
   for(let i=0;i<n;i++){
    msg(E?`Chiffrement partie ${i+1}/${n}…`:`Préparation partie ${i+1}/${n}…`);
    const sl=E?await encPart(f,i,nonce):(n>1?f.slice(i*PART,(i+1)*PART):f),name=n>1?`${base}.part${String(i+1).padStart(3,'0')}`:base;let j;
    for(let t=1;;t++){
     try{j=await xput(`https://uploads.github.com/repos/${S.repo}/releases/${p.rel}/assets?name=${encodeURIComponent(name)}`,sl,E?'application/octet-stream':(f.type||'application/octet-stream'),l=>{const el=$('#prog');if(el)el.innerHTML=`<div class="t">${E?'🔒 ':''}${esc(f.name)} — ${Math.round((sent+l)/tot*100)}%${n>1?` (partie ${i+1}/${n})`:''}</div><progress value="${sent+l}" max="${tot}"></progress>`});break}
     catch(e){if(t>=3)throw e;msg('Nouvelle tentative, partie '+(i+1)+'…')}}
    sent+=sl.size;ps.push({id:j.id,size:sl.size});
   }
   await mut(d=>pr(d).assets.push({id:ps[0].id,parts:(n>1||E)?ps:undefined,name:f.name,size:f.size,mime:f.type,enc:E?{n:b64u(nonce),bs:BS}:undefined,kind,by:S.me,at:Date.now(),th}),(kind=='final'?'Montage ajouté : ':'Rush ajouté : ')+f.name+(E?' 🔒':''));
  }msg('Upload terminé')
 }catch(e){msg(e.message)}
}
async function blob(id){const r=await gh(`/repos/${S.repo}/releases/assets/${id}`,{headers:{Accept:'application/octet-stream'}});if(!r.ok)throw Error('Téléchargement impossible');return r.blob()}
async function swOk(){if(!('serviceWorker' in navigator))return false;
 try{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await Promise.race([new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true})),new Promise(r=>setTimeout(r,3000))]);
  return !!navigator.serviceWorker.controller}catch{return false}}
async function prep(a){const ps=parts(a);await idbSet('m:'+a.id,{size:a.size,mime:a.mime,parts:ps,enc:a.enc,encSize:ps.reduce((x,p)=>x+p.size,0)});await syncCfg();return{repo:S.repo,tok:S.tok,key:S.key||null}}
const mmss=t=>Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
async function play(id){
 const a=pr().assets.find(x=>x.id==id);
 if(a.enc&&!S.key)return msg("Fichier chiffré : entre le mot de passe d'équipe dans Réglages");
 try{await prep(a);
  if(!await swOk())return msg('Lecture en direct indisponible dans ce navigateur : télécharge le fichier.');
  const t=(a.mime||'video/mp4').split('/')[0],u='_s/'+a.id,tag=t=='audio'?'audio':'video';S.cur=id;
  $('#pl').innerHTML=t=='image'?`<img src="${u}" alt="" style="max-width:100%;border-radius:10px;margin-bottom:12px">`:`<${tag} controls autoplay playsinline src="${u}" style="width:100%"></${tag}>`;
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
async function delA(id){if(!confirm('Supprimer ce fichier ?'))return;const a=pr().assets.find(x=>x.id==id);for(const q of parts(a))await gh(`/repos/${S.repo}/releases/assets/${q.id}`,{method:'DELETE'});mut(d=>{const p=pr(d);p.assets=p.assets.filter(x=>x.id!=id)},'Fichier supprimé : '+a.name)}
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
