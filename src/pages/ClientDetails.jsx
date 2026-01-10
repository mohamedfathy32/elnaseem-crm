import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [client, setClient] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClientDetails();
  }, [id]);

  async function fetchClientDetails() {
    try {
      const clientDoc = await getDoc(doc(db, 'clients', id));
      
      if (!clientDoc.exists()) {
        setError('العميل غير موجود');
        setLoading(false);
        return;
      }

      const clientData = { id: clientDoc.id, ...clientDoc.data() };
      setClient(clientData);

      // Get employee info if assigned
      if (clientData.assignedTo) {
        const empDoc = await getDoc(doc(db, 'users', clientData.assignedTo));
        if (empDoc.exists()) {
          setEmployee({ id: empDoc.id, ...empDoc.data() });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching client details:', error);
      setError('فشل تحميل بيانات العميل');
      setLoading(false);
    }
  }

  async function updateStatus(newStatus, profit = null) {
    if (!client) return;

    try {
      const updateData = { status: newStatus };
      if (profit !== null && newStatus === 'sold') {
        updateData.profit = parseFloat(profit);
      }

      await updateDoc(doc(db, 'clients', client.id), updateData);
      setClient({ ...client, ...updateData });
      alert('تم تحديث الحالة بنجاح');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('فشل تحديث الحالة');
    }
  }

  function getBackPath() {
    if (userRole === 'manager') return '/manager/dashboard';
    if (userRole === 'dataentry') return '/dataentry/dashboard';
    if (userRole === 'sales') return '/sales/dashboard';
    return '/login';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">جاري التحميل...</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-xl text-red-600 mb-4">{error || 'العميل غير موجود'}</p>
            <Link
              to={getBackPath()}
              className="text-blue-600 hover:text-blue-700"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">تفاصيل العميل</h1>
            <Link
              to={getBackPath()}
              className="text-blue-600 hover:text-blue-700 px-4 py-2"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Client Info */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">معلومات العميل</h2>
          </div>
          
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
              <p className="text-gray-900">{client.clientName}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الواتساب</label>
              <p className="text-gray-900">
                <a href={`https://wa.me/${client.whatsappNumber?.replace(/[^0-9]/g, '')}`} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-blue-600 hover:underline">
                  {client.whatsappNumber}
                </a>
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المصدر</label>
              <p className="text-gray-900">{client.source}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                client.status === 'sold' ? 'bg-green-100 text-green-800' :
                client.status === 'rejected' ? 'bg-red-100 text-red-800' :
                client.status === 'postponed' ? 'bg-yellow-100 text-yellow-800' :
                client.status === 'waitingOffer' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {client.status === 'sold' ? 'تم البيع' :
                 client.status === 'rejected' ? 'رفض' :
                 client.status === 'postponed' ? 'مؤجل' :
                 client.status === 'waitingOffer' ? 'في انتظار العرض' :
                 client.status === 'followUp' ? 'متابعة' : 'جديد'}
              </span>
            </div>
            
            {client.travelDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ السفر</label>
                <p className="text-gray-900">{new Date(client.travelDate).toLocaleDateString('ar-EG')}</p>
              </div>
            )}
            
            {client.departureAirport && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مطار الانطلاق</label>
                <p className="text-gray-900">{client.departureAirport}</p>
              </div>
            )}
            
            {client.arrivalAirport && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مطار الوصول</label>
                <p className="text-gray-900">{client.arrivalAirport}</p>
              </div>
            )}
            
            {client.followUpDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ المتابعة</label>
                <p className="text-gray-900">{new Date(client.followUpDate).toLocaleDateString('ar-EG')}</p>
              </div>
            )}
            
            {employee && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مسند إلى</label>
                <p className="text-gray-900">{employee.name || employee.email}</p>
              </div>
            )}
            
            {client.profit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الربح</label>
                <p className="text-gray-900 font-semibold">{client.profit} ج.م</p>
              </div>
            )}
            
            {client.createdAt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإضافة</label>
                <p className="text-gray-900">{new Date(client.createdAt).toLocaleDateString('ar-EG')}</p>
              </div>
            )}
          </div>

          {/* Passport Image */}
          {client.passportUrl && (
            <div className="px-6 py-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">صورة الباسبور</label>
              <div className="flex justify-center">
                <img 
                  src={client.passportUrl} 
                  alt="الباسبور" 
                  className="max-w-full max-h-96 object-contain border border-gray-300 rounded-lg shadow"
                />
              </div>
              <a 
                href={client.passportUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 inline-block text-blue-600 hover:text-blue-700 text-sm"
              >
                فتح الصورة في نافذة جديدة
              </a>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="px-6 py-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات</label>
              <p className="text-gray-900 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}

          {/* Update Status (for Sales and Manager) */}
          {(userRole === 'sales' || userRole === 'manager') && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">تحديث الحالة</h3>
              <StatusUpdateForm 
                currentStatus={client.status} 
                currentProfit={client.profit}
                onUpdate={updateStatus} 
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusUpdateForm({ currentStatus, currentProfit, onUpdate }) {
  const [status, setStatus] = useState(currentStatus);
  const [profit, setProfit] = useState(currentProfit || '');
  const [showProfitInput, setShowProfitInput] = useState(false);

  function handleStatusChange(e) {
    const newStatus = e.target.value;
    setStatus(newStatus);
    
    if (newStatus === 'sold') {
      setShowProfitInput(true);
    } else {
      setShowProfitInput(false);
      onUpdate(newStatus);
    }
  }

  function handleSave() {
    if (status === 'sold' && profit) {
      onUpdate(status, profit);
    } else {
      onUpdate(status);
    }
    setShowProfitInput(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">الحالة</label>
        <select
          value={status}
          onChange={handleStatusChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="new">جديد</option>
          <option value="waitingOffer">في انتظار العرض</option>
          <option value="followUp">متابعة</option>
          <option value="sold">تم البيع</option>
          <option value="postponed">مؤجل</option>
          <option value="rejected">رفض</option>
        </select>
      </div>

      {showProfitInput && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">الربح (ج.م)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="أدخل الربح"
            />
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              حفظ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
