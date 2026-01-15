import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch, getDoc, setDoc } from 'firebase/firestore';
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
  const [exchangeRates, setExchangeRates] = useState({
    buyRate: 0, // معامل الشراء
    sellRate: 0  // معامل البيع
  });
  const [editingRates, setEditingRates] = useState({
    buyRate: false,
    sellRate: false
  });
  const [tempRates, setTempRates] = useState({
    buyRate: 0,
    sellRate: 0
  });

  // Filters
  const [employeeFilters, setEmployeeFilters] = useState({
    search: '',
    role: '',
    status: '' // 'active' or 'disabled'
  });
  const [clientFilters, setClientFilters] = useState({
    search: '',
    status: '',
    employee: '',
    dateFrom: '',
    dateTo: ''
  });
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [filteredAssignedClients, setFilteredAssignedClients] = useState([]);
  const [filteredUnassignedClients, setFilteredUnassignedClients] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyEmployeeFilters();
  }, [employees, employeeFilters]);

  useEffect(() => {
    applyClientFilters();
  }, [assignedClients, unassignedClients, clientFilters]);

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
          setTempRates({
            buyRate: ratesData.buyRate || 0,
            sellRate: ratesData.sellRate || 0
          });
        } else {
          // Initialize default rates if not exist
          const defaultRates = { buyRate: 0, sellRate: 0 };
          await setDoc(doc(db, 'settings', 'exchangeRates'), defaultRates);
          setExchangeRates(defaultRates);
          setTempRates(defaultRates);
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
      }

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
    if (selectedClients.size === filteredUnassignedClients.length && filteredUnassignedClients.length > 0) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredUnassignedClients.map(c => c.id)));
    }
  }

  function applyEmployeeFilters() {
    let filtered = [...employees];

    // Search filter
    if (employeeFilters.search) {
      const searchLower = employeeFilters.search.toLowerCase();
      filtered = filtered.filter(emp =>
        (emp.name || '').toLowerCase().includes(searchLower) ||
        (emp.email || '').toLowerCase().includes(searchLower)
      );
    }

    // Role filter
    if (employeeFilters.role) {
      filtered = filtered.filter(emp => emp.role === employeeFilters.role);
    }

    // Status filter
    if (employeeFilters.status) {
      if (employeeFilters.status === 'active') {
        filtered = filtered.filter(emp => !emp.disabled);
      } else if (employeeFilters.status === 'disabled') {
        filtered = filtered.filter(emp => emp.disabled);
      }
    }

    setFilteredEmployees(filtered);
  }

  function applyClientFilters() {
    // Filter assigned clients
    let filteredAssigned = [...assignedClients];

    if (clientFilters.search) {
      const searchLower = clientFilters.search.toLowerCase();
      filteredAssigned = filteredAssigned.filter(client =>
        (client.clientName || '').toLowerCase().includes(searchLower) ||
        (client.whatsappNumber || '').includes(searchLower)
      );
    }

    if (clientFilters.status) {
      filteredAssigned = filteredAssigned.filter(client => client.status === clientFilters.status);
    }

    if (clientFilters.employee) {
      filteredAssigned = filteredAssigned.filter(client => client.assignedTo === clientFilters.employee);
    }

    if (clientFilters.dateFrom) {
      const fromDate = new Date(clientFilters.dateFrom);
      filteredAssigned = filteredAssigned.filter(client => {
        if (!client.travelDate) return false;
        const travelDate = new Date(client.travelDate);
        return travelDate >= fromDate;
      });
    }

    if (clientFilters.dateTo) {
      const toDate = new Date(clientFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filteredAssigned = filteredAssigned.filter(client => {
        if (!client.travelDate) return false;
        const travelDate = new Date(client.travelDate);
        return travelDate <= toDate;
      });
    }

    setFilteredAssignedClients(filteredAssigned);

    // Filter unassigned clients (similar logic but simpler)
    let filteredUnassigned = [...unassignedClients];

    if (clientFilters.search) {
      const searchLower = clientFilters.search.toLowerCase();
      filteredUnassigned = filteredUnassigned.filter(client =>
        (client.clientName || '').toLowerCase().includes(searchLower) ||
        (client.whatsappNumber || '').includes(searchLower)
      );
    }

    if (clientFilters.status) {
      filteredUnassigned = filteredUnassigned.filter(client => client.status === clientFilters.status);
    }

    if (clientFilters.dateFrom) {
      const fromDate = new Date(clientFilters.dateFrom);
      filteredUnassigned = filteredUnassigned.filter(client => {
        if (!client.travelDate) return false;
        const travelDate = new Date(client.travelDate);
        return travelDate >= fromDate;
      });
    }

    if (clientFilters.dateTo) {
      const toDate = new Date(clientFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filteredUnassigned = filteredUnassigned.filter(client => {
        if (!client.travelDate) return false;
        const travelDate = new Date(client.travelDate);
        return travelDate <= toDate;
      });
    }

    setFilteredUnassignedClients(filteredUnassigned);
  }

  function handleEditRate(rateType) {
    setEditingRates({ ...editingRates, [rateType]: true });
    setTempRates({ ...tempRates, [rateType]: exchangeRates[rateType] });
  }

  function handleCancelEdit(rateType) {
    setEditingRates({ ...editingRates, [rateType]: false });
    setTempRates({ ...tempRates, [rateType]: exchangeRates[rateType] });
  }

  async function handleSaveRate(rateType) {
    try {
      const newRate = parseFloat(tempRates[rateType]);
      if (isNaN(newRate) || newRate < 0) {
        alert('يرجى إدخال قيمة صحيحة');
        return;
      }

      await setDoc(doc(db, 'settings', 'exchangeRates'), {
        ...exchangeRates,
        [rateType]: newRate,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setExchangeRates({ ...exchangeRates, [rateType]: newRate });
      setEditingRates({ ...editingRates, [rateType]: false });
    } catch (error) {
      console.error('Error saving exchange rate:', error);
      alert('فشل حفظ المعامل');
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
        {/* Exchange Rates Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <ExchangeRateCard
            title="معامل الشراء"
            subtitle="سعر الريال مقابل الجنيه (للشراء)"
            rate={exchangeRates.buyRate}
            isEditing={editingRates.buyRate}
            tempRate={tempRates.buyRate}
            onEdit={() => handleEditRate('buyRate')}
            onCancel={() => handleCancelEdit('buyRate')}
            onSave={() => handleSaveRate('buyRate')}
            onRateChange={(value) => setTempRates({ ...tempRates, buyRate: value })}
            color="green"
          />
          <ExchangeRateCard
            title="معامل البيع"
            subtitle="سعر الريال مقابل الجنيه (للبيع)"
            rate={exchangeRates.sellRate}
            isEditing={editingRates.sellRate}
            tempRate={tempRates.sellRate}
            onEdit={() => handleEditRate('sellRate')}
            onCancel={() => handleCancelEdit('sellRate')}
            onSave={() => handleSaveRate('sellRate')}
            onRateChange={(value) => setTempRates({ ...tempRates, sellRate: value })}
            color="blue"
          />
        </div>

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
                  <th className="text-start px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-4 text-center text-gray-500">
                      {employees.length === 0 ? 'لا يوجد موظفين مسجلين' : 'لا توجد نتائج تطابق الفلاتر'}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <Link
                          to={`/manager/employee/${employee.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {employee.name || employee.email}
                        </Link>
                        {employee.disabled && (
                          <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">معطل</span>
                        )}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/manager/employee/${employee.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          التفاصيل
                        </Link>
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
              العملاء غير المسندين ({filteredUnassignedClients.length})
            </h2>
            {filteredUnassignedClients.length > 0 && (
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
                  {selectedClients.size === filteredUnassignedClients.length && filteredUnassignedClients.length > 0 
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
                        checked={selectedClients.size === filteredUnassignedClients.length && filteredUnassignedClients.length > 0}
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
                  {filteredUnassignedClients.map((client) => (
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
              العملاء المسندين ({filteredAssignedClients.length})
            </h2>
          </div>
          {/* Client Filters for Assigned */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البحث</label>
                <input
                  type="text"
                  value={clientFilters.search}
                  onChange={(e) => setClientFilters({ ...clientFilters, search: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="اسم أو رقم العميل"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <select
                  value={clientFilters.status}
                  onChange={(e) => setClientFilters({ ...clientFilters, status: e.target.value })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">الموظف</label>
                <select
                  value={clientFilters.employee}
                  onChange={(e) => setClientFilters({ ...clientFilters, employee: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">جميع الموظفين</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ من</label>
                <input
                  type="date"
                  value={clientFilters.dateFrom}
                  onChange={(e) => setClientFilters({ ...clientFilters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ إلى</label>
                <input
                  type="date"
                  value={clientFilters.dateTo}
                  onChange={(e) => setClientFilters({ ...clientFilters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          {filteredAssignedClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {assignedClients.length === 0 ? 'لا يوجد عملاء مسندين' : 'لا توجد نتائج تطابق الفلاتر'}
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
                  {filteredAssignedClients.map((client) => (
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

function ExchangeRateCard({ title, subtitle, rate, isEditing, tempRate, onEdit, onCancel, onSave, onRateChange, color }) {
  const colorClasses = {
    green: 'bg-green-50 border-green-300',
    blue: 'bg-blue-50 border-blue-300'
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClasses[color]} shadow-sm`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </div>
        {!isEditing && (
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            تعديل
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={tempRate}
              onChange={(e) => onRateChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-2xl font-bold"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              حفظ
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="text-3xl font-bold text-gray-800">
          {rate.toFixed(2)} ج.م
        </div>
      )}
    </div>
  );
}
