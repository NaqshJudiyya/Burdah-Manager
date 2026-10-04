# مدير موسوعة البُردة — Modular

- افتح `index.html` للتشغيل المحلي.
- `index.html` مجرد Aggregator ويعرض `app.html`.
- `app.html` يحتوي واجهة المدير.
- `assets/css/manager.css` يحتوي تنسيق المدير.
- `assets/js/manager.js` يحتوي منطق المدير.
- `supabase/config.js` يحتوي إعدادات Supabase العامة للنشر.
- مجلد `pages/` يحتوي مداخل مستقلة للأقسام، مثل `pages/sources.html` و`pages/verses.html`، وتفتح القسم المطلوب داخل التطبيق.

للنشر على Cloudflare Pages استخدم مجلد `modular` كاملًا، واجعل `index.html` هو نقطة الدخول. لا تحذف مجلد `supabase` أو `assets`.

يظل `manager.html` موجودًا للتوافق مع النسخة القديمة. البيانات تظل في LocalStorage مع إمكانية الحفظ والتحميل من Supabase، والتصدير الثابت يعمل من قسم التصدير داخل المدير.
