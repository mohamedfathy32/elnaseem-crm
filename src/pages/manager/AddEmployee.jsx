import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/firebase';

export default function AddEmployee() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'dataentry'
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
      // استدعاء Cloud Function لإنشاء الموظف
      // هذا لن يسجل دخول المدير تلقائياً لأنه يستخدم Admin SDK
      const createEmployee = httpsCallable(functions, 'createEmployee');
      
      const result = await createEmployee({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role
      });

      if (result.data.success) {
        setSuccess('تم إضافة الموظف بنجاح');
        setFormData({ name: '', email: '', password: '', role: 'dataentry' });
        
        setTimeout(() => {
          navigate('/manager/dashboard');
        }, 1500);
      }
      
    } catch (error) {
      console.error('Error adding employee:', error);
      
      // معالجة الأخطاء من Cloud Function
      // Firebase Functions throws HttpsError with code and message
      if (error.code === 'functions/already-exists' || error.code === 'already-exists') {
        setError('البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'functions/permission-denied' || error.code === 'permission-denied') {
        setError('ليس لديك صلاحية لإضافة موظفين');
      } else if (error.code === 'functions/unauthenticated' || error.code === 'unauthenticated') {
        setError('يجب تسجيل الدخول أولاً');
      } else if (error.code === 'functions/invalid-argument' || error.code === 'invalid-argument') {
        setError(error.message || 'البيانات المدخلة غير صحيحة');
      } else if (error.code === 'functions/unavailable' || error.code === 'unavailable') {
        setError('الخدمة غير متاحة حالياً. تأكد من نشر Cloud Functions أولاً.');
      } else {
        setError(error.message || 'فشل إضافة الموظف. تأكد من نشر Cloud Functions. يرجى المحاولة مرة أخرى.');
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

            <div className="mb-6">
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
