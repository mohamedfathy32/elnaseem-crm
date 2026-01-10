import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { auth } from '../../firebase/firebase';
import { Link } from 'react-router-dom';
import { CLOUDINARY_CONFIG } from '../../utils/cloudinary';

export default function AddClient() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    source: '',
    clientName: '',
    whatsappNumber: '',
    travelDate: '',
    departureAirport: '',
    arrivalAirport: '',
    followUpDate: '',
    notes: ''
  });
  const [passportUrl, setPassportUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const cloudinaryWidgetRef = useRef(null);

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }

  function handleUploadClick() {
    // Load Cloudinary Widget script if not already loaded
    if (!window.cloudinary) {
      const script = document.createElement('script');
      script.src = 'https://upload-widget.cloudinary.com/global/all.js';
      script.async = true;
      document.body.appendChild(script);
      
      script.onload = () => {
        openCloudinaryWidget();
      };
    } else {
      openCloudinaryWidget();
    }
  }

  function openCloudinaryWidget() {
    cloudinaryWidgetRef.current = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CONFIG.cloudName,
        uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
        sources: ['local', 'camera'],
        multiple: false,
        maxFileSize: 10000000, // 10MB
        clientAllowedFormats: ['image', 'pdf']
      },
      (error, result) => {
        if (!error && result && result.event === 'success') {
          setPassportUrl(result.info.secure_url);
          setUploadProgress('تم رفع الصورة بنجاح');
          setError('');
        } else if (error) {
          setError('فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
          setUploadProgress('');
        }
      }
    );

    cloudinaryWidgetRef.current.open();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setUploadProgress('');

    try {
      // Save client data
      setUploadProgress('جاري حفظ بيانات العميل...');
      const clientData = {
        ...formData,
        passportUrl: passportUrl || '',
        status: 'new',
        assignedTo: null, // Will be assigned by manager
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
      };

      await addDoc(collection(db, 'clients'), clientData);

      setSuccess('تم إضافة العميل بنجاح');
      setFormData({
        source: '',
        clientName: '',
        whatsappNumber: '',
        travelDate: '',
        departureAirport: '',
        arrivalAirport: '',
        followUpDate: '',
        notes: ''
      });
      setPassportUrl('');

      setTimeout(() => {
        navigate('/dataentry/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Error adding client:', error);
      setError('فشل إضافة العميل. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">إضافة عميل جديد</h1>
            <Link
              to="/dataentry/dashboard"
              className="text-blue-600 hover:text-blue-700 px-4 py-2"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          {uploadProgress && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
              {uploadProgress}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                المصدر *
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر المصدر</option>
                <option value="واتساب">واتساب</option>
                <option value="فيس بوك">فيس بوك</option>
                <option value="فون">فون</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                اسم العميل *
              </label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل اسم العميل"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                رقم الواتساب *
              </label>
              <input
                type="tel"
                name="whatsappNumber"
                value={formData.whatsappNumber}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+20XXXXXXXXXX"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                تاريخ السفر
              </label>
              <input
                type="date"
                name="travelDate"
                value={formData.travelDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                مطار الانطلاق
              </label>
              <input
                type="text"
                name="departureAirport"
                value={formData.departureAirport}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مثال: مطار القاهرة"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                مطار الوصول
              </label>
              <input
                type="text"
                name="arrivalAirport"
                value={formData.arrivalAirport}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مثال: مطار دبي"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                رفع صورة الباسبور (صورة أو PDF)
              </label>
              <button
                type="button"
                onClick={handleUploadClick}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {passportUrl ? 'تم رفع الصورة - اضغط لتغييرها' : 'رفع صورة الباسبور'}
              </button>
              {passportUrl && (
                <div className="mt-4">
                  <p className="text-sm text-green-600 mb-2">تم رفع الصورة بنجاح</p>
                  <img 
                    src={passportUrl} 
                    alt="الباسبور" 
                    className="max-w-full h-48 object-contain border border-gray-300 rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setPassportUrl('')}
                    className="mt-2 text-sm text-red-600 hover:text-red-700"
                  >
                    إزالة الصورة
                  </button>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                تاريخ متابعة (اختياري)
              </label>
              <input
                type="date"
                name="followUpDate"
                value={formData.followUpDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                ملاحظات
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل أي ملاحظات إضافية..."
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ العميل'}
              </button>
              <Link
                to="/dataentry/dashboard"
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
