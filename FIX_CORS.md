# حل مشكلة CORS في Cloud Functions

## المشكلة
```
Access to fetch at 'https://us-central1-elnaseem-crm.cloudfunctions.net/createEmployee' 
from origin 'https://elnaseem-crm.vercel.app' has been blocked by CORS policy
```

## الحلول

### الحل 1: إعادة نشر Cloud Function (الأسهل)

1. **تأكد من تثبيت dependencies في مجلد functions:**
   ```bash
   cd functions
   npm install
   ```

2. **نشر Cloud Function مرة أخرى:**
   ```bash
   firebase deploy --only functions
   ```

3. **تحقق من أن الـ function تم نشرها بنجاح:**
   ```bash
   firebase functions:log
   ```

### الحل 2: استخدام HTTP Endpoint بدلاً من onCall

إذا استمرت المشكلة، يمكن استخدام HTTP endpoint بدلاً من `onCall`. الكود موجود بالفعل في `functions/index.js` كـ `createEmployeeHttp`.

**خطوات التطبيق:**

1. في `src/pages/manager/AddEmployee.jsx`، استبدل:
   ```javascript
   const createEmployee = httpsCallable(functions, 'createEmployee');
   const result = await createEmployee({...});
   ```
   
   بـ:
   ```javascript
   const auth = getAuth();
   const token = await auth.currentUser.getIdToken();
   const response = await fetch('https://us-central1-elnaseem-crm.cloudfunctions.net/createEmployeeHttp', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`
     },
     body: JSON.stringify({
       email: formData.email,
       password: formData.password,
       name: formData.name,
       role: formData.role
     })
   });
   const result = await response.json();
   ```

### الحل 3: إضافة CORS في Firebase Console

1. اذهب إلى Firebase Console
2. Functions > Settings
3. تأكد من أن "Allow unauthenticated invocations" معطل (يجب أن تكون الـ function محمية)
4. في CORS settings، أضف origin الخاص بك: `https://elnaseem-crm.vercel.app`

### الحل 4: استخدام Region محدد

في `src/firebase/firebase.js`:
```javascript
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

export const functions = getFunctions(app, 'us-central1');
```

## الأسباب المحتملة

1. **الـ function لم يتم نشرها بشكل صحيح**
2. **مشكلة في authentication token**
3. **Region غير صحيح**
4. **الـ function تحتاج وقت للتفعيل بعد النشر**

## التحقق من الحل

بعد تطبيق أي حل، تحقق من:
1. فتح Console في المتصفح - لا يجب أن تظهر أخطاء CORS
2. محاولة إضافة موظف جديد
3. التحقق من logs: `firebase functions:log`
