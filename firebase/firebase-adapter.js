// محوّل Firebase: بوابة دخول بحساب Google للمدير فقط + مزامنة تلقائية مستمرة مع Realtime Database.
// يتطلب تحميل سكربتات firebase-*-compat.js من gstatic ثم firebase/config.js قبل هذا الملف.
(function () {
  const cfg = window.BURDA_FIREBASE_CONFIG;
  const adminEmail = ((cfg && cfg.adminEmail) || 'naqshjudiyya@gmail.com').trim().toLowerCase();
  const slug = (cfg && cfg.projectSlug) || 'default';
  const DATA_KEY = 'BURDA_MANAGER_DATA';
  const SAVED_AT_KEY = 'BURDA_MANAGER_SAVED_AT';
  const GATE_ID = 'burda-auth-gate';

  function setStatus(text, isError) {
    const el = document.getElementById('onlineStatus');
    if (el) { el.textContent = text; el.style.color = isError ? '#9a3030' : '#23624f'; }
  }

  // وضع آمن افتراضيًا حتى يكتمل الإعداد
  window.burdaFirebase = { push: function () {}, syncNow: function () {}, signOut: function () {}, init: function () {} };

  const notConfigured = !cfg || !cfg.apiKey || /^YOUR_/.test(cfg.apiKey) || /^YOUR_/.test(cfg.projectId || '') || !cfg.databaseURL;
  if (notConfigured) { showGate('config'); return; }

  try { firebase.initializeApp(cfg); } catch (e) { showGate('config'); return; }

  const auth = firebase.auth();
  const dataRef = firebase.database().ref('burdah/' + slug);
  const provider = new firebase.auth.GoogleAuthProvider();

  let hooks = null;        // { applyRemote(data) } تُمرَّر من manager.js
  let ready = false;       // اكتملت المصادقة وقرار المزامنة الأول
  let suppressPush = false; // أثناء تطبيق بيانات قادمة من السحابة لا نعيد دفعها
  let lastSyncedAt = 0;    // آخر updated_at دفعناه أو طبقناه (لتجاهل صدى الكتابة)
  let saveTimer = null;
  let lastData = null;

  window.burdaFirebase.init = function (h) { hooks = h; };
  window.burdaFirebase.push = function (data) {
    lastData = data;
    if (suppressPush || !ready) return;
    try { localStorage.setItem(SAVED_AT_KEY, String(Date.now())); } catch (e) {}
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { pushNow(lastData); }, 1200);
  };
  window.burdaFirebase.syncNow = function () {
    if (!ready || !lastData) return;
    clearTimeout(saveTimer);
    pushNow(lastData);
  };
  window.burdaFirebase.signOut = function () { auth.signOut(); };

  showGate('loading');

  // الجلسة محفوظة محليًا (LOCAL persistence) — لا حاجة لتسجيل الدخول في كل مرة.
  auth.onAuthStateChanged(function (user) {
    if (!user) { showGate('login'); return; }
    if ((user.email || '').toLowerCase() !== adminEmail) {
      setStatus('حساب غير مصرّح', true);
      showGate('denied', user.email);
      auth.signOut();
      return;
    }
    removeGate();
    setStatus('جارٍ المزامنة…');
    startSync();
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

  function startSync() {
    dataRef.once('value').then(function (snap) {
      const cloud = snap.val();
      const local = readLocal();
      ready = true;
      if (!cloud || !cloud.json) {
        // أول تشغيل: ارفع النسخة المحلية كبذرة للسحابة
        pushNow(local.data);
        applyData(local.data);
        setStatus('متصل — مزامنة تلقائية');
      } else {
        const cloudAt = Number(cloud.updated_at) || 0;
        const localAt = Number(localStorage.getItem(SAVED_AT_KEY)) || 0;
        let cloudData = null;
        try { cloudData = JSON.parse(cloud.json); } catch (e) {}
        if (local.data && localAt > cloudAt) {
          // النسخة المحلية أحدث (مثلًا: تعديل بلا اتصال) — ارفعها
          pushNow(local.data);
          applyData(local.data);
        } else if (cloudData) {
          applyData(cloudData, cloudAt);
        } else {
          pushNow(local.data);
        }
        setStatus('متصل — مزامنة تلقائية');
      }
      // مزامنة حية: أي تغيير من أي جهاز يصل فورًا
      dataRef.on('value', function (s) {
        const v = s.val();
        if (!v || !v.json) return;
        const at = Number(v.updated_at) || 0;
        if (at === lastSyncedAt) return; // صدى كتابتنا
        try {
          applyData(JSON.parse(v.json), at);
          setStatus('تم التحديث من السحابة — ' + new Date().toLocaleTimeString('ar-EG'));
        } catch (e) { setStatus('بيانات السحابة غير صالحة', true); }
      }, function (err) {
        setStatus('تعذر تلقي التحديثات: ' + (err.code || ''), true);
      });
    }).catch(function (err) {
      ready = true;
      const local = readLocal();
      if (local.data) applyData(local.data);
      setStatus('تعذر الاتصال بقاعدة البيانات: ' + (err.code || err.message) + ' — تحقق من databaseURL وقواعد الأمان', true);
    });
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return { data: raw ? JSON.parse(raw) : null };
    } catch (e) { return { data: null }; }
  }

  function applyData(data, at) {
    if (data == null) return;
    if (at != null) lastSyncedAt = at;
    lastData = data;
    if (!hooks) return;
    suppressPush = true;
    try { hooks.applyRemote(data); } finally { suppressPush = false; }
  }

  function pushNow(data, force) {
    if (data == null) return;
    if (suppressPush && !force) return;
    lastData = data;
    lastSyncedAt = Date.now();
    dataRef.set({ v: 1, json: JSON.stringify(data), updated_at: lastSyncedAt }).then(function () {
      if (!suppressPush) setStatus('تمت المزامنة — ' + new Date().toLocaleTimeString('ar-EG'));
    }).catch(function (err) {
      setStatus('فشل الحفظ في Firebase: ' + (err.code || err.message), true);
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
      inner = card('<div class="glogo">🕌</div><h1>مدير موسوعة البُردة</h1><p class="gmuted">نظام إدارة موسوعة البُردة<br>الدخول متاح لحساب المدير فقط: <b>' + esc(adminEmail) + '</b></p><button id="gbtn" class="gbtn"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.6 3.8-5.35 3.8a5.8 5.8 0 1 1 0-11.6c1.5 0 2.8.5 3.8 1.5l2.2-2.2A9 9 0 1 0 12 21c5.2 0 8.9-3.6 8.9-8.9 0-.4 0-.7-.1-1z"/></svg>الدخول بحساب Google</button><p id="gerr" class="gerr"></p>');
    } else if (mode === 'denied') {
      inner = card('<div class="glogo">⚠️</div><h1>غير مصرّح</h1><p class="gmuted">الحساب <b>' + esc(detail || '') + '</b> ليس مدير النظام.<br>الدخول متاح فقط لـ: <b>' + esc(adminEmail) + '</b></p><button id="gbtn" class="gbtn">تسجيل الخروج والمحاولة بحساب آخر</button>');
    } else if (mode === 'config') {
      inner = card('<div class="glogo">⚙️</div><h1>لم يتم إعداد Firebase بعد</h1><p class="gmuted">افتح <b>firebase/config.js</b> وضع قيم تطبيق الويب من Firebase Console (Project settings → Your apps).<br>لا تنسَ إنشاء Realtime Database وإضافة <b>databaseURL</b>، ونشر قواعد <b>database.rules.json</b>.<br>الشرح الكامل في README.md.</p>');
    }
    g.innerHTML = '<style>#' + GATE_ID + ' .gcard{background:#fff;border:1px solid #e2e6dd;border-radius:16px;padding:36px 40px;max-width:480px;text-align:center;box-shadow:0 10px 40px rgba(35,98,79,.12)}#' + GATE_ID + ' h1{font-size:20px;margin:10px 0 4px;color:#1e3d33}#' + GATE_ID + ' .gmuted{color:#6b7a72;font-size:14px;line-height:1.9;margin:6px 0 0}#' + GATE_ID + ' .glogo{font-size:34px}#' + GATE_ID + ' .gbtn{margin-top:18px;display:inline-flex;align-items:center;gap:10px;background:#23624f;color:#fff;border:0;border-radius:10px;padding:11px 22px;font-size:15px;cursor:pointer;font-family:inherit}#' + GATE_ID + ' .gbtn:hover{background:#1b4d3e}#' + GATE_ID + ' .gerr{color:#9a3030;font-size:13px;margin-top:12px;min-height:1.2em;line-height:1.7}</style>' + inner;
    document.body.appendChild(g);
    const btn = g.querySelector('#gbtn');
    if (btn) btn.onclick = function () {
      if (mode === 'denied') { auth.signOut().then(function () { showGate('login'); }); return; }
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
