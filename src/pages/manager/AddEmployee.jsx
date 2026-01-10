import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function AddEmployee() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'dataentry',
    managerPassword: '' // كلمة مرور المدير لإعادة تسجيل الدخول
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!currentUser) {
        throw new Error('يجب تسجيل الدخول أولاً');
      }

      // التحقق من أن المستخدم الحالي مدير
      const managerDoc = await doc(db, 'users', currentUser.uid);
      const managerData = await getDoc(managerDoc);
      
      if (!managerData.exists() || managerData.data().role !== 'manager') {
        throw new Error('ليس لديك صلاحية لإضافة موظفين');
      }

      // حفظ بيانات المدير قبل إنشاء الموظف
      const managerEmail = currentUser.email;
      const managerId = currentUser.uid;
      const managerPassword = formData.managerPassword;

      if (!managerPassword) {
        throw new Error('يرجى إدخال كلمة مرور المدير لإعادة تسجيل الدخول');
      }

      // إنشاء حساب الموظف (سيقوم بتسجيل دخول تلقائي للموظف الجديد)
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const newEmployeeId = userCredential.user.uid;

      // حفظ بيانات الموظف في Firestore (الموظف الجديد مسجل دخول الآن)
      // Security Rules تسمح للمستخدم بإنشاء document خاص به
      await setDoc(doc(db, 'users', newEmployeeId), {
        email: formData.email,
        role: formData.role,
        name: formData.name,
        createdAt: new Date().toISOString(),
        createdBy: managerId // حفظ ID المدير
      });

      // تسجيل خروج المستخدم الجديد فوراً
      await signOut(auth);

      // إعادة تسجيل دخول المدير
      await signInWithEmailAndPassword(auth, managerEmail, managerPassword);

      setSuccess('تم إضافة الموظف بنجاح');
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'dataentry',
        managerPassword: ''
      });
      
      setTimeout(() => {
        navigate('/manager/dashboard');
      }, 1500);
      
    } catch (error) {
      console.error('Error adding employee:', error);
      
      // معالجة الأخطاء
      if (error.code === 'auth/email-already-in-use' || error.code === 'auth/email-already-exists') {
        setError('البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة. يجب أن تكون 6 أحرف على الأقل');
      } else if (error.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صحيح');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('كلمة مرور المدير غير صحيحة');
      } else if (error.message.includes('صلاحية')) {
        setError(error.message);
      } else if (error.message.includes('كلمة مرور المدير')) {
        setError(error.message);
      } else {
        setError(error.message || 'فشل إضافة الموظف. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">إضافة موظف جديد</h1>
            <Link
              to="/manager/dashboard"
              className="text-blue-600 hover:text-blue-700 px-4 py-2"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                اسم الموظف *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل اسم الموظف"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                البريد الإلكتروني *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example@email.com"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                كلمة المرور *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="6 أحرف على الأقل"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                الدور *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="dataentry">Data Entry</option>
                <option value="sales">Sales</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                كلمة مرور المدير * (لإعادة تسجيل الدخول)
              </label>
              <input
                type="password"
                value={formData.managerPassword}
                onChange={(e) => setFormData({ ...formData, managerPassword: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل كلمة مرور المدير"
              />
              <p className="mt-1 text-xs text-gray-500">
                مطلوبة لإعادة تسجيل دخولك بعد إضافة الموظف
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'جاري الحفظ...' : 'إضافة موظف'}
              </button>
              <Link
                to="/manager/dashboard"
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 text-center"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
