import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, getDoc as getDocFn } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole, currentUser } = useAuth();
  const [client, setClient] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({ buyRate: 0, sellRate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    fetchClientDetails();
  }, [id]);

  async function fetchClientDetails() {
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

      const clientDoc = await getDoc(doc(db, 'clients', id));
      
      if (!clientDoc.exists()) {
        setError('العميل غير موجود');
        setLoading(false);
        return;
      }

      const clientData = { id: clientDoc.id, ...clientDoc.data() };
      
      // Check if user has access to this client
      // Manager can access all clients
      // Sales/DataEntry can only access clients assigned to them
      if (userRole !== 'manager') {
        if (!currentUser || clientData.assignedTo !== currentUser.uid) {
          setUnauthorized(true);
          setError('ليس لديك صلاحية للوصول إلى هذا العميل');
          setLoading(false);
          return;
        }
      }

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

  async function updateStatus(newStatus, note = '', profitData = null) {
    if (!client || !currentUser) return;

    try {
      const updateData = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      // Add note if provided
      if (note.trim()) {
        const noteEntry = {
          note: note.trim(),
          author: currentUser.uid,
          authorName: currentUser.email,
          timestamp: new Date().toISOString(),
          statusChange: newStatus
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

      await updateDoc(doc(db, 'clients', client.id), updateData);
      await fetchClientDetails(); // Refresh data
      alert('تم التحديث بنجاح');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('فشل التحديث');
    }
  }

  async function assignToEmployee(employeeId) {
    if (!client || !currentUser) return;

    try {
      await updateDoc(doc(db, 'clients', client.id), {
        assignedTo: employeeId || null,
        assignedAt: employeeId ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });
      
      await fetchClientDetails(); // Refresh data
      alert('تم تعيين العميل بنجاح');
    } catch (error) {
      console.error('Error assigning client:', error);
      alert('فشل تعيين العميل');
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

  if (error || !client || unauthorized) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-xl text-red-600 mb-4">
              {unauthorized ? 'ليس لديك صلاحية للوصول إلى هذا العميل' : (error || 'العميل غير موجود')}
            </p>
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

  // Sort notes by timestamp (newest first)
  const notes = client.notes || [];
  const sortedNotes = Array.isArray(notes) 
    ? [...notes].sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return dateB - dateA;
      })
    : [];

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Info */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">معلومات العميل</h2>
              </div>
              
              <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
                  <p className="text-gray-900 font-semibold">{client.clientName}</p>
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
                    <p className="text-gray-900">
                      {userRole === 'manager' ? (
                        <Link 
                          to={`/manager/employee/${employee.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {employee.name || employee.email}
                        </Link>
                      ) : (
                        employee.name || employee.email
                      )}
                    </p>
                  </div>
                )}
                
                {client.createdAt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإضافة</label>
                    <p className="text-gray-900">{new Date(client.createdAt).toLocaleDateString('ar-EG')}</p>
                  </div>
                )}

                {client.updatedAt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">آخر تحديث</label>
                    <p className="text-gray-900">{new Date(client.updatedAt).toLocaleDateString('ar-EG')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Profit Info */}
            {client.status === 'sold' && (client.profit || client.costPrice || client.sellPrice) && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">معلومات الربح</h2>
                </div>
                
                <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {client.costPrice && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة</label>
                      <p className="text-gray-900 font-semibold">
                        {client.costPrice} {client.costCurrency === 'SAR' ? 'ريال' : 'جنيه'}
                        {client.costCurrency === 'SAR' && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({((client.costPrice || 0) * exchangeRates.buyRate).toFixed(2)} ج.م)
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {client.sellPrice && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
                      <p className="text-gray-900 font-semibold">
                        {client.sellPrice} {client.sellCurrency === 'SAR' ? 'ريال' : 'جنيه'}
                        {client.sellCurrency === 'SAR' && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({((client.sellPrice || 0) * exchangeRates.sellRate).toFixed(2)} ج.م)
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {client.profit && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الربح (بالجنيه المصري)</label>
                      <p className="text-gray-900 font-bold text-lg text-green-600">
                        {client.profit.toFixed(2)} ج.م
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Passport Image */}
            {client.passportUrl && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700">صورة الباسبور</label>
                </div>
                <div className="px-6 py-4">
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
                    className="mt-4 inline-block text-blue-600 hover:text-blue-700 text-sm"
                  >
                    فتح الصورة في نافذة جديدة
                  </a>
                </div>
              </div>
            )}

            {/* Notes History */}
            {sortedNotes.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">سجل الملاحظات</h2>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {sortedNotes.map((note, index) => (
                    <div key={index} className="px-6 py-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-gray-900 whitespace-pre-wrap">{note.note}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                        <div className="flex items-center gap-2">
                          {note.statusChange && (
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              note.statusChange === 'sold' ? 'bg-green-100 text-green-800' :
                              note.statusChange === 'rejected' ? 'bg-red-100 text-red-800' :
                              note.statusChange === 'postponed' ? 'bg-yellow-100 text-yellow-800' :
                              note.statusChange === 'waitingOffer' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {note.statusChange === 'sold' ? 'تم البيع' :
                               note.statusChange === 'rejected' ? 'رفض' :
                               note.statusChange === 'postponed' ? 'مؤجل' :
                               note.statusChange === 'waitingOffer' ? 'في انتظار العرض' :
                               note.statusChange === 'followUp' ? 'متابعة' : 'جديد'}
                            </span>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{note.authorName || 'غير معروف'}</p>
                          <p>{note.timestamp ? new Date(note.timestamp).toLocaleString('ar-EG') : '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Original Notes (if exists as string) */}
            {client.notes && typeof client.notes === 'string' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700">ملاحظات</label>
                </div>
                <div className="px-6 py-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{client.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Actions */}
          <div className="space-y-6">
            {/* Update Status */}
            {(userRole === 'sales' || userRole === 'manager') && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">تحديث الحالة</h3>
                </div>
                <div className="px-6 py-4">
                  <StatusUpdateForm 
                    currentStatus={client.status} 
                    currentProfit={client.profit}
                    currentCostPrice={client.costPrice}
                    currentSellPrice={client.sellPrice}
                    currentCostCurrency={client.costCurrency}
                    currentSellCurrency={client.sellCurrency}
                    exchangeRates={exchangeRates}
                    onUpdate={updateStatus} 
                  />
                </div>
              </div>
            )}

            {/* Assign Employee (Manager only) */}
            {userRole === 'manager' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">تعيين موظف</h3>
                </div>
                <div className="px-6 py-4">
                  <AssignEmployeeForm
                    currentEmployee={employee}
                    clientId={client.id}
                    onAssign={assignToEmployee}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusUpdateForm({ 
  currentStatus, 
  currentProfit, 
  currentCostPrice,
  currentSellPrice,
  currentCostCurrency,
  currentSellCurrency,
  exchangeRates,
  onUpdate 
}) {
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [profitData, setProfitData] = useState({
    costPrice: currentCostPrice || '',
    sellPrice: currentSellPrice || '',
    costCurrency: currentCostCurrency || 'SAR',
    sellCurrency: currentSellCurrency || 'SAR'
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
    
    let costPriceEGP;
    if (profitData.costCurrency === 'SAR') {
      costPriceEGP = costPrice * exchangeRates.buyRate;
    } else {
      costPriceEGP = costPrice;
    }
    
    let sellPriceEGP;
    if (profitData.sellCurrency === 'SAR') {
      sellPriceEGP = sellPrice * exchangeRates.sellRate;
    } else {
      sellPriceEGP = sellPrice;
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
    await onUpdate('sold', '', {
      costPrice: profitData.costPrice,
      sellPrice: profitData.sellPrice,
      costCurrency: profitData.costCurrency,
      sellCurrency: profitData.sellCurrency,
      profit: calculated.profit
    });
    setShowProfitModal(false);
    setProfitData({ costPrice: '', sellPrice: '', costCurrency: 'SAR', sellCurrency: 'SAR' });
  }

  async function handleSaveNote() {
    await onUpdate(status, note);
    setShowNoteModal(false);
    setNote('');
  }

  const calculated = profitData.costPrice && profitData.sellPrice ? calculateProfit() : null;

  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">الحالة</label>
          <select
            value={status}
            onChange={handleStatusChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="new">جديد</option>
            <option value="waitingOffer">في انتظار العرض</option>
            <option value="followUp">متابعة</option>
            <option value="sold">تم البيع</option>
            <option value="postponed">مؤجل</option>
            <option value="rejected">رفض</option>
          </select>
        </div>
      </div>

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
            setStatus(currentStatus);
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
            setStatus(currentStatus);
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

function AssignEmployeeForm({ currentEmployee, clientId, onAssign }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(currentEmployee?.id || '');

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const employeesQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['dataentry', 'sales'])
      );
      const snapshot = await getDocs(employeesQuery);
      const employeesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmployees(employeesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setLoading(false);
    }
  }

  async function handleAssign() {
    await onAssign(selectedEmployee || null);
    setSelectedEmployee('');
  }

  if (loading) {
    return <div className="text-sm text-gray-500">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">الموظف</label>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">غير مسند</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.name || emp.email} ({emp.role === 'dataentry' ? 'Data Entry' : 'Sales'})
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleAssign}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        حفظ
      </button>
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
