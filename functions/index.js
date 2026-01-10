// Cloud Functions for Firebase
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Function to create employee (called by manager)
exports.createEmployee = functions.https.onCall(async (data, context) => {
  // Verify that the caller is authenticated and is a manager
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً');
  }

  const managerId = context.auth.uid;
  const managerDoc = await admin.firestore().collection('users').doc(managerId).get();
  
  if (!managerDoc.exists || managerDoc.data().role !== 'manager') {
    throw new functions.https.HttpsError('permission-denied', 'ليس لديك صلاحية لإضافة موظفين');
  }

  const { email, password, name, role } = data;

  // Validate input
  if (!email || !password || !name || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'جميع الحقول مطلوبة');
  }

  if (role !== 'dataentry' && role !== 'sales') {
    throw new functions.https.HttpsError('invalid-argument', 'الدور غير صحيح');
  }

  try {
    // Create user in Firebase Auth using Admin SDK (doesn't sign in automatically)
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name
    });

    // Save user data in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: email,
      role: role,
      name: name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: managerId
    });

    return {
      success: true,
      userId: userRecord.uid,
      message: 'تم إضافة الموظف بنجاح'
    };
  } catch (error) {
    console.error('Error creating employee:', error);
    
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'البريد الإلكتروني مستخدم بالفعل');
    }
    
    throw new functions.https.HttpsError('internal', 'فشل إضافة الموظف');
  }
});
