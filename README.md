# مدير موسوعة البُردة — Modular

- افتح `index.html` للتشغيل المحلي.
- `index.html` مجرد Aggregator ويعرض `app.html`.
- `app.html` يحتوي واجهة المدير.
- `assets/css/manager.css` يحتوي تنسيق المدير.
- `assets/js/manager.js` يحتوي منطق المدير.
- `firebase/config.js` يحتوي إعدادات Firebase العامة (مفتاح الويب عام بطبيعته — الحماية عبر قواعد `database.rules.json`).
- مجلد `pages/` يحتوي مداخل مستقلة للأقسام، مثل `pages/sources.html` و`pages/verses.html`، وتفتح القسم المطلوب داخل التطبيق.

## نظام الدخول والأعضاء والمزامنة (Firebase)

- عند فتح النظام تظهر أولًا شاشة **«الدخول بحساب Google»**. الدخول متاح لـ:
  - **المدير**: `NaqshJudiyya@gmail.com` — يرى كل شيء ويدير الأعضاء.
  - **الأعضاء**: من يضيفهم المدير من شاشة «الأعضاء» ببريد حساب Google، مع تحديد الأقسام المسموح لكل عضو بتعديلها (بيانات القصيدة، الفصول، الأبيات، الشروح، المصادر، المعجم، المؤلفون، الإعدادات). العضو يرى لوحة التحكم والمعاينة والتصدير دائمًا، ولا يرى إلا الأقسام المسموحة له.
  - أي حساب آخر يظهر له تنبيه «حساب غير مضاف».
- الصلاحيات محمية على مستويين: إخفاء الأقسام في الواجهة، وقواعد أمان قاعدة البيانات تمنع الكتابة على أي قسم غير مسموح به على الخادم حتى لو تم تجاوز الواجهة.
- الجلسة محفوظة في المتصفح — لا حاجة لتسجيل الدخول مجددًا في كل مرة.
- البيانات تُخزَّن **بالأقسام** في `burdah/{slug}/sections/{key}` وكل حفظ يُكتب محليًا (LocalStorage) **ويتزامن تلقائيًا** (مؤجَّل ثانية تقريبًا) — كل قسم يُرفع فقط لمن يملك صلاحيته — وأي تعديل من جهاز آخر يصل فورًا عبر المزامنة الحية.
- عند التعارض: السحابة هي المرجع، إلا إذا كانت النسخة المحلية **للمدير** أحدث (مثلًا تعديل بلا اتصال) فتُرفع هي.
- إذا بقي المؤشر على «جارٍ المزامنة…» ثم ظهرت رسالة مهلة الاتصال، فالسبب غالبًا أن Realtime Database لم تُنشأ بعد أو أن `databaseURL` في `firebase/config.js` لا يطابق رابط القاعدة في Console.
- أُزيل ارتباط Supabase نهائيًا (مجلد `supabase/` وواجهته في الشريط العلوي).

لماذا Realtime Database وليس Firestore؟ بيانات الموسوعة تتجاوز 1 ميجابايت وحد المستند الواحد في Firestore هو 1MiB، بينما يسمح Realtime Database حتى 16MB لكل عملية كتابة مع نفس المزامنة الحية.

## خطوات الربط بـ Firebase (مرة واحدة)

1. **إنشاء المشروع**: [console.firebase.google.com](https://console.firebase.google.com) → Add project → اسم مثل `burdah-manager` → (Google Analytics اختياري).
2. **تسجيل تطبيق ويب**: من صفحة المشروع اختر أيقونة `</>` (Web) → اسم مستعار → Register → سيظهر كائن `firebaseConfig`. انسخ القيم.
3. **لصق الإعدادات**: افتح `firebase/config.js` وضع مكان كل `YOUR_...` القيمة المقابلة.
4. **إنشاء قاعدة البيانات**: Build → **Realtime Database** → Create Database → اختر موقعًا قريبًا (مثل `europe-west1`) → **Start in locked mode**. بعدها أعد نسخ إعدادات الويب من Project settings — سيظهر الآن سطر `databaseURL` — وضعه في `firebase/config.js` أيضًا.
5. **تفعيل دخول Google**: Build → **Authentication** → Get started → Sign-in method → **Google** → Enable → اختر بريد الدعم → Save.
6. **النطاقات المصرّح بها**: Authentication → Settings → **Authorized domains** → Add domain → `naqshjudiyya.github.io` (للعمل من GitHub Pages). نطاق `*.web.app` و`localhost` مضافان تلقائيًا. هذه الخطوة ضرورية وإلا فشل الدخول بخطأ `unauthorized-domain`.
7. **نشر قواعد الأمان**: القواعد في `database.rules.json` تسمح للمدير بكل شيء، وللأعضاء المضافين بالقراءة وبالكتابة على أقسامهم فقط. بعد ضبط معرّف مشروعك في `.firebaserc`:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only database
   ```
   أو الصق محتوى `database.rules.json` يدويًا في Console → Realtime Database → Rules → Publish.
8. **إضافة الأعضاء**: بعد الدخول كمدير افتح شاشة «الأعضاء» → «+ إضافة عضو» → أدخل بريد حساب Google للعضو واختر الأقسام المسموحة له. لن يُقبل دخول العضو قبل إضافة بريده.
9. **أول تشغيل**: افتح الموقع → «الدخول بحساب Google» → اختر `NaqshJudiyya@gmail.com` → تُرفع النسخة الموجودة في متصفحك تلقائيًا إلى قاعدة البيانات، ومن هنا يسير كل شيء تلقائيًا.
10. **نشر الموقع نفسه**: push إلى GitHub (ينشر تلقائيًا على GitHub Pages وFirebase Hosting — انظر أدناه)، أو يدويًا: `firebase deploy --only hosting`.

## GitHub Pages

Workflow جاهز: `.github/workflows/pages.yml` يعمل عند كل تحديث إلى `main`.

1. ارفع الكود إلى GitHub (المستودع: `NaqshJudiyya/Burdah-Manager`).
2. من إعدادات المستودع: **Settings → Pages → Source → GitHub Actions** (مرة واحدة فقط).
3. الرابط: `https://naqshjudiyya.github.io/Burdah-Manager/`

ملاحظات:
- ملف `.nojekyll` في الجذر يمنع معالجة Jekyll للملفات.
- كل المسارات نسبية، لذا يعمل الموقع صحيحًا تحت المسار الفرعي `/Burdah-Manager/`.

## Firebase Hosting

`firebase.json` جاهز مع `cleanUrls` وترويسات تخزين مؤقت (الخطوط سنة مع immutable، وCSS/JS ساعة، وHTML بدون تخزين مؤقت) وقواعد Realtime Database.

- **يدويًا**: `firebase deploy` (ينشر Hosting والقواعد معًا).
- **تلقائيًا**: Workflow جاهز في `.github/workflows/firebase-hosting.yml` — أضف سرًا باسم `FIREBASE_SERVICE_ACCOUNT` في GitHub (Settings → Secrets and variables → Actions) يحتوي مفتاح JSON لحساب خدمة له الدور **Firebase Hosting Admin**، وسيُنشر عند كل push إلى `main`.

ملاحظة: إذا كنت لا تريد النشر على المنصتين معًا، احذف الـ workflow الذي لا تحتاجه من `.github/workflows/`.

## للنشر على Cloudflare Pages

استخدم مجلد المشروع كاملًا، واجعل `index.html` هو نقطة الدخول. لا تحذف مجلد `firebase` أو `assets`. يظل `manager.html` موجودًا للتوافق مع النسخة القديمة، والتصدير الثابت يعمل من قسم التصدير داخل المدير.
