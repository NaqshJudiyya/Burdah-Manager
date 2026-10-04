// قيم تطبيق الويب من Firebase Console (وضعها المستخدم 2026-10-05).
// هذه القيم عامة بطبيعتها ولا تُعد سرًّا؛ الحماية الحقيقية تتم عبر قواعد قاعدة البيانات في database.rules.json.
// ⚠️ databaseURL: أنشئ Realtime Database من Console (Build → Realtime Database → Create Database)
//    ثم تأكد أن الرابط أدناه يطابق الرابط الظاهر أعلى صفحة قاعدة البيانات:
//    - إذا اخترت United States (الافتراضي): https://burdah-manager-default-rtdb.firebaseio.com  ← الرابط الحالي
//    - إذا اخترت منطقة أخرى مثل europe-west1: https://burdah-manager-default-rtdb.europe-west1.firebasedatabase.app
window.BURDA_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA2aGpLMCO6kiDLQf7VTEdsGVzfYMsovZ4',
  authDomain: 'burdah-manager.firebaseapp.com',
  databaseURL: 'https://burdah-manager-default-rtdb.firebaseio.com',
  projectId: 'burdah-manager',
  storageBucket: 'burdah-manager.firebasestorage.app',
  messagingSenderId: '494727547488',
  appId: '1:494727547488:web:7c000cdf4d26973944d105',
  // البريد الوحيد المسموح له بالدخول كمدير للنظام
  adminEmail: 'NaqshJudiyya@gmail.com',
  projectSlug: 'default'
};
