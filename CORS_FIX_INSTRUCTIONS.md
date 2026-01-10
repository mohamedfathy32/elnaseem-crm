# تعليمات حل مشكلة CORS

## الخطوات المطلوبة

### 1. تثبيت dependencies في مجلد functions

```bash
cd functions
npm install
```

هذا سيثبت package `cors` المطلوب.

### 2. نشر Cloud Functions مرة أخرى

```bash
firebase deploy --only functions
```

**مهم جداً:** يجب أن تنشر الـ functions مرة أخرى بعد إضافة package `cors`.

### 3. التحقق من النشر

```bash
firebase functions:list
```

يجب أن ترى:
- `createEmployee` (onCall)
- `createEmployeeHttp` (HTTP endpoint)

### 4. اختبار الـ Functions

الكود الآن يستخدم نظام fallback:
1. يحاول استخدام `onCall` أولاً
2. إذا فشل (مشكلة CORS)، يستخدم `createEmployeeHttp` تلقائياً

## ملاحظات

- **onCall functions** لا تحتاج CORS headers لأن Firebase يديرها تلقائياً
- **HTTP endpoint** يحتاج CORS headers، لذلك أضفنا `createEmployeeHttp`
- الكود الآن يعمل مع كلا الحلين

## إذا استمرت المشكلة

1. تأكد من أن الـ functions تم نشرها بنجاح:
   ```bash
   firebase functions:log
   ```

2. تحقق من أن region صحيح في `firebase.js`:
   ```javascript
   export const functions = getFunctions(app, 'us-central1');
   ```

3. تأكد من أن الـ functions تم تفعيلها في Firebase Console

4. انتظر دقائق بعد النشر - الـ functions تحتاج وقت للتفعيل
