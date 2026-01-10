# Elnaseem CRM

نظام إدارة علاقات العملاء (CRM) بسيط لحجوزات وطلبات السفر، مبني على React و Firebase.

## المميزات

- **ثلاثة أدوار مستخدمين:**
  - **Manager (المدير):** إدارة الموظفين، عرض الإحصائيات، وتوزيع العملاء
  - **Data Entry:** إضافة العملاء الجدد وإدخال بياناتهم
  - **Sales:** متابعة العملاء المخصصين وتحديث حالتهم

- **لوحة تحكم المدير:**
  - عرض الإحصائيات الشاملة (إجمالي العملاء، تم البيع، مؤجل، رفض، إلخ)
  - جدول إحصائيات الموظفين التفصيلي
  - إضافة موظفين جدد
  - عرض وتوزيع العملاء غير المسندين

- **نموذج إضافة العميل:**
  - جميع البيانات المطلوبة (المصدر، الاسم، رقم الواتساب، تاريخ السفر، إلخ)
  - رفع صورة الباسبور (صورة أو PDF)

## التقنيات المستخدمة

- React 19
- React Router DOM
- Firebase (Authentication, Firestore, Storage)
- Tailwind CSS
- Vite

## الإعداد والتشغيل

### 1. تثبيت المتطلبات

```bash
npm install
```

### 2. إعداد Cloud Functions (مطلوب)

⚠️ **مهم:** Cloud Functions مطلوبة لكي يتمكن المدير من إضافة موظفين بدون تسجيل خروج تلقائي.

1. تثبيت Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. تسجيل الدخول:
   ```bash
   firebase login
   ```

3. تثبيت dependencies للـ Functions:
   ```bash
   cd functions
   npm install
   cd ..
   ```

4. نشر Functions:
   ```bash
   firebase deploy --only functions
   ```

للمزيد من التفاصيل، راجع ملف `SETUP.md`.

### 2. إعداد Firebase

المشروع مُعد بالفعل مع Firebase، ولكن يجب إعداد:

1. **Firestore Security Rules:**
   - اذهب إلى Firebase Console > Firestore Database > Rules
   - استخدم القواعد من ملف `firestore.rules.example`
   - قم بتعديلها حسب احتياجاتك

2. **Authentication:**
   - اذهب إلى Firebase Console > Authentication
   - فعّل Authentication باستخدام Email/Password

3. **Storage:**
   - اذهب إلى Firebase Console > Storage
   - فعّل Storage وحدد قواعد الأمان المناسبة

### 3. إنشاء حساب المدير الأول

بعد إعداد Firebase، يمكنك إنشاء حساب مدير أول من خلال:

1. استخدام Firebase Console > Authentication لإضافة مستخدم
2. ثم إضافة بيانات المستخدم في Firestore Collection `users`:
   ```javascript
   {
     email: "manager@example.com",
     role: "manager",
     name: "المدير",
     createdAt: "2024-01-01T00:00:00.000Z"
   }
   ```

### 4. تشغيل المشروع

```bash
npm run dev
```

المشروع سيعمل على `http://localhost:5173`

## بنية المشروع

```
src/
├── components/          # المكونات المشتركة
│   └── ProtectedRoute.jsx
├── contexts/           # Contexts
│   └── AuthContext.jsx
├── pages/
│   ├── Login.jsx
│   ├── Unauthorized.jsx
│   ├── manager/        # صفحات المدير
│   │   ├── ManagerDashboard.jsx
│   │   ├── AddEmployee.jsx
│   │   └── UnassignedClients.jsx
│   ├── dataentry/      # صفحات Data Entry
│   │   ├── DataEntryDashboard.jsx
│   │   └── AddClient.jsx
│   └── sales/          # صفحات Sales
│       └── SalesDashboard.jsx
├── firebase/
│   └── firebase.js     # إعدادات Firebase
└── utils/
    └── routes.jsx      # Routes configuration
```

## الأمان

⚠️ **مهم جداً:** تأكد من تطبيق Firestore Security Rules المناسبة من ملف `firestore.rules.example` في Firebase Console لضمان أمان البيانات.

## البناء للإنتاج

```bash
npm run build
```

الملفات المُبنية ستكون في مجلد `dist/`
