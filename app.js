'use strict';
const $=id=>document.getElementById(id);let v=$('video');
// 이음새 없는 재생: 다음 파트를 숨은 두 번째 <video>에 미리 받아 두었다가, 현재 파트가 끝나는 순간 맞바꿔요.
let nv=v.cloneNode(false);nv.removeAttribute('id');nv.removeAttribute('src');nv.className='vbuf';nv.dataset.part='';v.after(nv);
const H={};
const durations=[313.8,234.8,212.733333],offset=[0,313.8,548.6],defaultOffset=[...offset];let total=761.333333;
const pidx=t=>{let k=0;for(let i=0;i<offset.length;i++)if(t>=offset[i])k=i;return k};
function setOff(a,t=761.333333){offset.length=0;offset.push(...a);total=t;$('seek').max=t}
let pickedFiles=null,pickedUrls=[];let hostedUrls=null;const partSrc=p=>pickedFiles?pickedFiles[p]:hostedUrls?hostedUrls[p]:`media/part${p+1}.mp4`;
const defaultCues=[346.8,548.6];let cues=[...defaultCues];try{const c=JSON.parse(localStorage.getItem('field-cues-after-scene-v2'));if(Array.isArray(c)&&c.length===2&&c.every((n,i)=>Number.isFinite(n)&&n>=0&&n<total))cues=c;}catch{}
let part=0,completed=new Set(),active=null,returnPoint=null,timerId=null,elapsed=0,loadId=0,transitioning=false,transitionId=0;
const fmt=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const globalTime=()=>offset[part]+v.currentTime;
function say(s){$('status').textContent=s}
function play(){if(active!==null||transitioning)return;v.play().catch(()=>say('눌러서 재생'));}
function go(t,auto=true){cues.forEach((c,i)=>{if(t>c+.25)completed.add(i)});t=Math.max(0,Math.min(total-.05,t));const p=pidx(t);const local=t-offset[p];const id=++loadId;$('welcome').hidden=true;$('ending').hidden=true;if(p!==part){if(nv.dataset.part===String(p)&&nv.readyState>=1){swapIn(p,local,auto);}else{part=p;v.src=partSrc(p);v.onloadedmetadata=()=>{if(id!==loadId)return;v.currentTime=local;if(auto)play();};v.load();}}else{v.currentTime=local;if(auto)play();}say('영상 재생');prime();}
function reset(){closeGame();completed.clear();$('ending').hidden=true;if(window.FieldLive)FieldLive.onReset();go(0);}
$('start').onclick=()=>go(0);$('restart').onclick=reset;
$('play').onclick=()=>{if(active!==null||transitioning)return;if(!$('ending').hidden){reset();return}$('welcome').hidden=true;v.paused?play():v.pause();};
H.onclick=()=>$('play').click();H.onplay=()=>{$('play').textContent='Ⅱ';say('영상 재생');document.dispatchEvent(new Event('fn-video-play'));prime()};H.onpause=()=>{$('play').textContent='▶';if(active===null)say('일시정지')};
function pointAt(t){const p=pidx(t);return {part:p,time:t-offset[p]};}
function dueCue(){return cues.findIndex((t,i)=>!completed.has(i)&&globalTime()+.015>=t);}
function checkCue(){if(active!==null||transitioning||v.seeking||v.paused||!$('welcome').hidden)return;const i=dueCue();if(i>=0){v.pause();beginMission(i,pointAt(cues[i]));}}
H.ontimeupdate=()=>{$('clock').textContent=`${fmt(globalTime())} / ${fmt(total)}`;$('seek').value=globalTime();checkCue()};
H.onended=()=>{if(active!==null||transitioning)return;const i=dueCue();if(i>=0){beginMission(i,pointAt(cues[i]));return;}if(part<offset.length-1)go(offset[part+1]);else{$('ending').hidden=false;say('발표 종료')}};
function beginMission(i,point){v.pause();transitionId++;transitioning=true;returnPoint=point;active=i;$('seek').disabled=true;$('play').disabled=true;$('bridgeLabel').textContent=`장면을 돌아보며 · MISSION 0${i+1}`;$('bridgeTitle').textContent=i===0?'원리를 이해하면, 길이 보입니다.':'작은 차이를 발견하는 눈.';$('bridgeDesc').textContent=i===0?'아버지가 배관 문제를 해결하고 신뢰를 얻는 과정을 보았습니다. 이번에는 우리가 직접 연결 원리를 찾아볼까요?':'도면과 현장의 5cm 차이. 작은 오차를 미리 발견한 장면을 떠올리며, 직접 비교해보세요.';$('bridgeAction').textContent='함께 도전하기 →';$('bridgeAction').hidden=false;$('bridgeAction').onclick=()=>{transitioning=false;$('bridge').hidden=true;openGame(i,point)};$('bridge').hidden=false;say('장면 완료 · 미션 안내');if(window.FieldLive)FieldLive.onMission(i);}
function resumeStory(){const i=active,p=returnPoint;if(i===null||transitioning)return;completed.add(i);clearInterval(timerId);transitioning=true;$('bridgeLabel').textContent='BACK TO THE STORY';$('bridgeTitle').textContent='이제, 다음 이야기로.';$('bridgeDesc').textContent=i===0?'현장에서 쌓은 경험은 새로운 도전으로 이어집니다.':'세심한 판단이 쌓여, 현장을 이끄는 힘이 됩니다.';$('bridgeAction').hidden=true;$('bridge').hidden=false;const id=++transitionId;setTimeout(()=>{if(id!==transitionId)return;closeGame();v.classList.remove('resumeFade');void v.offsetWidth;v.classList.add('resumeFade');go(offset[p.part]+p.time)},1500);}
H.onerror=()=>say(pickedFiles?'영상 로딩 실패 · 다시 선택':'영상 파일이 없어요 · 「영상 선택」으로 넣어주세요');
Object.assign(v,H);
function prime(){const np=part+1;if(np<1||np>=offset.length||offset[np]<=offset[part])return;if(nv.dataset.part===String(np))return;nv.dataset.part=String(np);nv.preload='auto';nv.src=partSrc(np);nv.load()}
function swapIn(p,local,auto){const old=v,nu=nv;['onclick','onplay','onpause','ontimeupdate','onended','onerror','onloadedmetadata'].forEach(k=>old[k]=null);nu.muted=old.muted;if(Math.abs(nu.currentTime-local)>.02)nu.currentTime=local;nu.id='video';old.removeAttribute('id');v=nu;nv=old;Object.assign(v,H);part=p;if(auto)v.play().catch(()=>say('눌러서 재생'));nu.classList.remove('vbuf');old.classList.add('vbuf');old.pause();nv.dataset.part='';nv.removeAttribute('src');nv.load();}
(function loop(){requestAnimationFrame(loop);if(active!==null||transitioning||v.paused||v.seeking)return;const np=part+1;if(np>=offset.length||nv.dataset.part!==String(np)||nv.readyState<3)return;const d=v.duration;if(Number.isFinite(d)&&d-v.currentTime<=.06){if(dueCue()>=0)return;swapIn(np,0,true);prime()}})();
// 발표자 기기에서 영상 파일 고르기: 개수 제한 없음(이름 순서대로 이어 붙여요). 파일은 이 기기에서만 재생돼요(서버·청중에게 전송 안 됨).
async function setVideos(list){
  const fs=[...list].filter(f=>/^video\//.test(f.type)||/\.(mp4|mov|m4v|webm)$/i.test(f.name));
  if(!fs.length){say('영상 파일을 선택하세요');return}
  fs.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  say(`영상 ${fs.length}개 길이 읽는 중…`);
  const durs=await Promise.all(fs.map(readDur));
  const bad=durs.findIndex(d=>!(d>0));
  if(bad>=0){say(`「${fs[bad].name}」의 길이를 읽지 못했어요 · mp4(H.264) 파일인지 확인하세요`);return}
  pickedUrls.forEach(u=>URL.revokeObjectURL(u));pickedUrls=fs.map(f=>URL.createObjectURL(f));
  pickedFiles=pickedUrls;
  const off=[];let s=0;durs.forEach(d=>{off.push(s);s+=d});
  setOff(off,s);
  part=-1;nv.dataset.part='';closeGame();completed.clear();v.src=pickedFiles[0];v.load();
  say(`영상 선택됨 · ${fs.length}개 · 총 ${fmt(s)}`);
}
$('pickVideo').onclick=()=>{if(active!==null||transitioning)return;$('videoFile').click()};
$('videoFile').onchange=e=>{if(e.target.files.length)setVideos(e.target.files);e.target.value=''};
// A short interval keeps the pause near the intended frame even when timeupdate is sparse.
setInterval(checkCue,50);
$('seek').onchange=e=>{if(active!==null||transitioning)return;go(Number(e.target.value),!v.paused)};
$('mute').onclick=()=>{v.muted=!v.muted;$('mute').textContent=v.muted?'소리 꺼짐':'소리 켜짐'};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.body.requestFullscreen)await document.body.requestFullscreen();else say('브라우저 전체 화면을 사용하세요')}catch{say('전체 화면을 열 수 없어요')}}
$('full').onclick=fullscreen;
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)||$('settings').open)return;if(e.code==='Space'){e.preventDefault();$('play').click()}if(e.key.toLowerCase()==='f')fullscreen()});
document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{const t=Number(b.dataset.jump);closeGame();if(t===0)completed.clear();go(t)});
document.querySelectorAll('[data-mission]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.mission);v.pause();$('welcome').hidden=true;$('ending').hidden=true;closeGame();beginMission(i,pointAt(cues[i]))});
$('settingsBtn').onclick=()=>{if(active!==null||transitioning)return;v.pause();$('cue0').value=cues[0];$('cue1').value=cues[1];$('settings').showModal()};
$('saveSettings').onclick=()=>{const c=[Number($('cue0').value),Number($('cue1').value)];if(!c.every((n,i)=>Number.isFinite(n)&&n>=0&&n<total)){alert('각 영상 길이 안의 초 단위 시점을 입력해주세요.');return}cues=c;try{localStorage.setItem('field-cues-after-scene-v2',JSON.stringify(c))}catch{}$('settings').close()};
$('defaults').onclick=()=>{$('cue0').value=defaultCues[0];$('cue1').value=defaultCues[1]};
function closeGame(){transitionId++;transitioning=false;$('bridge').hidden=true;clearInterval(timerId);active=null;$('game').hidden=true;$('seek').disabled=false;$('play').disabled=false;if(window.FieldLive)FieldLive.stop();}
function openGame(i,point,local){if(!local&&window.FieldLive&&FieldLive.start(i)){v.pause();clearInterval(timerId);active=i;returnPoint=point;$('game').hidden=true;$('seek').disabled=true;$('play').disabled=true;say('참여 미션 · 청중 휴대폰 연결');return;}if(window.FieldLive)FieldLive.stop();v.pause();clearInterval(timerId);active=i;returnPoint=point;$('game').hidden=false;$('seek').disabled=true;$('play').disabled=true;elapsed=0;$('timer').textContent='00:00';timerId=setInterval(()=>{$('timer').textContent=fmt(++elapsed)},1000);$('gameLabel').textContent=`FIELD MISSION / 0${i+1}`;$('gameTitle').textContent=i===0?'배관을 연결하라.':'5cm의 차이를 찾아라.';$('gameDesc').textContent=i===0?'배관 조각을 클릭해서 회전시키고, 왼쪽 입구에서 오른쪽 출구까지 연결하세요.':'왼쪽 설계도와 오른쪽 현장을 비교해, 다른 치수 4개를 오른쪽에서 선택하세요. 차이가 아주 작을 수 있어요.';$('continue').textContent='미션 건너뛰고 이어보기 →';$('feedback').textContent='함께 의논하고 답을 골라보세요.';say('참여 미션');i===0?renderPipes():renderDrawings();}
$('continue').onclick=resumeStory;
$('resetGame').onclick=()=>{if(active!==null)openGame(active,returnPoint,true)};
function solved(message){$('feedback').textContent=message;$('continue').textContent='미션 완료 · 이야기 이어보기 →';clearInterval(timerId)}
// Pipe connectors are N/E/S/W. Only a connected inlet-to-outlet route wins.
let tiles=[];
const pipeBase=[[1,3],[0,1],[0,1],[1,3],[0,1],[0,1],[1,3],[0,1],[1,3],[1,3],[1,3],[0,2],[1,3],[0,1],[1,3],[0,1]];
function renderPipes(){tiles=pipeBase.map((s,i)=>({base:s,rot:[0,1,2,1,2,0,1,3,1,1,0,2,0,3,1,1][i]}));$('gameBody').innerHTML='<div class="pipeGuide"><span>INLET ↘</span><br><b>길은 하나가<br>아닐 수 있어요.</b><p>조각을 눌러 90° 회전<br>왼쪽 첫 줄 → 오른쪽 마지막 줄</p><small>원리 파악 → 경로 설계 → 검증</small></div><div class="pipes" aria-label="4 곱하기 4 배관 퍼즐"></div>';drawPipes();}
function connectors(t){return t.base.map(n=>(n+t.rot)%4)}
function route(){const seen=new Set();if(!connectors(tiles[0]).includes(3))return seen;const q=[0];seen.add(0);while(q.length){const i=q.shift();for(const d of connectors(tiles[i])){const r=Math.floor(i/4),c=i%4;let nr=r+[-1,0,1,0][d],nc=c+[0,1,0,-1][d];if(nr<0||nr>3||nc<0||nc>3)continue;const j=nr*4+nc;if(connectors(tiles[j]).includes((d+2)%4)&&!seen.has(j)){seen.add(j);q.push(j)}}}return seen}
function drawPipes(){const seen=route(),win=seen.has(15)&&connectors(tiles[15]).includes(1);const grid=document.querySelector('.pipes');grid.innerHTML='';tiles.forEach((t,i)=>{let path=connectors(t).map(d=>`M 30 30 L ${[30,60,30,0][d]} ${[0,30,60,30][d]}`).join(' ');const b=document.createElement('button');b.className='pipe'+(seen.has(i)?' flow':'');b.setAttribute('aria-label',`${Math.floor(i/4)+1}행 ${i%4+1}열 배관 회전`);b.innerHTML=`<svg viewBox="0 0 60 60" aria-hidden="true"><path d="${path}"/><circle cx="30" cy="30" r="5" fill="#fff"/></svg>`;b.onclick=()=>{t.rot=(t.rot+1)%4;drawPipes();document.querySelectorAll('.pipe')[i].focus()};grid.append(b)});if(win)solved('연결 성공! 전체를 뜯어내기 전에, 연결 원리와 경로부터 확인했습니다.');else{$('feedback').textContent='밝게 표시된 배관은 입구와 연결되어 있어요. 출구까지 이어보세요.';$('continue').textContent='미션 건너뛰고 이어보기 →'}}
let found=new Set();const spec=[120,80,150,60,200,90,45,110],actual=[120,82,150,58,200,96,45,101],need=spec.filter((n,i)=>n!==actual[i]).length;
function drawing(right){return `<div class="drawing"><h3>${right?'B / 실제 현장 · 다른 치수를 클릭':'A / 설계 도면 · 기준 치수'}</h3><svg viewBox="0 0 440 245" aria-label="${right?'현장':'설계'} 치수 도면"><defs><pattern id="grid${right}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#2b4648" stroke-width=".6"/></pattern></defs><rect width="440" height="245" fill="url(#grid${right})"/><path d="M20 170H85V65H220V170H350V65H420" fill="none" stroke="#8dbbbd" stroke-width="8"/><g fill="#172f31" stroke="#c3dddd" stroke-width="2"><circle cx="85" cy="170" r="8"/><circle cx="220" cy="65" r="8"/><circle cx="350" cy="170" r="8"/></g>${(right?actual:spec).map((n,i)=>{const x=[20,40,130,230,265,355,350,170][i],y=[190,92,22,92,190,92,22,190][i];return `<g ${right?`class="target ${found.has(i)?'found':''}" data-dim="${i}" tabindex="0" role="button" aria-label="치수 ${i+1}: ${n} 센티미터"`:''}><rect x="${x}" y="${y}" width="68" height="30" rx="4" fill="#1b3436" stroke="#527d7e"/><text x="${x+34}" y="${y+20}" text-anchor="middle">${n} cm</text></g>`}).join('')}</svg></div>`}
function renderDrawings(){found=new Set();paintDrawings()}
function paintDrawings(){$('gameBody').innerHTML=`<div class="drawings">${drawing(false)}${drawing(true)}</div>`;document.querySelectorAll('[data-dim]').forEach(g=>{const choose=()=>{const i=Number(g.dataset.dim);if(spec[i]===actual[i]){$('feedback').textContent='이 치수는 도면과 같아요. 다른 지점을 다시 비교해보세요.';return}found.add(i);paintDrawings();$('feedback').textContent=`발견 ${found.size} / ${need} · 작은 차이를 먼저 발견하면 재시공을 예방할 수 있어요.`;if(found.size===need)solved('4곳 모두 발견! 80→82, 60→58, 90→96, 110→101cm. 작은 차이가 큰 재시공이 됩니다.')};g.onclick=choose;g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}}})}

// 페이지에 올려 둔 영상(assets + db): 편집 권한자가 「영상 업로드」로 파트(20MiB 이하)를 여러 개 올리면 링크를 여는 누구나 이어서 재생해요.
let vids=[]; // [{url,dur}]
function applyHosted(){
  if(!vids.length||!vids.every(x=>x&&x.url&&x.dur>0))return false;
  const off=[];let s=0;vids.forEach(x=>{off.push(s);s+=x.dur});
  hostedUrls=vids.map(x=>x.url);setOff(off,s);
  if(!pickedFiles&&active===null){part=-1;nv.dataset.part='';completed.clear();v.src=hostedUrls[0];v.load();say(`업로드된 영상 · ${vids.length}개 파트`);}
  return true;
}
const readDur=f=>new Promise(res=>{const u=URL.createObjectURL(f),e=document.createElement('video');e.preload='metadata';const done=d=>{URL.revokeObjectURL(u);res(Number.isFinite(d)?d:0)};e.onloadedmetadata=()=>done(e.duration);e.onerror=()=>done(0);e.src=u});
(async()=>{
  if(!window.claude||!claude.use)return;
  let db=null,assets=null;
  try{
    db=await claude.use('db');
    if(db){const s=await db.doc('config/video').get();if(s.exists){const d=s.data()||{};if(Array.isArray(d.parts))vids=d.parts.filter(x=>x&&x.url);applyHosted();}}
  }catch{}
  try{assets=await claude.use('assets');}catch{}
  if(!assets||!db)return;
  const msg=t=>{$('upMsg').textContent=t},save=()=>db.doc('config/video').set({parts:vids,updatedAt:Date.now()});
  let target=0;
  function list(){
    const ul=$('upList');ul.innerHTML='';
    const row=(label,btns)=>{const li=document.createElement('li');li.style.cssText='display:flex;gap:10px;align-items:center;justify-content:space-between';const sp=document.createElement('span');sp.textContent=label;li.append(sp,...btns);ul.append(li)};
    const btn=(t,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=fn;return b};
    vids.forEach((x,k)=>row(`파트 ${k+1} · ${fmt(x.dur)} ✔`,[btn('다시 올리기',()=>{target=k;$('uploadFile').click()})]));
    row(vids.length?`총 ${vids.length}개 · ${fmt(vids.reduce((s,x)=>s+x.dur,0))}`:'아직 올라간 파트가 없어요',[btn(vids.length?'파트 추가':'올리기 (여러 개 선택 가능)',()=>{target=vids.length;$('uploadFile').click()})]);
    if(vids.length)row('처음부터 다시 올릴 때',[btn('모두 지우기',async()=>{vids=[];try{await save()}catch{}list();msg('모두 지웠어요')})]);
  }
  $('uploadVideo').hidden=false;
  $('uploadVideo').onclick=()=>{if(active!==null||transitioning)return;v.pause();msg('');list();$('uploader').showModal()};
  $('uploadFile').onchange=async e=>{
    const fs=[...e.target.files].filter(f=>/^video\//.test(f.type)||/\.(mp4|mov|m4v|webm)$/i.test(f.name));e.target.value='';
    if(!fs.length){msg('영상 파일을 선택하세요');return}
    fs.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
    const big=fs.find(f=>f.size>20*1024*1024);
    if(big){msg(`「${big.name}」이(가) ${(big.size/1048576).toFixed(1)}MiB예요. 20MiB 이하로 나눠 주세요`);return}
    for(let i=0;i<fs.length;i++){
      const f=fs[i],slot=target+i;
      msg(`${i+1}/${fs.length} 업로드 중… ${f.name} (${(f.size/1048576).toFixed(1)}MiB)`);
      try{
        const dur=await readDur(f);if(!(dur>0)){msg(`「${f.name}」의 길이를 읽지 못했어요. mp4(H.264) 파일인지 확인하세요`);break}
        const r=await assets.upload(f);
        vids[slot]={url:r.url,dur};vids=vids.filter(Boolean);await save();list();
      }catch(err){msg('업로드 실패 · '+((err&&(err.code||err.message))||'오류'));return}
    }
    const ok=applyHosted();list();
    if(ok)msg(`완료 · ${vids.length}개 파트, 총 ${fmt(vids.reduce((s,x)=>s+x.dur,0))}`);
  };
})();

// 발표용 서버(server.py)에서는 media 폴더의 영상을 이름 순서대로 자동으로 불러와요. 개수 제한 없음.
const readDurUrl=u=>new Promise(res=>{const e=document.createElement('video');e.preload='metadata';const done=d=>res(Number.isFinite(d)?d:0);e.onloadedmetadata=()=>done(e.duration);e.onerror=()=>done(0);e.src=u});
(async()=>{
  if(!/^https?:$/.test(location.protocol))return;
  try{
    let j=null;
    try{const r=await fetch('api/media',{cache:'no-store'});if(r.ok&&/json/.test(r.headers.get('content-type')||''))j=await r.json()}catch{}
    if(!j||!j.files||!j.files.length){const r2=await fetch('media/list.json',{cache:'no-store'});if(!r2.ok)return;j=await r2.json()}
    if(!j.files||!j.files.length)return;
    say(`media 폴더의 영상 ${j.files.length}개 불러오는 중…`);
    const durs=await Promise.all(j.files.map(n=>readDurUrl('media/'+encodeURIComponent(n))));
    const bad=durs.findIndex(d=>!(d>0));
    if(bad>=0){say(`「${j.files[bad]}」을(를) 읽지 못했어요 · mp4(H.264) 파일인지 확인하세요`);return}
    vids=j.files.map((n,i)=>({url:'media/'+encodeURIComponent(n),dur:durs[i]}));
    if(applyHosted())say(`영상 자동 불러옴 · ${vids.length}개 · 총 ${fmt(total)}`);
  }catch{}
})();
