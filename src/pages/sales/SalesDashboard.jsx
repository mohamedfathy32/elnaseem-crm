import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function SalesDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [myClients, setMyClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchMyClients();
    }
  }, [currentUser]);

  async function fetchMyClients() {
    try {
      const clientsQuery = query(
        collection(db, 'clients'),
        where('assignedTo', '==', currentUser.uid)
      );
      const snapshot = await getDocs(clientsQuery);
      let clients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by createdAt on client side (to avoid needing composite index)
      clients.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA; // Descending order
      });
      setMyClients(clients);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setLoading(false);
    }
  }

  async function updateClientStatus(clientId, status, profit = null) {
    try {
      const clientRef = doc(db, 'clients', clientId);
      const updateData = { status };
      if (profit !== null) {
        updateData.profit = parseFloat(profit);
      }
      await updateDoc(clientRef, updateData);
      await fetchMyClients(); // Refresh list
    } catch (error) {
      console.error('Error updating client:', error);
      alert('فشل تحديث حالة العميل');
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">لوحة تحكم Sales</h1>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 px-4 py-2"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              العملاء المخصصين لي ({myClients.length})
            </h2>
          </div>
          
          {myClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              لا يوجد عملاء مخصصين لك
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الصورة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      اسم العميل
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      رقم الواتساب
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      المصدر
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      تاريخ السفر
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الربح
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {myClients.map((client) => (
                    <ClientRow
                      key={client.id}
                      client={client}
                      onStatusChange={updateClientStatus}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ClientRow({ client, onStatusChange }) {
  const [status, setStatus] = useState(client.status || 'new');
  const [profit, setProfit] = useState(client.profit || '');
  const [showProfitInput, setShowProfitInput] = useState(false);

  function handleStatusChange(e) {
    const newStatus = e.target.value;
    setStatus(newStatus);
    
    if (newStatus === 'sold') {
      setShowProfitInput(true);
    } else {
      setShowProfitInput(false);
      onStatusChange(client.id, newStatus);
    }
  }

  function handleSaveProfit() {
    if (status === 'sold' && profit) {
      onStatusChange(client.id, status, profit);
      setShowProfitInput(false);
    } else {
      onStatusChange(client.id, status);
    }
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        {client.passportUrl ? (
          <img 
            src={client.passportUrl} 
            alt="الباسبور" 
            className="w-16 h-16 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-75"
            onClick={() => window.open(client.passportUrl, '_blank')}
          />
        ) : (
          <span className="text-gray-400 text-xs">لا توجد صورة</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        <Link 
          to={`/client/${client.id}`}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {client.clientName}
        </Link>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {client.whatsappNumber}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {client.source}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {client.travelDate || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <select
          value={status}
          onChange={handleStatusChange}
          className="px-3 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="new">جديد</option>
          <option value="waitingOffer">في انتظار العرض</option>
          <option value="followUp">متابعة</option>
          <option value="sold">تم البيع</option>
          <option value="postponed">مؤجل</option>
          <option value="rejected">رفض</option>
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {showProfitInput ? (
          <div className="flex gap-2">
            <input
              type="number"
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
              placeholder="الربح"
              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <button
              onClick={handleSaveProfit}
              className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
            >
              حفظ
            </button>
          </div>
        ) : (
          <span>{client.profit ? `${client.profit} ج.م` : '-'}</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <span className={`px-2 py-1 rounded-full text-xs ${
          status === 'sold' ? 'bg-green-100 text-green-800' :
          status === 'rejected' ? 'bg-red-100 text-red-800' :
          status === 'postponed' ? 'bg-yellow-100 text-yellow-800' :
          status === 'waitingOffer' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {status === 'sold' ? 'تم البيع' :
           status === 'rejected' ? 'رفض' :
           status === 'postponed' ? 'مؤجل' :
           status === 'waitingOffer' ? 'في انتظار العرض' :
           status === 'followUp' ? 'متابعة' : 'جديد'}
        </span>
      </td>
    </tr>
  );
}
