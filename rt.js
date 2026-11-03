/* 실시간 통신 계층. ① 파이썬 서버(server.py) ② Firebase Realtime Database ③ 리허설 모드(localStorage)를 같은 인터페이스로 감쌉니다.
   우선순위: config.firebase 가 있으면 Firebase → 서버가 응답하면 server.py → 아니면 리허설 모드.
   RT.ready → 준비 끝나면 RT.uid, RT.mode('firebase'|'local'), RT.ok 가 채워져요.
   모든 경로는 rooms/{room}/ 아래로 자동 연결돼요. */
(function () {
  'use strict';
  var C = window.FIELD_CONFIG;
  var ROOT = 'rooms/' + C.room + '/';
  var RT = window.RT = { mode: 'local', ok: false, uid: null, TS: { __ts: 1 }, error: null, room: null, isHost: false };
  var impl = null;

  /* ---------- Firebase ---------- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function makeFirebase() {
    var db, offset = 0;
    var base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    var o = {
      init: function () {
        return loadScript(base + 'firebase-app-compat.js')
          .then(function () { return loadScript(base + 'firebase-auth-compat.js'); })
          .then(function () { return loadScript(base + 'firebase-database-compat.js'); })
          .then(function () {
            firebase.initializeApp(C.firebase);
            return firebase.auth().signInAnonymously();
          })
          .then(function (cred) {
            RT.uid = cred.user.uid;
            RT.TS = firebase.database.ServerValue.TIMESTAMP;
            db = firebase.database();
            db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });
            // 연결이 끊기면 알림
            db.ref('.info/connected').on('value', function (s) {
              RT.ok = !!s.val();
              document.dispatchEvent(new CustomEvent('rt-conn', { detail: RT.ok }));
            });
          });
      },
      now: function () { return Date.now() + offset; },
      ref: function (p) { return db.ref(ROOT + p); },
      set: function (p, v) { return o.ref(p).set(v); },
      update: function (p, v) { return o.ref(p).update(v); },
      push: function (p, v) { var r = o.ref(p).push(); r.set(v); return r.key; },
      remove: function (p) { return o.ref(p).remove(); },
      get: function (p) { return o.ref(p).once('value').then(function (s) { return s.val(); }); },
      on: function (p, cb) {
        var r = o.ref(p);
        var h = r.on('value', function (s) { cb(s.val()); });
        return function () { r.off('value', h); };
      },
      onChildAdded: function (p, cb) {
        var r = o.ref(p);
        var h = r.on('child_added', function (s) { cb(s.key, s.val()); });
        return function () { r.off('child_added', h); };
      }
    };
    return o;
  }

  /* ---------- 리허설 모드 (같은 브라우저의 탭끼리) ---------- */
  function makeLocal() {
    var KEY = 'fn_local_' + C.room;
    var subs = [];
    function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
    function save(t) { localStorage.setItem(KEY, JSON.stringify(t)); }
    function parts(p) { return p.split('/').filter(Boolean); }
    function getIn(t, p) { var a = parts(p); for (var i = 0; i < a.length; i++) { if (t == null || typeof t !== 'object') return undefined; t = t[a[i]]; } return t; }
    function setIn(t, p, v) {
      var a = parts(p), k = a.pop();
      for (var i = 0; i < a.length; i++) { if (typeof t[a[i]] !== 'object' || t[a[i]] === null) t[a[i]] = {}; t = t[a[i]]; }
      if (v === null || v === undefined) delete t[k]; else t[k] = v;
    }
    function resolve(v) {
      if (v && v.__ts) return Date.now();
      if (v && typeof v === 'object') { var o2 = Array.isArray(v) ? [] : {}; Object.keys(v).forEach(function (k) { o2[k] = resolve(v[k]); }); return o2; }
      return v;
    }
    function emit() { subs.slice().forEach(function (f) { f(); }); }
    window.addEventListener('storage', function (e) { if (e.key === KEY) emit(); });
    var o = {
      init: function () {
        var u = sessionStorage.getItem('fn_uid');
        if (!u) { u = 'L' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('fn_uid', u); }
        RT.uid = u; RT.ok = true; return Promise.resolve();
      },
      now: function () { return Date.now(); },
      set: function (p, v) { var t = load(); setIn(t, ROOT + p, resolve(v)); save(t); emit(); return Promise.resolve(); },
      update: function (p, obj) {
        var t = load();
        Object.keys(obj).forEach(function (k) { setIn(t, ROOT + p + '/' + k, resolve(obj[k])); });
        save(t); emit(); return Promise.resolve();
      },
      push: function (p, v) {
        var key = String(Date.now()).padStart(13, '0') + '-' + Math.random().toString(36).slice(2, 6);
        o.set(p + '/' + key, v); return key;
      },
      remove: function (p) { return o.set(p, null); },
      get: function (p) { var v = getIn(load(), ROOT + p); return Promise.resolve(v === undefined ? null : v); },
      on: function (p, cb) {
        var last = {};
        var f = function () {
          var v = getIn(load(), ROOT + p); if (v === undefined) v = null;
          var s = JSON.stringify(v);
          if (last === s) return; last = s; cb(v);
        };
        subs.push(f); setTimeout(f, 0);
        return function () { subs = subs.filter(function (x) { return x !== f; }); };
      },
      onChildAdded: function (p, cb) {
        var seen = {};
        var f = function () {
          var v = getIn(load(), ROOT + p) || {};
          Object.keys(seen).forEach(function (k) { if (!(k in v)) delete seen[k]; });
          Object.keys(v).sort().forEach(function (k) { if (!seen[k]) { seen[k] = 1; cb(k, v[k]); } });
        };
        subs.push(f); setTimeout(f, 0);
        return function () { subs = subs.filter(function (x) { return x !== f; }); };
      }
    };
    return o;
  }

  /* ---------- 파이썬 서버(server.py) : 긴 폴링 ---------- */
  function makeHttp() {
    var room = null, token = null, tree = {}, rev = -1, lastRev = -1, offset = 0, subs = [], polling = false, first = null, firstRes = null, online = null;
    first = new Promise(function (res) { firstRes = res; });
    function parts(p) { return p.split('/').filter(Boolean); }
    function getIn(t, p) { var a = parts(p); for (var i = 0; i < a.length; i++) { if (t == null || typeof t !== 'object') return undefined; t = t[a[i]]; } return t; }
    function emit() { subs.slice().forEach(function (f) { f(); }); }
    function setOk(v) { if (online !== v) { online = v; RT.ok = v; document.dispatchEvent(new CustomEvent('rt-conn', { detail: v })); } }
    function jf(url, opt) {
      opt = opt || {}; opt.headers = Object.assign({ 'Content-Type': 'application/json' }, token ? { 'X-Host-Token': token } : {}, opt.headers || {});
      opt.cache = 'no-store';
      return fetch(url, opt).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('요청 실패 (' + r.status + ')')); e.status = r.status; throw e; } return j; }); });
    }
    function apply(j) {
      if (j.now) offset = j.now - Date.now();
      if (j.same) { rev = j.rev; return; }
      if (j.rev >= lastRev) { rev = lastRev = j.rev; tree = j.tree || {}; emit(); firstRes(); }
    }
    function loop() {
      if (!room || polling) return; polling = true;
      var mine = room;
      jf('/api/rooms/' + mine + '/snap?rev=' + rev).then(function (j) { if (room !== mine) return; apply(j); setOk(true); polling = false; loop(); })
        .catch(function (e) {
          polling = false; if (room !== mine) return;
          if (e.status === 404) { RT.error = e.message; setOk(false); return; }
          setOk(false); rev = -1; setTimeout(loop, 1500);
        });
    }
    function ops(list) {
      return jf('/api/rooms/' + room + '/ops', { method: 'POST', body: JSON.stringify({ uid: RT.uid, ops: list }) }).then(function (j) { lastRev = Math.max(lastRev, j.rev || 0); if (j.now) offset = j.now - Date.now(); return j; });
    }
    var o = {
      init: function () {
        RT.uid = (function () { var k = 'fn_uid'; var u = null; try { u = localStorage.getItem(k); } catch (e) { }
          if (!u) { u = 'U' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6); try { localStorage.setItem(k, u); } catch (e) { } } return u; })();
        return jf('/api/ping').then(function (j) { if (j.server !== 'team8-live') throw new Error('not team8 server'); offset = j.now - Date.now(); });
      },
      // 발표 화면: 저장된 방을 복구하거나 새로 만들어요
      hostStart: function (forceNew) {
        var old = null; try { old = JSON.parse(localStorage.getItem('team8HostRoom') || 'null'); } catch (e) { }
        var make = function () {
          return jf('/api/rooms', { method: 'POST', body: '{}' }).then(function (j) {
            try { localStorage.setItem('team8HostRoom', JSON.stringify({ code: j.code, token: j.hostToken })); } catch (e) { }
            return o.useRoom(j.code, j.hostToken);
          });
        };
        if (old && old.code && old.token && !forceNew) {
          token = old.token;
          return jf('/api/rooms/' + old.code + '/check', { method: 'POST', body: '{}' }).then(function (j) { if (!j.host) throw new Error('no'); return o.useRoom(old.code, old.token); }).catch(make);
        }
        return make();
      },
      useRoom: function (code, tok) {
        code = String(code || '').toUpperCase().replace(/\s/g, '');
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return Promise.reject(new Error('방 코드는 영문과 숫자 6자리예요.'));
        token = tok || null;
        return jf('/api/rooms/' + code + '/snap?rev=-1').then(function (j) {
          room = code; RT.room = code; RT.isHost = !!tok && !!j.host; C.room = code; rev = lastRev = -1; apply(j); setOk(true); loop(); return code;
        });
      },
      now: function () { return Date.now() + offset; },
      set: function (p, v) { return ops([{ op: 'set', path: p, value: v === undefined ? null : v }]); },
      update: function (p, v) { return ops([{ op: 'update', path: p, value: v }]); },
      push: function (p, v) { ops([{ op: 'push', path: p, value: v }]).catch(function () { }); return null; },
      remove: function (p) { return ops([{ op: 'remove', path: p }]); },
      get: function (p) { return first.then(function () { var v = getIn(tree, p); return v === undefined ? null : v; }); },
      on: function (p, cb) {
        var last = {};
        var f = function () { var v = getIn(tree, p); if (v === undefined) v = null; var s = JSON.stringify(v); if (last === s) return; last = s; cb(v); };
        subs.push(f); first.then(f);
        return function () { subs = subs.filter(function (x) { return x !== f; }); };
      },
      onChildAdded: function (p, cb) {
        var seen = {};
        var f = function () {
          var v = getIn(tree, p) || {};
          Object.keys(seen).forEach(function (k) { if (!(k in v)) delete seen[k]; });
          Object.keys(v).sort().forEach(function (k) { if (!seen[k]) { seen[k] = 1; cb(k, v[k]); } });
        };
        subs.push(f); first.then(f);
        return function () { subs = subs.filter(function (x) { return x !== f; }); };
      }
    };
    return o;
  }

  /* ---------- 시작 ---------- */
  var ROLE = window.FIELD_ROLE || 'host';
  var wantFirebase = !!(C.firebase && C.firebase.databaseURL);
  function useLocal(reason) {
    impl = makeLocal(); RT.mode = 'local'; RT.error = reason || null;
    return impl.init();
  }
  function pick() {
    if (wantFirebase) {
      impl = makeFirebase(); RT.mode = 'firebase';
      return impl.init().catch(function (e) { console.warn('[RT] Firebase 연결 실패 → 리허설 모드로 전환', e); return useLocal(String(e && e.message || e)); });
    }
    if (/^https?:$/.test(location.protocol)) {
      var h = makeHttp();
      return h.init().then(function () {
        impl = h; RT.mode = 'http';
        var want = new URLSearchParams(location.search).get('room');
        if (ROLE === 'host') return h.hostStart();
        if (want) return h.useRoom(want).catch(function (e) { RT.error = e.message; });
      }).catch(function () { return useLocal(null); });
    }
    return useLocal(null);
  }
  RT.ready = pick().then(function () {
    ['now', 'set', 'update', 'push', 'remove', 'get', 'on', 'onChildAdded', 'useRoom', 'hostStart'].forEach(function (k) { if (impl[k]) RT[k] = impl[k]; });
    if (RT.mode === 'local') RT.ok = true;
    if (RT.mode === 'firebase') RT.room = C.room;
    if (RT.mode === 'local') { RT.room = C.room; RT.isHost = ROLE === 'host'; }
    return RT;
  });
})();
