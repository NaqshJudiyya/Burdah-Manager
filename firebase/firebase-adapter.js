// محوّل Firebase: بوابة دخول بحساب Google + صلاحيات (مدير / أعضاء) + مزامنة تلقائية مستمرة مع Realtime Database.
// البيانات تُخزَّن بالأقسام في burdah/{slug}/sections/{key} حتى يمكن فرض صلاحية كل قسم على الخادم في القواعد.
// يتطلب تحميل سكربتات firebase-*-compat.js من gstatic ثم firebase/config.js قبل هذا الملف.
(function () {
  const cfg = window.BURDA_FIREBASE_CONFIG;
  const adminEmail = ((cfg && cfg.adminEmail) || 'naqshjudiyya@gmail.com').trim().toLowerCase();
  const slug = (cfg && cfg.projectSlug) || 'default';
  const DATA_KEY = 'BURDA_MANAGER_DATA';
  const SAVED_AT_KEY = 'BURDA_MANAGER_SAVED_AT';
  const GATE_ID = 'burda-auth-gate';
  const SYNC_TIMEOUT_MS = 15000;

  // الأقسام: المفتاح = اسم الشاشة في النظام، والقيمة = مفتاح البيانات في DATA.
  // قسم settings يشمل أي مفتاح آخر غير مذكور (site, sourceSections, topics, articles, books...)
  const SECTION_DATA_KEYS = { poem: 'poem', chapters: 'chapters', verses: 'verses', explanations: 'explanations', sources: 'sources', dictionary: 'glossary', authors: 'authors' };

  function emailKey(e) { return String(e || '').trim().toLowerCase().replace(/\./g, '_'); }
  function setStatus(text, isError) {
    const el = document.getElementById('onlineStatus');
    if (el) { el.textContent = text; el.style.color = isError ? '#9a3030' : '#23624f'; }
  }

  // وضع آمن افتراضيًا حتى يكتمل الإعداد
  window.burdaFirebase = {
    push: function () {}, syncNow: function () {}, signOut: function () {},
    init: function () {}, saveMember: function () { return Promise.reject(new Error('لم يتم إعداد Firebase بعد')); }
  };
  window.burdaViewAllowed = function () { return true; };

  const notConfigured = !cfg || !cfg.apiKey || /^YOUR_/.test(cfg.apiKey) || /^YOUR_/.test(cfg.projectId || '') || !cfg.databaseURL;
  if (notConfigured) { showGate('config'); return; }

  try { firebase.initializeApp(cfg); } catch (e) { showGate('config'); return; }

  const auth = firebase.auth();
  const db = firebase.database();
  const slugRef = db.ref('burdah/' + slug);
  const membersRef = db.ref('burdah_members');
  const provider = new firebase.auth.GoogleAuthProvider();

  let hooks = null;         // { applyRemote(data), onPerms(), onMembers(list) } تُمرَّر من manager.js
  let ready = false;
  let isAdminFlag = false;
  let mySections = new Set(); // الأقسام المسموح للعضو بتعديلها
  let suppressPush = false;
  let saveTimer = null;
  let lastData = null;
  let lastSec = {};         // key -> {str, ts} آخر نسخة دُفعت/طُبقت لكل قسم

  window.burdaFirebase.init = function (h) { hooks = h; };
  window.burdaViewAllowed = function (v) {
    if (v === 'dashboard' || v === 'preview' || v === 'export') return true;
    if (v === 'members') return isAdminFlag;
    return isAdminFlag || mySections.has(v);
  };
  window.burdaFirebase.push = function (data) {
    lastData = data;
    if (suppressPush || !ready) return;
    try { localStorage.setItem(SAVED_AT_KEY, String(Date.now())); } catch (e) {}
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { pushNow(lastData); }, 1200);
  };
  window.burdaFirebase.syncNow = function () { if (ready && lastData) { clearTimeout(saveTimer); pushNow(lastData); } };
  window.burdaFirebase.signOut = function () { auth.signOut(); };
  window.burdaFirebase.saveMember = function (member, key) {
    if (!isAdminFlag) return Promise.reject(new Error('المدير فقط من يستطيع إدارة الأعضاء'));
    const r = membersRef.child(key);
    return member ? r.set(member) : r.remove();
  };

  showGate('loading');

  // الجلسة محفوظة محليًا (LOCAL persistence) — لا حاجة لتسجيل الدخول في كل مرة.
  auth.onAuthStateChanged(function (user) {
    if (!user) { showGate('login'); return; }
    const email = (user.email || '').toLowerCase();
    if (email === adminEmail) {
      isAdminFlag = true; mySections = new Set();
      removeGate();
      if (hooks && hooks.onPerms) hooks.onPerms();
      listenMembers();
      setStatus('جارٍ المزامنة…');
      startSync();
      return;
    }
    // عضو؟ اقرأ سجلّه من قائمة الأعضاء التي يديرها المدير
    membersRef.child(emailKey(email)).once('value').then(function (snap) {
      const rec = snap.val();
      if (!rec || rec.role == null) { showGate('unauthorized', user.email); return; }
      mySections = new Set(Object.keys(rec.sections || {}).filter(function (k) { return rec.sections[k] === true; }));
      removeGate();
      if (hooks && hooks.onPerms) hooks.onPerms();
      setStatus('جارٍ المزامنة…');
      startSync();
    }).catch(function (err) {
      setStatus('تعذر التحقق من الصلاحيات: ' + (err.code || err.message), true);
      showGate('unauthorized', user.email);
    });
  });

  // لعرض أخطاء الدخول عبر إعادة التوجيه (مثل نطاق غير مصرّح به)
  auth.getRedirectResult().catch(function (err) {
    if (!auth.currentUser && err && err.code) {
      showGate('login');
      const el = document.getElementById('gerr');
      if (el) el.textContent = err.code === 'auth/unauthorized-domain'
        ? 'أضف نطاق هذه الصفحة إلى Firebase → Authentication → Settings → Authorized domains ثم أعد المحاولة.'
        : (err.message || 'تعذر تسجيل الدخول');
    }
  });

  function connectedMsg() {
    return isAdminFlag ? 'متصل — مزامنة تلقائية' : 'متصل — مساهم: مزامنة الأقسام المسموحة';
  }
  function canWrite(key) { return isAdminFlag || mySections.has(key); }

  function withTimeout(p) {
    return Promise.race([p, new Promise(function (_, rej) {
      setTimeout(function () { rej({ code: 'sync-timeout' }); }, SYNC_TIMEOUT_MS);
    })]);
  }

  function startSync() {
    withTimeout(slugRef.once('value')).then(function (snap) {
      const cloud = snap.val();
      const sections = (cloud && cloud.sections) || null;
      const local = readLocal();
      ready = true;
      if (!sections) {
        // قاعدة بيانات فارغة: المدير يبذر نسخته المحلية
        if (isAdminFlag) { pushNow(local.data); applyData(local.data); }
        setStatus(connectedMsg());
      } else {
        lastSec = {};
        for (const k of Object.keys(sections)) lastSec[k] = { str: sections[k] && sections[k].json, ts: Number(sections[k] && sections[k].updated_at) || 0 };
        const cloudAt = Object.values(lastSec).reduce(function (m, x) { return Math.max(m, x.ts); }, 0);
        const localAt = Number(localStorage.getItem(SAVED_AT_KEY)) || 0;
        const merged = mergeSections(sections);
        if (isAdminFlag && local.data && localAt > cloudAt) {
          // النسخة المحلية للمدير أحدث (مثلًا: تعديل بلا اتصال) — ارفعها
          pushNow(local.data);
          applyData(local.data);
        } else if (Object.keys(merged).length) {
          applyData(merged);
        } else if (isAdminFlag) {
          pushNow(local.data);
        }
        setStatus(connectedMsg());
      }
      attachLive();
    }).catch(function (err) {
      // مهلة أو خطأ: شغّل محليًا واعرض سببًا واضحًا، وابقَ مستمعًا فإذا أُنشئت القاعدة لاحقًا يتعافى الاتصال
      ready = true;
      const local = readLocal();
      if (local.data) applyData(local.data);
      attachLive();
      setStatus(err && err.code === 'sync-timeout'
        ? 'تعذر الاتصال بقاعدة البيانات — أنشئ Realtime Database من Console وتأكد أن databaseURL في firebase/config.js مطابق لرابط القاعدة'
        : ('تعذر الاتصال بقاعدة البيانات: ' + (err.code || err.message)), true);
    });
  }

  function attachLive() {
    slugRef.on('value', function (s) {
      const cloud = s.val();
      if (!cloud || !cloud.sections) return;
      const sections = cloud.sections;
      let changed = false;
      for (const k of Object.keys(sections)) {
        const ts = Number(sections[k] && sections[k].updated_at) || 0;
        if (!lastSec[k] || lastSec[k].ts !== ts) changed = true;
      }
      if (!changed) return; // صدى كتابتنا
      for (const k of Object.keys(sections)) lastSec[k] = { str: sections[k] && sections[k].json, ts: Number(sections[k] && sections[k].updated_at) || 0 };
      const merged = mergeSections(sections);
      if (Object.keys(merged).length) {
        applyData(merged);
        setStatus('تم التحديث من السحابة — ' + new Date().toLocaleTimeString('ar-EG'));
      }
    }, function (err) { setStatus('انقطع استقبال التحديثات: ' + (err.code || ''), true); });
  }

  function listenMembers() {
    membersRef.on('value', function (s) {
      const val = s.val() || {};
      const list = Object.keys(val).map(function (k) { return Object.assign({ key: k }, val[k]); });
      if (hooks && hooks.onMembers) hooks.onMembers(list);
    }, function () {});
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return { data: raw ? JSON.parse(raw) : null };
    } catch (e) { return { data: null }; }
  }

  function splitData(d) {
    d = d || {};
    const out = {};
    for (const view of Object.keys(SECTION_DATA_KEYS)) {
      const dk = SECTION_DATA_KEYS[view];
      out[view] = {}; out[view][dk] = d[dk] == null ? [] : d[dk];
    }
    const rest = {};
    for (const k of Object.keys(d)) {
      if (!Object.values(SECTION_DATA_KEYS).includes(k)) rest[k] = d[k];
    }
    out.settings = rest;
    return out;
  }

  function mergeSections(sections) {
    const out = {};
    for (const k of Object.keys(sections)) {
      const sec = sections[k];
      if (!sec || !sec.json) continue;
      try {
        const v = JSON.parse(sec.json);
        if (v && typeof v === 'object') Object.assign(out, v);
      } catch (e) {}
    }
    return out;
  }

  function applyData(data) {
    if (data == null) return;
    lastData = data;
    if (!hooks) return;
    suppressPush = true;
    try { hooks.applyRemote(data); } finally { suppressPush = false; }
  }

  function pushNow(data) {
    if (data == null || !ready) return;
    if (suppressPush) return;
    lastData = data;
    const split = splitData(data);
    const now = Date.now();
    const payload = {};
    let skipped = false;
    for (const key of Object.keys(split)) {
      if (!canWrite(key)) {
        if (isAdminFlag || mySections.size) skipped = true;
        continue;
      }
      const str = JSON.stringify(split[key]);
      if (!lastSec[key] || lastSec[key].str !== str) {
        payload['sections/' + key] = { json: str, updated_at: now };
        lastSec[key] = { str: str, ts: now };
      }
    }
    if (!Object.keys(payload).length) return;
    slugRef.update(payload).then(function () {
      if (!suppressPush) setStatus(skipped ? 'تمت المزامنة — مع تخطي أقسام غير مسموح لك بها' : ('تمت المزامنة — ' + new Date().toLocaleTimeString('ar-EG')), skipped);
    }).catch(function (err) {
      setStatus('فشل الحفظ في Firebase: ' + (err.code === 'PERMISSION_DENIED' ? 'لا تملك صلاحية الكتابة على هذا القسم' : (err.code || err.message)), true);
    });
  }

  window.addEventListener('pagehide', function () {
    if (saveTimer) { clearTimeout(saveTimer); if (ready && lastData) pushNow(lastData); }
  });

  /* ---------- بوابة الدخول ---------- */
  function removeGate() { const g = document.getElementById(GATE_ID); if (g) g.remove(); }

  function showGate(mode, detail) {
    removeGate();
    const g = document.createElement('div');
    g.id = GATE_ID;
    g.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#f4f6f1;font-family:Tahoma,"Segoe UI",sans-serif;direction:rtl';
    let inner = '';
    if (mode === 'loading') {
      inner = card('<div class="glogo">🕌</div><h1>مدير موسوعة البُردة</h1><p class="gmuted">جارٍ التحقق من جلسة الدخول…</p>');
    } else if (mode === 'login') {
      inner = card('<div class="glogo">🕌</div><h1>مدير موسوعة البُردة</h1><p class="gmuted">نظام إدارة موسوعة البُردة<br>الدخول متاح للمدير والأعضاء المضافين فقط</p><button id="gbtn" class="gbtn"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.6 3.8-5.35 3.8a5.8 5.8 0 1 1 0-11.6c1.5 0 2.8.5 3.8 1.5l2.2-2.2A9 9 0 1 0 12 21c5.2 0 8.9-3.6 8.9-8.9 0-.4 0-.7-.1-1z"/></svg>الدخول بحساب Google</button><p id="gerr" class="gerr"></p>');
    } else if (mode === 'unauthorized') {
      inner = card('<div class="glogo">🔒</div><h1>حساب غير مضاف</h1><p class="gmuted">الحساب <b>' + esc(detail || '') + '</b> مسجَّل دخولًا لكنه ليس مدير النظام ولم يُضف كعضو بعد.<br>تواصل مع المدير (<b>' + esc(adminEmail) + '</b>) ليضيف بريدك ويحدد صلاحياتك.</p><button id="gbtn" class="gbtn">تسجيل الخروج والمحاولة بحساب آخر</button>');
    } else if (mode === 'config') {
      inner = card('<div class="glogo">⚙️</div><h1>لم يتم إعداد Firebase بعد</h1><p class="gmuted">افتح <b>firebase/config.js</b> وضع قيم تطبيق الويب من Firebase Console (Project settings → Your apps).<br>لا تنسَ إنشاء Realtime Database وإضافة <b>databaseURL</b>، ونشر قواعد <b>database.rules.json</b>.<br>الشرح الكامل في README.md.</p>');
    }
    g.innerHTML = '<style>#' + GATE_ID + ' .gcard{background:#fff;border:1px solid #e2e6dd;border-radius:16px;padding:36px 40px;max-width:480px;text-align:center;box-shadow:0 10px 40px rgba(35,98,79,.12)}#' + GATE_ID + ' h1{font-size:20px;margin:10px 0 4px;color:#1e3d33}#' + GATE_ID + ' .gmuted{color:#6b7a72;font-size:14px;line-height:1.9;margin:6px 0 0}#' + GATE_ID + ' .glogo{font-size:34px}#' + GATE_ID + ' .gbtn{margin-top:18px;display:inline-flex;align-items:center;gap:10px;background:#23624f;color:#fff;border:0;border-radius:10px;padding:11px 22px;font-size:15px;cursor:pointer;font-family:inherit}#' + GATE_ID + ' .gbtn:hover{background:#1b4d3e}#' + GATE_ID + ' .gerr{color:#9a3030;font-size:13px;margin-top:12px;min-height:1.2em;line-height:1.7}</style>' + inner;
    document.body.appendChild(g);
    const btn = g.querySelector('#gbtn');
    if (btn) btn.onclick = function () {
      if (mode === 'unauthorized') { auth.signOut().then(function () { showGate('login'); }); return; }
      const errEl = g.querySelector('#gerr');
      if (errEl) errEl.textContent = 'جارٍ فتح نافذة الدخول…';
      auth.signInWithPopup(provider).catch(function (err) {
        const code = err && err.code;
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          auth.signInWithRedirect(provider);
          return;
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          if (errEl) errEl.textContent = '';
          return;
        }
        if (errEl) {
          errEl.textContent = code === 'auth/unauthorized-domain'
            ? 'أضف نطاق هذه الصفحة إلى Firebase → Authentication → Settings → Authorized domains ثم أعد المحاولة.'
            : (err.message || 'تعذر تسجيل الدخول');
        }
      });
    };
  }

  function card(html) { return '<div class="gcard">' + html + '</div>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
})();
