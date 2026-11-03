/* 발표자 화면: 현장 무전 기록(채팅) + 라이브 미션 2종
   미션 1 · 청중이 휴대폰에서 배관을 완성할 때마다 메인 보일러 압력이 0%를 향해 떨어짐
   미션 2 · 청중이 도면 결함을 찾을 때마다 설계도의 해당 좌표에 붉은 경고 마커가 '쾅!' 찍힘
   app.js 는 FieldLive.onMission(i)(안내 알림) · start(i)(미션 화면 열기) · stop()(닫기)만 호출해요. */
(function () {
  'use strict';
  var C = window.FIELD_CONFIG, BP = window.FieldBP;
  var $ = function (id) { return document.getElementById(id); };
  var vid = { get paused() { return $('video').paused; }, get currentTime() { return $('video').currentTime; }, addEventListener: function (t, f) { document.addEventListener('fn-video-' + t, f); } }; // 영상이 파트마다 바뀌어도 현재 영상을 따라가요

  var state = {}, cur = null, isAdmin = false, memberCount = 0, fired = {};

  /* ---------- 공통 ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(ts) { var d = new Date(ts || Date.now()); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function toast(msg) {
    var t = $('qToast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  function st(obj) { obj.updatedAt = RT.TS; return RT.update('state', obj); }
  function gTime() { return typeof globalTime === 'function' ? globalTime() : (vid.currentTime || 0); }
  function sysChat(text) { return RT.push('chat', { type: 'system', uid: RT.uid, nick: 'SYSTEM', text: text, ts: RT.TS }); }
  function canRun() { return !!(window.RT && RT.set && RT.ok && (isAdmin || RT.mode === 'local')); }

  /* ---------- 무전 기록(채팅) ---------- */
  function addLine(key, m) {
    var log = $('radioLog');
    var li = el('li', m.type === 'system' ? 'sys' : 'msg');
    li.appendChild(el('time', null, '[' + clock(m.ts) + ']'));
    if (m.type === 'system') li.appendChild(el('b', null, m.text));
    else { li.appendChild(el('span', 'who', m.nick)); li.appendChild(el('span', 'arrow', '▸')); li.appendChild(el('span', 'txt', m.text)); }
    log.appendChild(li);
    while (log.children.length > 120) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
    $('radioEmpty').hidden = true;
  }
  function setConn() {
    var c = $('radioConn');
    if (RT.mode === 'local') { c.textContent = RT.error ? 'OFFLINE · 리허설' : 'REHEARSAL'; c.className = 'conn warn'; }
    else if (RT.ok) { c.textContent = 'LIVE'; c.className = 'conn on'; }
    else { c.textContent = 'RECONNECT'; c.className = 'conn warn'; }
    if (RT.mode === 'firebase' && !isAdmin) { c.textContent = '관전 모드'; c.className = 'conn warn'; }
  }
  function buildJoin() {
    function draw(url) {
      url.searchParams.set('room', C.room);
      var u = url.href, shown = u.replace(/^https?:\/\//, '');
      $('joinUrl').textContent = shown; $('radioUrl').textContent = shown; $('joinCard').hidden = false;
      if (RT.mode === 'http' && RT.room) { $('joinCode').textContent = RT.room; $('joinCodeRow').hidden = false; $('radioCode').textContent = '코드 ' + RT.room; }
      function paint() { try { var qr = qrcode(0, 'M'); qr.addData(u); qr.make(); $('joinQr').innerHTML = qr.createSvgTag({ scalable: true, margin: 0 }); } catch (e) { /* 주소만 보여요 */ } }
      if (window.qrcode) { paint(); return; }
      var s = document.createElement('script');
      s.src = 'qrcode.min.js'; s.onload = paint; // 이 폴더의 파일을 써서 인터넷이 없어도 QR이 떠요
      document.head.appendChild(s);
    }
    var url = new URL('play.html', location.href);
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (RT.mode === 'http' && local) { // 휴대폰은 localhost 로 못 들어오니, 이 컴퓨터의 내부 IP 주소로 바꿔요
      fetch('/api/lan', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.ips && j.ips.length) { url.hostname = j.ips[0]; if (j.port) url.port = String(j.port); }
        draw(url);
      }).catch(function () { draw(url); });
    } else draw(url);
  }

  /* ---------- 효과음 (막혀도 화면 연출은 계속) ---------- */
  var actx = null;
  function sfx(kind) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      if (kind === 'thud') { o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .25); g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.stop(t + .32); }
      else { o.type = 'square'; o.frequency.setValueAtTime(900, t); g.gain.setValueAtTime(.025, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); o.stop(t + .06); }
      o.connect(g); g.connect(actx.destination); o.start(t);
    } catch (e) { }
  }

  /* ---------- 미션 열기 / 닫기 ---------- */
  function start(i) {
    if (!window.RT || !RT.set || !RT.now) return false; // 준비 전이면 기존 화면 퍼즐로
    if (cur) teardown();
    var c = cur = { i: i, subs: [], timer: null, shown: 100, pressure: 100, count: 0, hits: {}, items: {} };
    $('mission').hidden = false; $('mission').dataset.m = i;
    $('mLabel').textContent = 'MISSION 0' + (i + 1);
    $('mTitle').textContent = i === 0 ? '극한 환경 통수 테스트' : '라이트박스 도면 검수';
    $('m1').hidden = i !== 0; $('m2').hidden = i !== 1;
    $('mDone').classList.remove('ready'); $('m1').classList.remove('safe');
    updateJoin();
    if (i === 0) initM1(); else initM2();
    if (!canRun()) toast('연결이 없어 청중 화면과 이어지지 않아요 · 「화면에서 직접 풀기」를 쓸 수 있어요');
    else {
      RT.remove(i === 0 ? 'm1' : 'm2').then(function () {
        if (cur !== c) return;
        return st({ phase: 'mission', mission: i, status: 'open', openedAt: RT.TS, pressure: 100 });
      }).then(function () {
        if (cur !== c) return;
        if (i === 0) c.subs.push(RT.on('m1/clears', onClears));
        else c.subs.push(RT.onChildAdded('m2/hits', onHit));
      });
    }
    return true;
  }
  function teardown() {
    if (!cur) return;
    clearInterval(cur.timer); cur.subs.forEach(function (u) { try { u(); } catch (e) { } });
    cur = null; $('mission').hidden = true;
  }
  function stop() {
    var had = cur; teardown();
    if (had && canRun()) st({ phase: 'story', mission: null, status: 'idle' });
  }
  function updateJoin() { $('mJoin').innerHTML = '접속 <b>' + memberCount + '</b>명'; }

  /* ---------- 미션 1 : 보일러 압력 ---------- */
  function initM1() {
    var segs = $('segs'); segs.textContent = '';
    for (var k = 0; k < 20; k++) segs.appendChild(document.createElement('i'));
    var b = $('boiler');
    if (window.ResizeObserver) { cur.ro = new ResizeObserver(function () { b.style.setProperty('--bs', b.clientWidth + 'px'); }); cur.ro.observe(b); }
    b.style.setProperty('--bs', (b.clientWidth || 300) + 'px');
    b.classList.remove('safe');
    paintPressure(100);
    $('m1Stat').textContent = '통수 성공 0 / ' + goal() + '명';
    $('m1State').textContent = '청중의 휴대폰에서 배관이 완성될 때마다 압력이 내려갑니다';
  }
  function goal() {
    var g = C.m1 && C.m1.goal; var n = (typeof g === 'number') ? g : memberCount;
    return Math.max((C.m1 && C.m1.minGoal) || 1, n);
  }
  function onClears(v) {
    if (!cur || cur.i !== 0) return;
    cur.count = v ? Object.keys(v).length : 0;
    if (v) { var last = Object.keys(v).map(function (k) { return v[k]; }).sort(function (a, b) { return b.ts - a.ts; })[0]; cur.last = last && last.nick; }
    recompute();
  }
  function recompute() {
    if (!cur || cur.i !== 0) return;
    var g = goal(), p = Math.round(100 * (1 - Math.min(1, cur.count / g)));
    $('m1Stat').textContent = '통수 성공 ' + cur.count + ' / ' + g + '명';
    if (p === cur.pressure) return;
    cur.pressure = p;
    if (canRun()) st({ pressure: p });
    if (!cur.timer) cur.timer = setInterval(dropStep, 45);
  }
  function dropStep() {
    if (!cur) return;
    var diff = cur.shown - cur.pressure;
    if (diff === 0) { clearInterval(cur.timer); cur.timer = null; return; }
    cur.shown += diff > 0 ? -(diff > 24 ? 2 : 1) : (diff < -24 ? 2 : 1);
    paintPressure(cur.shown, diff > 0);
    if (diff > 0) sfx('tick');
    if (cur.shown <= 0) {
      $('boiler').classList.add('safe'); $('m1').classList.add('safe');
      $('m1State').textContent = 'SAFE · 압력 안정화 완료' + (cur.last ? ' — 마지막 통수 ' + cur.last : '');
      $('mDone').classList.add('ready'); sfx('thud');
      if (C.m1 && C.m1.autoNext && !cur.autoT) { var c0 = cur; cur.autoT = setTimeout(function () { if (cur === c0) finish(); }, C.m1.autoNextMs || 3000); }
    } else { $('boiler').classList.remove('safe'); $('m1').classList.remove('safe'); $('mDone').classList.remove('ready'); }
  }
  function paintPressure(p, tick) {
    var b = $('boiler');
    b.dataset.level = p > 60 ? 'hi' : p > 25 ? 'mid' : p > 0 ? 'low' : 'zero';
    $('pNum').textContent = p;
    $('ringFill').style.strokeDashoffset = String(100 - p);
    var on = Math.ceil(p / 5), lv = p > 60 ? '' : p > 25 ? 'mid' : 'low', s = $('segs').children;
    for (var k = 0; k < s.length; k++) s[k].className = k < on ? 'on ' + lv : '';
    if (tick) { b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); }
  }

  /* ---------- 미션 2 : 도면 마커 ---------- */
  function initM2() {
    var defs = BP.defects(), bp = $('bp');
    bp.style.setProperty('--asp', BP.aspect);
    var art = $('bpArt'); art.textContent = ''; art.appendChild(BP.layer(false));
    $('bpMarks').textContent = '';
    var ol = $('dList'); ol.textContent = '';
    defs.forEach(function (d, k) { var li = el('li', null, '#' + (k + 1) + ' · 미확인'); ol.appendChild(li); cur.items[d.id] = { li: li, n: k + 1, d: d }; });
    $('m2Stat').textContent = '발견 0 / ' + defs.length;
  }
  function onHit(key, h) {
    if (!cur || cur.i !== 1) return;
    var it = cur.items[h.defect]; if (!it) return;
    var d = it.d, rec = cur.hits[d.id];
    if (!rec) {
      var mk = el('div', 'mk'); mk.style.left = (d.x * 100) + '%'; mk.style.top = (d.y * 100) + '%';
      mk.appendChild(el('div', 'core', '!'));
      var badge = el('b', null, '1'); badge.hidden = true; mk.appendChild(badge);
      $('bpMarks').appendChild(mk);
      rec = cur.hits[d.id] = { n: 1, mk: mk, badge: badge };
      it.li.className = 'on'; it.li.textContent = '#' + it.n + ' · ' + (d.note || '결함');
      it.cnt = el('em', null, '×1'); it.li.appendChild(it.cnt);
      var bp = $('bp'); bp.classList.remove('slam'); void bp.offsetWidth; bp.classList.add('slam');
      sfx('thud');
      var found = Object.keys(cur.hits).length, total = Object.keys(cur.items).length;
      $('m2Stat').textContent = '발견 ' + found + ' / ' + total;
      if (found === total) { $('mDone').classList.add('ready'); toast('전 결함 검출 완료 · 재시공 0회'); }
    } else {
      rec.n++; rec.badge.hidden = false; rec.badge.textContent = rec.n; it.cnt.textContent = '×' + rec.n;
      rec.mk.classList.remove('bump'); void rec.mk.offsetWidth; rec.mk.classList.add('bump');
    }
  }

  /* ---------- 참여자 현황 (이름 · 미션별 완료 · 소요시간) ---------- */
  var roster = { members: {}, clears: {}, hits: {}, done2: 0 };
  function fmtSec(ms) { return (ms / 1000).toFixed(1) + '초'; }
  function drawRoster() {
    var ids = Object.keys(roster.members).sort(function (a, b) { return (roster.members[a].joinedAt || 0) - (roster.members[b].joinedAt || 0); });
    var total = BP.defects().length, body = $('rosterBody'), per = {}, done2 = 0;
    Object.keys(roster.hits).forEach(function (k) { var h = roster.hits[k]; var p = per[h.uid] = per[h.uid] || { n: 0, ms: 0 }; p.n++; p.ms = Math.max(p.ms, h.ms || 0); });
    body.textContent = '';
    $('rosterCount').textContent = ids.length;
    if (!ids.length) { var tr = el('tr'), td = el('td', 'empty', '참여자를 기다리는 중…'); td.colSpan = 3; tr.appendChild(td); body.appendChild(tr); }
    ids.forEach(function (id) {
      var m = roster.members[id], c = roster.clears[id], h = per[id], row = el('tr');
      row.appendChild(el('td', null, m.nick));
      row.appendChild(el('td', c ? 'done' : 'pending', c ? '✓ ' + fmtSec(c.ms) : '대기'));
      var full = h && h.n >= total; if (full) done2++;
      row.appendChild(el('td', full ? 'done' : (h ? 'part' : 'pending'), full ? '✓ ' + fmtSec(h.ms) : (h ? h.n + ' / ' + total : '대기')));
      body.appendChild(row);
    });
    roster.done2 = done2;
  }

  /* ---------- 발표자 조작 ---------- */
  function finish() { if (cur && typeof resumeStory === 'function') resumeStory(); else toast('진행 중인 미션이 없어요'); }
  function solo() {
    if (!cur || typeof openGame !== 'function') return;
    var i = cur.i; stop(); openGame(i, returnPoint, true);
  }
  document.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA/.test(e.target.tagName) || ($('settings') && $('settings').open)) return;
    if (e.key === 'p' || e.key === 'P' || e.key === '?') { if (cur) { e.preventDefault(); finish(); } }
    else if (e.key === 'c' || e.key === 'C') {
      if (!canRun()) return;
      var lock = !state.chatLocked; st({ chatLocked: lock });
      toast(lock ? '무전 채널을 잠갔어요' : '무전 채널을 열었어요');
    }
  });
  $('mDone').onclick = function () {
    if (cur && !$('mDone').classList.contains('ready') && memberCount > 0) {
      var left = cur.i === 0 ? Math.max(0, memberCount - cur.count) : Math.max(0, memberCount - roster.done2);
      if (left > 0 && !confirm('아직 ' + left + '명이 미션을 끝내지 않았어요. 이야기로 넘어갈까요?')) return;
    }
    finish();
  }; $('mSolo').onclick = solo;

  /* ---------- 시스템 알림 ---------- */
  function postAlerts(tag) { if (!canRun()) return; C.alerts.forEach(function (a) { if (a.at === tag) sysChat(a.text); }); }
  setInterval(function () {
    if (!canRun() || vid.paused) return;
    var t = gTime();
    C.alerts.forEach(function (a, i) {
      if (typeof a.at !== 'number') return;
      if (t >= a.at && t < a.at + 3 && !fired[i]) { fired[i] = true; sysChat(a.text); }
      else if (t < a.at - 2) fired[i] = false;
    });
  }, 250);

  vid.addEventListener('play', function () {
    if (cur) teardown();
    if (canRun() && state.phase !== 'story') st({ phase: 'story', mission: null, status: 'idle' });
  });

  window.FieldLive = {
    onMission: function (i) { postAlerts('cue' + i); },
    start: start, stop: stop,
    onReset: function () { fired = {}; if (cur) stop(); if (canRun()) { RT.remove('chat'); RT.remove('m1'); RT.remove('m2'); st({ phase: 'story', mission: null, status: 'idle' }); } }
  };

  RT.ready.then(function () {
    buildJoin();
    if (RT.mode === 'http') { isAdmin = !!RT.isHost; return; }   // 서버 방식: 발표자 토큰으로 구분
    return RT.set('adminUid', RT.uid).then(function () { isAdmin = true; }).catch(function () { isAdmin = false; }); // 이 화면은 발표자만 열어요
  }).then(function () {
    setConn();
    document.addEventListener('rt-conn', setConn);
    if (RT.mode === 'http') {
      $('newRoom').hidden = false;
      $('newRoom').onclick = function () { if (confirm('새 방을 만들면 지금 방 코드는 더 이상 쓸 수 없어요. 계속할까요?')) RT.hostStart(true).then(function () { location.reload(); }); };
    }
    $('radioRefresh').onclick = function () { // 라이브 창 새로고침: 영상은 멈추지 않고 무전 기록·접속 인원·참여자 현황만 다시 불러와요
      var b = this; b.disabled = true; b.textContent = '불러오는 중';
      Promise.all([RT.get('chat'), RT.get('members'), RT.get('m1/clears'), RT.get('m2/hits'), RT.get('state')]).then(function (r) {
        var chat = r[0] || {}; $('radioLog').textContent = '';
        Object.keys(chat).sort().forEach(function (k) { addLine(k, chat[k]); });
        roster.members = r[1] || {}; roster.clears = r[2] || {}; roster.hits = r[3] || {}; drawRoster();
        memberCount = Object.keys(roster.members).length; $('radioCount').textContent = memberCount; $('joinCount').textContent = memberCount;
        state = r[4] || {}; $('radioLock').hidden = !state.chatLocked; setConn();
      }).catch(function () { }).then(function () { b.disabled = false; b.textContent = '새로고침'; });
    };
    $('radioClear').onclick = function () { $('radioLog').textContent = ''; if (canRun()) RT.remove('chat'); }; // 무전 기록 비우기 (발표자 화면 + 저장된 기록)
    $('rosterToggle').onclick = function () { var w = $('rosterWrap'); w.hidden = !w.hidden; this.textContent = w.hidden ? '펼치기' : '접기'; };
    RT.on('state', function (s) { state = s || {}; $('radioLock').hidden = !state.chatLocked; });
    RT.on('members', function (m) {
      memberCount = m ? Object.keys(m).length : 0;
      $('radioCount').textContent = memberCount; $('joinCount').textContent = memberCount;
      if (cur) { updateJoin(); if (cur.i === 0) recompute(); }
    });
    RT.onChildAdded('chat', addLine);
    RT.on('members', function (v) { roster.members = v || {}; drawRoster(); });
    RT.on('m1/clears', function (v) { roster.clears = v || {}; drawRoster(); });
    RT.on('m2/hits', function (v) { roster.hits = v || {}; drawRoster(); });
    if (isAdmin || RT.mode === 'local') st({ phase: 'story', mission: null, status: 'idle', chatLocked: false });
  });
})();
