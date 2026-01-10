# دليل الإعداد الأولي

## خطوات إعداد المشروع

### 1. إعداد Firebase Authentication

1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. اختر مشروعك
3. اذهب إلى **Authentication** > **Sign-in method**
4. فعّل **Email/Password** sign-in provider

### 2. إعداد Firestore Database

1. اذهب إلى **Firestore Database**
2. أنشئ قاعدة البيانات في وضع **Production mode** (يمكن تغيير القواعد لاحقاً)
3. اذهب إلى **Rules** واستبدل القواعد بالقواعد من ملف `firestore.rules.example`

### 3. إعداد Firebase Storage

1. اذهب إلى **Storage**
2. اضغط **Get started**
3. اختر **Start in production mode**
4. حدد موقع Storage (يفضل نفس موقع Firestore)
5. في **Rules**، استخدم قواعد مشابهة:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /passports/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'dataentry';
    }
  }
}
```

### 4. إنشاء حساب المدير الأول

#### الطريقة الأولى: من Firebase Console

1. اذهب إلى **Authentication** > **Users**
2. اضغط **Add user**
3. أدخل البريد الإلكتروني وكلمة المرور
4. سجل **User UID** الذي سيظهر
5. اذهب إلى **Firestore Database** > **Data**
6. أنشئ collection جديدة باسم `users`
7. أضف document جديد بالـ ID الذي سجلته
8. أضف الحقول التالية:
   ```
   email: "manager@example.com" (البريد الذي أدخلته)
   role: "manager"
   name: "المدير"
   createdAt: "2024-01-01T00:00:00.000Z"
   ```

#### الطريقة الثانية: من الكود (تطوير مؤقت)

يمكنك مؤقتاً تعديل `src/pages/Login.jsx` لإضافة زر إنشاء حساب مدير للتطوير فقط (يجب حذفه لاحقاً).

### 5. إنشاء Indexes في Firestore (اختياري)

إذا أردت استخدام `orderBy` مع `where` في الاستعلامات، ستحتاج لإنشاء composite indexes:

1. عند تشغيل المشروع، Firebase سيظهر رسالة في Console مع رابط لإنشاء الـ index
2. أو اذهب إلى **Firestore Database** > **Indexes** وأنشئ الـ indexes التالية:
   - Collection: `clients`
   - Fields: `assignedTo` (Ascending), `createdAt` (Descending)
   - Query scope: Collection

**ملاحظة:** الكود الحالي لا يحتاج هذه الـ indexes لأنه يقوم بالترتيب على الـ client side.

### 5. إعداد Cloud Functions (مطلوب لإضافة الموظفين)

⚠️ **مهم:** Cloud Functions مطلوبة لكي يتمكن المدير من إضافة موظفين بدون تسجيل خروج تلقائي.

1. **تثبيت Firebase CLI (إذا لم يكن مثبتاً):**
   ```bash
   npm install -g firebase-tools
   ```

2. **تسجيل الدخول إلى Firebase:**
   ```bash
   firebase login
   ```

3. **تهيئة Functions في المشروع:**
   ```bash
   cd functions
   npm install
   cd ..
   ```

4. **تهيئة Firebase في المشروع الرئيسي (إذا لم يكن مُعداً):**
   ```bash
   firebase init functions
   ```
   - اختر استخدام TypeScript أو JavaScript (استخدمنا JavaScript)
   - اختر ESLint إذا أردت

5. **نشر Cloud Functions:**
   ```bash
   firebase deploy --only functions
   ```

   أو للاختبار محلياً:
   ```bash
   firebase emulators:start
   ```

**ملاحظة:** إذا كنت تفضل عدم استخدام Cloud Functions، يمكنك تعديل `src/pages/manager/AddEmployee.jsx` لاستخدام `createUserWithEmailAndPassword` مباشرة، لكن هذا سيتطلب من المدير إعادة تسجيل الدخول بعد إضافة كل موظف.

### 6. تشغيل المشروع

```bash
npm install
npm run dev
```

### 7. تسجيل الدخول

1. افتح `http://localhost:5173`
2. سجل الدخول باستخدام حساب المدير الذي أنشأته
3. ستظهر لك لوحة تحكم المدير

## اختبار النظام

1. **كمدير:** أنشئ موظفين جدد (Data Entry و Sales)
2. **كـ Data Entry:** أضف عملاء جدد
3. **كمدير:** وزع العملاء غير المسندين على الموظفين
4. **كـ Sales:** حدث حالة العملاء المخصصين لك

## ملاحظات الأمان

⚠️ **مهم جداً:**

1. تأكد من تطبيق Firestore Security Rules المناسبة
2. تأكد من تطبيق Storage Security Rules المناسبة
3. لا تترك أي معلومات حساسة في الكود
4. استخدم Environment Variables للمعلومات الحساسة في الإنتاج
5. فعّل Firebase App Check للإنتاج لمنع الإساءة
