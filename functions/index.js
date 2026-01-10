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

// Alternative HTTP endpoint with CORS (if onCall doesn't work)
const cors = require('cors')({ origin: true });

exports.createEmployeeHttp = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Get auth token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const managerId = decodedToken.uid;

      // Verify manager role
      const managerDoc = await admin.firestore().collection('users').doc(managerId).get();
      if (!managerDoc.exists || managerDoc.data().role !== 'manager') {
        return res.status(403).json({ error: 'ليس لديك صلاحية لإضافة موظفين' });
      }

      const { email, password, name, role } = req.body;

      // Validate input
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
      }

      if (role !== 'dataentry' && role !== 'sales') {
        return res.status(400).json({ error: 'الدور غير صحيح' });
      }

      // Create user
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

      return res.status(200).json({
        success: true,
        userId: userRecord.uid,
        message: 'تم إضافة الموظف بنجاح'
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      
      if (error.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
      }
      
      return res.status(500).json({ error: 'فشل إضافة الموظف' });
    }
  });
});
