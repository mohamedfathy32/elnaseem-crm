import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function ManagerDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState({
    totalClients: 0,
    sold: 0,
    postponed: 0,
    rejected: 0,
    waitingOffer: 0,
    totalProfit: 0
  });
  const [employees, setEmployees] = useState([]);
  const [assignedClients, setAssignedClients] = useState([]);
  const [unassignedClients, setUnassignedClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [selectedEmployee, setSelectedEmployee] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Get all clients
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const allClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get all employees
      const employeesSnapshot = await getDocs(
        query(collection(db, 'users'), where('role', 'in', ['dataentry', 'sales']))
      );
      const employeesData = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate statistics
      const stats = {
        totalClients: allClients.length,
        sold: allClients.filter(c => c.status === 'sold').length,
        postponed: allClients.filter(c => c.status === 'postponed').length,
        rejected: allClients.filter(c => c.status === 'rejected').length,
        waitingOffer: allClients.filter(c => c.status === 'waitingOffer').length,
        totalProfit: allClients
          .filter(c => c.status === 'sold' && c.profit)
          .reduce((sum, c) => sum + (parseFloat(c.profit) || 0), 0)
      };
      setStatistics(stats);

      // Calculate employee statistics
      const employeesWithStats = await Promise.all(
        employeesData.map(async (emp) => {
          const empClients = allClients.filter(c => c.assignedTo === emp.id);
          const soldCount = empClients.filter(c => c.status === 'sold').length;
          const profits = empClients
            .filter(c => c.status === 'sold' && c.profit)
            .map(c => parseFloat(c.profit) || 0);
          const totalProfit = profits.reduce((sum, p) => sum + p, 0);
          const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0;

          return {
            ...emp,
            assignedClients: empClients.length,
            sold: soldCount,
            postponed: empClients.filter(c => c.status === 'postponed').length,
            rejected: empClients.filter(c => c.status === 'rejected').length,
            waitingOffer: empClients.filter(c => c.status === 'waitingOffer').length,
            followUp: empClients.filter(c => c.status === 'followUp').length,
            totalProfit: totalProfit,
            avgProfit: avgProfit
          };
        })
      );

      setEmployees(employeesWithStats);

      // تقسيم العملاء إلى مسندين وغير مسندين
      const assigned = allClients.filter(c => c.assignedTo && c.assignedTo !== null);
      const unassigned = allClients.filter(c => !c.assignedTo || c.assignedTo === null);

      // إضافة اسم الموظف لكل عميل مسند
      const assignedWithEmployeeNames = await Promise.all(
        assigned.map(async (client) => {
          if (client.assignedTo) {
            const empDoc = await getDoc(doc(db, 'users', client.assignedTo));
            const empData = empDoc.exists() ? empDoc.data() : null;
            return {
              ...client,
              employeeName: empData?.name || empData?.email || 'غير معروف'
            };
          }
          return client;
        })
      );

      setAssignedClients(assignedWithEmployeeNames);
      setUnassignedClients(unassigned);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  }

  async function assignClient(clientId, employeeId) {
    try {
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, {
        assignedTo: employeeId,
        assignedAt: new Date().toISOString()
      });
      
      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error assigning client:', error);
      alert('فشل تعيين العميل');
    }
  }

  async function assignMultipleClients() {
    if (!selectedEmployee || selectedClients.size === 0) {
      alert('يرجى اختيار موظف وعملاء');
      return;
    }

    setAssigning(true);
    try {
      const batch = writeBatch(db);
      
      selectedClients.forEach(clientId => {
        const clientRef = doc(db, 'clients', clientId);
        batch.update(clientRef, {
          assignedTo: selectedEmployee,
          assignedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      
      setSelectedClients(new Set());
      setSelectedEmployee('');
      
      // Refresh data
      await fetchData();
      alert('تم تعيين العملاء بنجاح');
    } catch (error) {
      console.error('Error assigning clients:', error);
      alert('فشل تعيين العملاء');
    } finally {
      setAssigning(false);
    }
  }

  function handleClientSelect(clientId) {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  }

  function handleSelectAll() {
    if (selectedClients.size === unassignedClients.length && unassignedClients.length > 0) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(unassignedClients.map(c => c.id)));
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">لوحة تحكم المدير</h1>
            <div className="flex gap-4 items-center">
              <Link
                to="/manager/add-employee"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                إضافة موظف
              </Link>
              <button
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700 px-4 py-2"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard title="إجمالي العملاء" value={statistics.totalClients} color="blue" />
          <StatCard title="تم البيع" value={statistics.sold} color="green" />
          <StatCard title="مؤجل" value={statistics.postponed} color="yellow" />
          <StatCard title="رفض" value={statistics.rejected} color="red" />
          <StatCard title="في انتظار العرض" value={statistics.waitingOffer} color="purple" />
          <StatCard title="إجمالي الأرباح" value={`${statistics.totalProfit.toFixed(2)} ج.م`} color="indigo" />
        </div>

        {/* Employees Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">إحصائيات الموظفين</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الموظف
                  </th>
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    عدد العملاء المخصصين
                  </th>
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    تم البيع
                  </th>
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    مؤجل
                  </th>
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    رفض
                  </th>
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    في انتظار العرض
                  </th>
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    متابعة
                  </th>
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    إجمالي الأرباح
                  </th>
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    متوسط الربح
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                      لا يوجد موظفين مسجلين
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.name || employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.assignedClients}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.sold}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.postponed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.rejected}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.waitingOffer}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.followUp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.totalProfit.toFixed(2)} ج.م
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.avgProfit.toFixed(2)} ج.م
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unassigned Clients Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden mt-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              العملاء غير المسندين ({unassignedClients.length})
            </h2>
            {unassignedClients.length > 0 && (
              <div className="flex gap-4 items-center">
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">اختر موظف للتعيين الجماعي</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.email} ({emp.role === 'dataentry' ? 'Data Entry' : 'Sales'})
                    </option>
                  ))}
                </select>
                {selectedClients.size > 0 && selectedEmployee && (
                  <button
                    onClick={assignMultipleClients}
                    disabled={assigning}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {assigning ? 'جاري التعيين...' : `تعيين ${selectedClients.size} عميل`}
                  </button>
                )}
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {selectedClients.size === unassignedClients.length && unassignedClients.length > 0 
                    ? 'إلغاء تحديد الكل' 
                    : 'تحديد الكل'}
                </button>
              </div>
            )}
          </div>
          {unassignedClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              لا يوجد عملاء غير مسندين
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedClients.size === unassignedClients.length && unassignedClients.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      الصورة
                    </th>
                    <th className="py-3 text-xs font-medium text-gray-500 uppercase">
                      اسم العميل
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      رقم الواتساب
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      المصدر
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      تاريخ السفر
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      إجراء
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {unassignedClients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedClients.has(client.id)}
                          onChange={() => handleClientSelect(client.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              assignClient(client.id, e.target.value);
                            }
                          }}
                          className="px-3 py-1 border border-gray-300 rounded"
                          defaultValue=""
                        >
                          <option value="">اختر موظف</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name || emp.email}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Assigned Clients Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden mt-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              العملاء المسندين ({assignedClients.length})
            </h2>
          </div>
          {assignedClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              لا يوجد عملاء مسندين
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      الصورة
                    </th>
                    <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      اسم العميل
                    </th>
                    <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      رقم الواتساب
                    </th>
                    <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      المصدر
                    </th>
                    <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      تاريخ السفر
                    </th>
                    <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      المسند إلى
                    </th>
                    <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      الحالة
                    </th>
                    <th className="text-start px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      الربح
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignedClients.map((client) => (
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
                        {client.travelDate || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.employeeName || '-'}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.profit ? `${client.profit} ج.م` : '-'}
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
