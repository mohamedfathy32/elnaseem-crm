import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function SalesDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [myClients, setMyClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState({ buyRate: 0, sellRate: 0 });
  
  // Statistics
  const [statistics, setStatistics] = useState({
    totalClients: 0,
    soldClients: 0,
    monthlyProfit: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    departureAirport: '',
    arrivalAirport: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  useEffect(() => {
    applyFilters();
  }, [myClients, filters]);

  async function fetchData() {
    try {
      // Get exchange rates
      try {
        const ratesDoc = await getDoc(doc(db, 'settings', 'exchangeRates'));
        if (ratesDoc.exists()) {
          const ratesData = ratesDoc.data();
          setExchangeRates({
            buyRate: ratesData.buyRate || 0,
            sellRate: ratesData.sellRate || 0
          });
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
      }

      // Get clients
      const clientsQuery = query(
        collection(db, 'clients'),
        where('assignedTo', '==', currentUser.uid)
      );
      const snapshot = await getDocs(clientsQuery);
      let clients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      clients.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });
      
      setMyClients(clients);
      
      // Calculate statistics
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const sold = clients.filter(c => c.status === 'sold');
      const monthlySold = sold.filter(c => {
        if (!c.updatedAt) return false;
        const updatedDate = new Date(c.updatedAt);
        return updatedDate >= currentMonthStart;
      });
      
      const monthlyProfit = monthlySold.reduce((sum, c) => {
        return sum + (parseFloat(c.profit) || 0);
      }, 0);
      
      setStatistics({
        totalClients: clients.length,
        soldClients: sold.length,
        monthlyProfit: monthlyProfit
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...myClients];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(client => 
        client.clientName?.toLowerCase().includes(searchLower) ||
        client.whatsappNumber?.includes(searchLower)
      );
    }

    // Departure airport filter
    if (filters.departureAirport) {
      filtered = filtered.filter(client => 
        client.departureAirport?.toLowerCase().includes(filters.departureAirport.toLowerCase())
      );
    }

    // Arrival airport filter
    if (filters.arrivalAirport) {
      filtered = filtered.filter(client => 
        client.arrivalAirport?.toLowerCase().includes(filters.arrivalAirport.toLowerCase())
      );
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(client => client.status === filters.status);
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(client => {
        if (!client.travelDate) return false;
        const travelDate = new Date(client.travelDate);
        return travelDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(client => {
        if (!client.travelDate) return false;
        const travelDate = new Date(client.travelDate);
        return travelDate <= toDate;
      });
    }

    setFilteredClients(filtered);
  }

  async function updateClientStatus(clientId, status, note = '', profitData = null) {
    try {
      const clientRef = doc(db, 'clients', clientId);
      const updateData = {
        status,
        updatedAt: new Date().toISOString()
      };

      // Add note if provided
      if (note.trim()) {
        const noteEntry = {
          note: note.trim(),
          author: currentUser.uid,
          authorName: currentUser.email,
          timestamp: new Date().toISOString()
        };
        updateData.notes = arrayUnion(noteEntry);
      }

      // Add profit data if provided
      if (profitData) {
        updateData.profit = profitData.profit;
        updateData.costPrice = profitData.costPrice;
        updateData.sellPrice = profitData.sellPrice;
        updateData.costCurrency = profitData.costCurrency;
        updateData.sellCurrency = profitData.sellCurrency;
      }

      await updateDoc(clientRef, updateData);
      await fetchData();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('فشل تحديث حالة العميل');
    }
  }

  function handleFilterChange(key, value) {
    setFilters({ ...filters, [key]: value });
  }

  function clearFilters() {
    setFilters({
      search: '',
      departureAirport: '',
      arrivalAirport: '',
      status: '',
      dateFrom: '',
      dateTo: ''
    });
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
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard 
            title="إجمالي الطلبات" 
            value={statistics.totalClients} 
            color="blue" 
          />
          <StatCard 
            title="الطلبات الناجحة" 
            value={statistics.soldClients} 
            color="green" 
          />
          <StatCard 
            title="إجمالي الربح (هذا الشهر)" 
            value={`${statistics.monthlyProfit.toFixed(2)} ج.م`} 
            color="indigo" 
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">فلترة العملاء</h2>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              مسح الفلاتر
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                البحث (الاسم أو الرقم)
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="اسم العميل أو رقم الواتساب"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مطار الانطلاق
              </label>
              <input
                type="text"
                value={filters.departureAirport}
                onChange={(e) => handleFilterChange('departureAirport', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مطار الانطلاق"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مطار الوصول
              </label>
              <input
                type="text"
                value={filters.arrivalAirport}
                onChange={(e) => handleFilterChange('arrivalAirport', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مطار الوصول"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الحالة
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">جميع الحالات</option>
                <option value="new">جديد</option>
                <option value="waitingOffer">في انتظار العرض</option>
                <option value="followUp">متابعة</option>
                <option value="sold">تم البيع</option>
                <option value="postponed">مؤجل</option>
                <option value="rejected">رفض</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                تاريخ من
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                تاريخ إلى
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              العملاء ({filteredClients.length})
            </h2>
          </div>
          
          {filteredClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {myClients.length === 0 
                ? 'لا يوجد عملاء مخصصين لك'
                : 'لا توجد نتائج تطابق الفلاتر'}
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
                      مطار الانطلاق
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      مطار الوصول
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
                  {filteredClients.map((client) => (
                    <ClientRow
                      key={client.id}
                      client={client}
                      exchangeRates={exchangeRates}
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

function StatCard({ title, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700'
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function ClientRow({ client, exchangeRates, onStatusChange }) {
  const [status, setStatus] = useState(client.status || 'new');
  const [note, setNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [profitData, setProfitData] = useState({
    costPrice: client.costPrice || '',
    sellPrice: client.sellPrice || '',
    costCurrency: client.costCurrency || 'SAR', // SAR or EGP
    sellCurrency: client.sellCurrency || 'SAR'  // SAR or EGP
  });

  function handleStatusChange(e) {
    const newStatus = e.target.value;
    setStatus(newStatus);
    
    if (newStatus === 'sold') {
      setShowProfitModal(true);
    } else {
      setShowNoteModal(true);
    }
  }

  function calculateProfit() {
    const costPrice = parseFloat(profitData.costPrice) || 0;
    const sellPrice = parseFloat(profitData.sellPrice) || 0;
    
    // Convert cost price to EGP
    let costPriceEGP;
    if (profitData.costCurrency === 'SAR') {
      costPriceEGP = costPrice * exchangeRates.buyRate;
    } else {
      costPriceEGP = costPrice; // Already in EGP
    }
    
    // Convert sell price to EGP
    let sellPriceEGP;
    if (profitData.sellCurrency === 'SAR') {
      sellPriceEGP = sellPrice * exchangeRates.sellRate;
    } else {
      sellPriceEGP = sellPrice; // Already in EGP
    }
    
    const profit = sellPriceEGP - costPriceEGP;
    
    return {
      costPriceEGP,
      sellPriceEGP,
      profit,
      costPriceOriginal: costPrice,
      sellPriceOriginal: sellPrice,
      costCurrency: profitData.costCurrency,
      sellCurrency: profitData.sellCurrency
    };
  }

  async function handleSaveProfit() {
    const calculated = calculateProfit();
    
    await onStatusChange(client.id, 'sold', '', {
      costPrice: parseFloat(profitData.costPrice),
      sellPrice: parseFloat(profitData.sellPrice),
      costCurrency: profitData.costCurrency,
      sellCurrency: profitData.sellCurrency,
      profit: calculated.profit
    });
    
    setShowProfitModal(false);
    setProfitData({ costPrice: '', sellPrice: '', costCurrency: 'SAR', sellCurrency: 'SAR' });
  }

  async function handleSaveNote() {
    await onStatusChange(client.id, status, note);
    setShowNoteModal(false);
    setNote('');
  }

  const calculated = profitData.costPrice && profitData.sellPrice 
    ? calculateProfit() 
    : null;

  return (
    <>
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
          {client.departureAirport || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {client.arrivalAirport || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {client.travelDate ? new Date(client.travelDate).toLocaleDateString('ar-EG') : '-'}
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
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
          {client.profit ? `${client.profit.toFixed(2)} ج.م` : '-'}
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

      {/* Note Modal */}
      {showNoteModal && (
        <NoteModal
          status={status}
          note={note}
          setNote={setNote}
          onSave={handleSaveNote}
          onClose={() => {
            setShowNoteModal(false);
            setNote('');
            setStatus(client.status || 'new');
          }}
        />
      )}

      {/* Profit Modal */}
      {showProfitModal && (
        <ProfitModal
          profitData={profitData}
          setProfitData={setProfitData}
          exchangeRates={exchangeRates}
          calculated={calculated}
          onSave={handleSaveProfit}
          onClose={() => {
            setShowProfitModal(false);
            setProfitData({ costPrice: '', sellPrice: '', costCurrency: 'SAR', sellCurrency: 'SAR' });
            setStatus(client.status || 'new');
          }}
        />
      )}
    </>
  );
}

function NoteModal({ status, note, setNote, onSave, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          إضافة ملاحظة - تغيير الحالة إلى: {getStatusLabel(status)}
        </h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            الملاحظة
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="أدخل ملاحظة..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSave}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            حفظ
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfitModal({ profitData, setProfitData, exchangeRates, calculated, onSave, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          حساب الربح - تم البيع
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              سعر التكلفة
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={profitData.costPrice}
                onChange={(e) => setProfitData({ ...profitData, costPrice: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <select
                value={profitData.costCurrency}
                onChange={(e) => setProfitData({ ...profitData, costCurrency: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SAR">ريال</option>
                <option value="EGP">جنيه</option>
              </select>
            </div>
            {profitData.costPrice && (
              <p className="text-xs text-gray-500 mt-1">
                {profitData.costCurrency === 'SAR' ? (
                  <>
                    = {(parseFloat(profitData.costPrice) * exchangeRates.buyRate).toFixed(2)} ج.م 
                    (معامل الشراء: {exchangeRates.buyRate})
                  </>
                ) : (
                  <>بالجنيه المصري</>
                )}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              سعر البيع
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={profitData.sellPrice}
                onChange={(e) => setProfitData({ ...profitData, sellPrice: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <select
                value={profitData.sellCurrency}
                onChange={(e) => setProfitData({ ...profitData, sellCurrency: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SAR">ريال</option>
                <option value="EGP">جنيه</option>
              </select>
            </div>
            {profitData.sellPrice && (
              <p className="text-xs text-gray-500 mt-1">
                {profitData.sellCurrency === 'SAR' ? (
                  <>
                    = {(parseFloat(profitData.sellPrice) * exchangeRates.sellRate).toFixed(2)} ج.م 
                    (معامل البيع: {exchangeRates.sellRate})
                  </>
                ) : (
                  <>بالجنيه المصري</>
                )}
              </p>
            )}
          </div>

          {calculated && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  سعر التكلفة ({profitData.costCurrency === 'SAR' ? 'ريال' : 'جنيه'}):
                </span>
                <span className="font-semibold">
                  {profitData.costCurrency === 'SAR' 
                    ? `${profitData.costPrice} ريال = ${calculated.costPriceEGP.toFixed(2)} ج.م`
                    : `${profitData.costPrice} ج.م`
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  سعر البيع ({profitData.sellCurrency === 'SAR' ? 'ريال' : 'جنيه'}):
                </span>
                <span className="font-semibold">
                  {profitData.sellCurrency === 'SAR'
                    ? `${profitData.sellPrice} ريال = ${calculated.sellPriceEGP.toFixed(2)} ج.م`
                    : `${profitData.sellPrice} ج.م`
                  }
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="text-sm font-medium text-gray-800">الربح (بالجنيه المصري):</span>
                <span className={`font-bold text-lg ${calculated.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculated.profit.toFixed(2)} ج.م
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onSave}
              disabled={!profitData.costPrice || !profitData.sellPrice}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              حفظ
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusLabel(status) {
  const labels = {
    new: 'جديد',
    waitingOffer: 'في انتظار العرض',
    followUp: 'متابعة',
    sold: 'تم البيع',
    postponed: 'مؤجل',
    rejected: 'رفض'
  };
  return labels[status] || status;
}
