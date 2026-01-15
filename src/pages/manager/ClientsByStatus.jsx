import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { Link, useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function ClientsByStatus() {
  const { status } = useParams();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeNames, setEmployeeNames] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const statusLabels = {
    all: 'إجمالي العملاء',
    sold: 'تم البيع',
    postponed: 'مؤجل',
    rejected: 'رفض',
    waitingOffer: 'في انتظار العرض',
    followUp: 'متابعة',
    new: 'جديد'
  };

  useEffect(() => {
    fetchClients();
  }, [status]);

  useEffect(() => {
    if (allClients.length > 0) {
      applyDateFilter(allClients);
    }
  }, [dateFrom, dateTo, allClients]);

  function applyDateFilter(clientsData) {
    let filtered = [...clientsData];

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(client => {
        if (!client.createdAt) return false;
        const clientDate = new Date(client.createdAt);
        clientDate.setHours(0, 0, 0, 0);
        return clientDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(client => {
        if (!client.createdAt) return false;
        const clientDate = new Date(client.createdAt);
        return clientDate <= toDate;
      });
    }

    setClients(filtered);
  }

  function handleExportToExcel() {
    const dataToExport = clients.length > 0 ? clients : allClients;
    
    const statusLabelsMap = {
      sold: 'تم البيع',
      rejected: 'رفض',
      postponed: 'مؤجل',
      waitingOffer: 'في انتظار العرض',
      followUp: 'متابعة',
      new: 'جديد'
    };
    
    // Prepare data for Excel
    const excelData = dataToExport.map(client => {
      return {
        'اسم العميل': client.clientName || '',
        'رقم الواتساب': client.whatsappNumber || '',
        'المصدر': client.source || '',
        'تاريخ السفر': client.travelDate ? new Date(client.travelDate).toLocaleDateString('ar-EG') : '',
        'المسند إلى': client.assignedTo ? (employeeNames[client.assignedTo] || 'غير معروف') : '',
        'الحالة': statusLabelsMap[client.status] || client.status || '',
        'الربح': client.profit ? `${parseFloat(client.profit).toFixed(2)} ج.م` : '',
        'سعر التكلفة': client.costPrice ? `${client.costPrice} ${client.costCurrency === 'SAR' ? 'ريال' : 'جنيه'}` : '',
        'سعر البيع': client.sellPrice ? `${client.sellPrice} ${client.sellCurrency === 'SAR' ? 'ريال' : 'جنيه'}` : '',
        'رقم BNR': client.bnrNumber || '',
        'تاريخ الإضافة': client.createdAt ? new Date(client.createdAt).toLocaleDateString('ar-EG') : '',
        'آخر تحديث': client.updatedAt ? new Date(client.updatedAt).toLocaleDateString('ar-EG') : ''
      };
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'العملاء');

    // Generate filename
    const statusLabel = statusLabels[status] || 'العملاء';
    const dateStr = dateFrom || dateTo ? `_${dateFrom || ''}_${dateTo || ''}` : '';
    const cleanDateStr = dateStr.replace(/^_+|_+$/g, '').replace(/_+/g, '_');
    const filename = `${statusLabel}${cleanDateStr ? '_' + cleanDateStr : ''}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  }

  async function fetchClients() {
    try {
      setLoading(true);
      let clientsQuery;
      
      if (status === 'all') {
        // Get all clients
        clientsQuery = collection(db, 'clients');
      } else {
        // Get clients by status
        clientsQuery = query(
          collection(db, 'clients'),
          where('status', '==', status)
        );
      }

      const snapshot = await getDocs(clientsQuery);
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by createdAt (newest first)
      clientsData.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });

      setAllClients(clientsData);
      applyDateFilter(clientsData);

      // Fetch employee names
      const uniqueEmployeeIds = [...new Set(clientsData.map(c => c.assignedTo).filter(Boolean))];
      const namesMap = {};
      
      await Promise.all(
        uniqueEmployeeIds.map(async (empId) => {
          try {
            const empDoc = await getDoc(doc(db, 'users', empId));
            if (empDoc.exists()) {
              const empData = empDoc.data();
              namesMap[empId] = empData.name || empData.email || 'غير معروف';
            }
          } catch (error) {
            console.error(`Error fetching employee ${empId}:`, error);
          }
        })
      );
      
      setEmployeeNames(namesMap);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setLoading(false);
    }
  }

  function getStatusBadge(status) {
    const badges = {
      sold: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      postponed: 'bg-yellow-100 text-yellow-800',
      waitingOffer: 'bg-blue-100 text-blue-800',
      followUp: 'bg-indigo-100 text-indigo-800',
      new: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      sold: 'تم البيع',
      rejected: 'رفض',
      postponed: 'مؤجل',
      waitingOffer: 'في انتظار العرض',
      followUp: 'متابعة',
      new: 'جديد'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
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
            <h1 className="text-2xl font-bold text-gray-800">
              {statusLabels[status] || 'العملاء'}
            </h1>
            <button
              onClick={() => navigate('/manager/dashboard')}
              className="text-blue-600 hover:text-blue-700 px-4 py-2"
            >
              العودة للوحة التحكم
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {statusLabels[status] || 'العملاء'} ({clients.length})
              </h2>
              <button
                onClick={handleExportToExcel}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                تحميل Excel
              </button>
            </div>
            
            {/* Date Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  مسح الفلتر
                </button>
              </div>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              لا يوجد عملاء
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الصورة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      اسم العميل
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      رقم الواتساب
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المصدر
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      تاريخ السفر
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المسند إلى
                    </th>
                    {status === 'all' && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الحالة
                      </th>
                    )}
                    {status === 'sold' && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الربح
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      تاريخ الإضافة
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
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
                        {client.source || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.travelDate ? new Date(client.travelDate).toLocaleDateString('ar-EG') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.assignedTo ? (employeeNames[client.assignedTo] || 'غير معروف') : '-'}
                      </td>
                      {status === 'all' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {getStatusBadge(client.status)}
                        </td>
                      )}
                      {status === 'sold' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                          {client.profit ? `${parseFloat(client.profit).toFixed(2)} ج.م` : '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString('ar-EG') : '-'}
                      </td>
                    </tr>
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
