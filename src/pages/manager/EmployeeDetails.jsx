import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
// import { useAuth } from '../../contexts/AuthContext';
// import { useAuth as useFirebaseAuth } from 'firebase/auth';
// import { auth } from '../../firebase/firebase';

export default function EmployeeDetails() {
  const { id } = useParams();
  // const navigate = useNavigate();
  // const { userRole } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [employeeClients, setEmployeeClients] = useState([]);
  const [statistics, setStatistics] = useState({
    totalClients: 0,
    sold: 0,
    postponed: 0,
    rejected: 0,
    waitingOffer: 0,
    followUp: 0,
    totalProfit: 0,
    monthlyProfit: 0,
    avgProfit: 0,
    loginCount: 0,
    lastLogin: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchEmployeeData();
  }, [id]);

  async function fetchEmployeeData() {
    try {
      // Get employee data
      const empDoc = await getDoc(doc(db, 'users', id));
      
      if (!empDoc.exists()) {
        setError('الموظف غير موجود');
        setLoading(false);
        return;
      }

      const empData = { id: empDoc.id, ...empDoc.data() };
      setEmployee(empData);

      // Get employee clients
      const clientsQuery = query(
        collection(db, 'clients'),
        where('assignedTo', '==', id)
      );
      const clientsSnapshot = await getDocs(clientsQuery);
      const clients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort clients
      clients.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });

      setEmployeeClients(clients);

      // Calculate statistics
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const sold = clients.filter(c => c.status === 'sold');
      const monthlySold = sold.filter(c => {
        if (!c.updatedAt) return false;
        const updatedDate = new Date(c.updatedAt);
        return updatedDate >= currentMonthStart;
      });

      const profits = sold.map(c => parseFloat(c.profit) || 0);
      const totalProfit = profits.reduce((sum, p) => sum + p, 0);
      const monthlyProfits = monthlySold.map(c => parseFloat(c.profit) || 0);
      const monthlyProfit = monthlyProfits.reduce((sum, p) => sum + p, 0);
      const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0;

      setStatistics({
        totalClients: clients.length,
        sold: sold.length,
        postponed: clients.filter(c => c.status === 'postponed').length,
        rejected: clients.filter(c => c.status === 'rejected').length,
        waitingOffer: clients.filter(c => c.status === 'waitingOffer').length,
        followUp: clients.filter(c => c.status === 'followUp').length,
        totalProfit: totalProfit,
        monthlyProfit: monthlyProfit,
        avgProfit: avgProfit,
        loginCount: empData.loginCount || 0,
        lastLogin: empData.lastLogin || null
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching employee data:', error);
      setError('فشل تحميل بيانات الموظف');
      setLoading(false);
    }
  }

  async function toggleEmployeeStatus() {
    if (!employee) return;

    setUpdating(true);
    try {
      const newStatus = employee.disabled ? false : true;
      await updateDoc(doc(db, 'users', id), {
        disabled: newStatus,
        updatedAt: new Date().toISOString()
      });

      setEmployee({ ...employee, disabled: newStatus });
      alert(newStatus ? 'تم تعطيل الحساب بنجاح' : 'تم تفعيل الحساب بنجاح');
    } catch (error) {
      console.error('Error updating employee status:', error);
      alert('فشل تحديث حالة الحساب');
    } finally {
      setUpdating(false);
    }
  }

  function getBackPath() {
    return '/manager/dashboard';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">جاري التحميل...</div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-xl text-red-600 mb-4">{error || 'الموظف غير موجود'}</p>
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
            <h1 className="text-2xl font-bold text-gray-800">تفاصيل الموظف</h1>
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
        {/* Employee Info */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">معلومات الموظف</h2>
            <button
              onClick={toggleEmployeeStatus}
              disabled={updating}
              className={`px-4 py-2 rounded-lg text-white ${
                employee.disabled 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {updating 
                ? 'جاري التحديث...' 
                : employee.disabled 
                  ? 'تفعيل الحساب' 
                  : 'تعطيل الحساب'}
            </button>
          </div>
          
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
              <p className="text-gray-900 font-semibold">{employee.name || '-'}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <p className="text-gray-900">{employee.email}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
              <p className="text-gray-900">
                {employee.role === 'dataentry' ? 'Data Entry' : employee.role === 'sales' ? 'Sales' : employee.role}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">حالة الحساب</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                employee.disabled 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {employee.disabled ? 'معطل' : 'نشط'}
              </span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإنشاء</label>
              <p className="text-gray-900">
                {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString('ar-EG') : '-'}
              </p>
            </div>
            
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">آخر تسجيل دخول</label>
              <p className="text-gray-900">
                {statistics.lastLogin ? new Date(statistics.lastLogin).toLocaleDateString('ar-EG') : 'لم يسجل دخول بعد'}
              </p>
            </div> */}
            
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">عدد مرات الدخول (هذا الشهر)</label>
              <p className="text-gray-900 font-semibold">{statistics.loginCount}</p>
            </div> */}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="إجمالي العملاء" value={statistics.totalClients} color="blue" />
          <StatCard title="تم البيع" value={statistics.sold} color="green" />
          <StatCard title="مؤجل" value={statistics.postponed} color="yellow" />
          <StatCard title="رفض" value={statistics.rejected} color="red" />
          <StatCard title="في انتظار العرض" value={statistics.waitingOffer} color="purple" />
          <StatCard title="متابعة" value={statistics.followUp} color="indigo" />
          <StatCard title="إجمالي الربح" value={`${statistics.totalProfit.toFixed(2)} ج.م`} color="green" />
          <StatCard title="ربح هذا الشهر" value={`${statistics.monthlyProfit.toFixed(2)} ج.م`} color="indigo" />
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              عملاء الموظف ({employeeClients.length})
            </h2>
          </div>
          
          {employeeClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              لا يوجد عملاء مخصصين لهذا الموظف
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
                      تاريخ الإضافة
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employeeClients.map((client) => (
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
                        {client.source}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.travelDate ? new Date(client.travelDate).toLocaleDateString('ar-EG') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                        {client.profit ? `${client.profit.toFixed(2)} ج.م` : '-'}
                      </td>
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

function StatCard({ title, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700'
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
