# مدير موسوعة البُردة — Modular

- افتح `index.html` للتشغيل المحلي.
- `index.html` مجرد Aggregator ويعرض `app.html`.
- `app.html` يحتوي واجهة المدير.
- `assets/css/manager.css` يحتوي تنسيق المدير.
- `assets/js/manager.js` يحتوي منطق المدير.
- `supabase/config.js` يحتوي إعدادات Supabase العامة للنشر.
- مجلد `pages/` يحتوي مداخل مستقلة للأقسام، مثل `pages/sources.html` و`pages/verses.html`، وتفتح القسم المطلوب داخل التطبيق.

المشروع موقع ثابت بالكامل (HTML/CSS/JS) بدون خطوة بناء (build)، وكل المسارات نسبية، لذلك يعمل مباشرة على أي استضافة Static — GitHub Pages أو Firebase Hosting أو Cloudflare Pages.

## GitHub Pages

تم تجهيز workflow جاهز: `.github/workflows/pages.yml` يعمل عند كل تحديث إلى `main` وينشر الموقع تلقائيًا.

1. ارفع الكود إلى GitHub (المستودع: `NaqshJudiyya/Burdah-Manager`).
2. من إعدادات المستودع: **Settings → Pages → Source → GitHub Actions** (مرة واحدة فقط).
3. بعد أول push سينشر الـ workflow الموقع على:
   `https://naqshjudiyya.github.io/Burdah-Manager/`

ملاحظات:
- ملف `.nojekyll` موجود في الجذر لضمان عدم مرور الملفات على معالج Jekyll.
- كل المسارات في الكود نسبية، لذا يعمل الموقع صحيحًا تحت مسار المستودع الفرعي `/Burdah-Manager/`.

## Firebase Hosting

تم تجهيز `firebase.json` و`.firebaserc` مع ترويسات تخزين مؤقت مناسبة (خطوط لأسبوع كامل مع immutable، وCSS/JS لساعة، وHTML بدون تخزين مؤقت حتى يظهر كل تحديث فورًا) وتفعيل `cleanUrls`.

### النشر اليدوي

1. أنشئ مشروعًا على [Firebase Console](https://console.firebase.google.com) وفعّل Hosting.
2. عدّل `.firebaserc` وضع مكان `YOUR_FIREBASE_PROJECT_ID` معرّف مشروعك.
3. ثم:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

### النشر التلقائي عبر GitHub Actions

Workflow جاهز في `.github/workflows/firebase-hosting.yml` يعمل عند كل تحديث إلى `main`:

1. في Firebase Console: إعدادات المشروع → حسابات الخدمة → أنشئ حساب خدمة جديد له الدور **Firebase Hosting Admin** ونزّل مفتاح JSON.
2. في GitHub: **Settings → Secrets and variables → Actions** وأضف سرًا باسم `FIREBASE_SERVICE_ACCOUNT` والصق فيه محتوى ملف JSON كاملًا.
3. بعد أول push سينشر الـ workflow تلقائيًا على قناة `live`.

ملاحظة: إذا كنت لا تريد النشر على المنصتين معًا، احذف الـ workflow الذي لا تحتاجه من `.github/workflows/`.

## الشرح الأصلي

للنشر على Cloudflare Pages استخدم مجلد المشروع كاملًا، واجعل `index.html` هو نقطة الدخول. لا تحذف مجلد `supabase` أو `assets`.

يظل `manager.html` موجودًا للتوافق مع النسخة القديمة. البيانات تظل في LocalStorage مع إمكانية الحفظ والتحميل من Supabase، والتصدير الثابت يعمل من قسم التصدير داخل المدير.
