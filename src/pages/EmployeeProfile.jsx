import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function EmployeeProfile() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [employeeClients, setEmployeeClients] = useState([]);
  const [statistics, setStatistics] = useState({
    totalClients: 0,
    sold: 0,
    monthlyProfit: 0,
    totalProfit: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchEmployeeData();
    }
  }, [currentUser]);

  async function fetchEmployeeData() {
    try {
      // Get employee data
      const empDoc = await getDoc(doc(db, 'users', currentUser.uid));
      
      if (!empDoc.exists()) {
        setLoading(false);
        return;
      }

      const empData = { id: empDoc.id, ...empDoc.data() };
      setEmployee(empData);

      // Get employee clients
      const clientsQuery = query(
        collection(db, 'clients'),
        where('assignedTo', '==', currentUser.uid)
      );
      const clientsSnapshot = await getDocs(clientsQuery);
      const clients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate monthly statistics
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

      setStatistics({
        totalClients: clients.length,
        sold: sold.length,
        monthlyProfit: monthlyProfit,
        totalProfit: totalProfit
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching employee data:', error);
      setLoading(false);
    }
  }

  function calculateCommission(profit) {
    if (profit < 5000) return 0;
    if (profit < 10000) return profit * 0.05;
    if (profit < 15000) return profit * 0.10;
    if (profit < 20000) return profit * 0.15;
    if (profit < 25000) return profit * 0.20;
    return profit * 0.25; // فوق 25000
  }

  function getBackPath() {
    if (userRole === 'sales') return '/sales/dashboard';
    if (userRole === 'dataentry') return '/dataentry/dashboard';
    return '/login';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">جاري التحميل...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-xl text-red-600 mb-4">خطأ في تحميل البيانات</p>
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

  const commission = calculateCommission(statistics.monthlyProfit);
  const totalSalary = (employee.salary || 0) + commission;
  const maxValue = 30000;
  const milestones = [5000, 10000, 15000, 20000, 25000];
  const currentPosition = Math.min((statistics.monthlyProfit / maxValue) * 100, 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">ملفي الشخصي</h1>
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
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">معلوماتي الشخصية</h2>
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
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard title="إجمالي العملاء" value={statistics.totalClients} color="blue" />
          <StatCard title="تم البيع" value={statistics.sold} color="green" />
          <StatCard title="ربح هذا الشهر" value={`${statistics.monthlyProfit.toFixed(2)} ج.م`} color="indigo" />
        </div>

        {/* Salary and Commission Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">الراتب والكوميشن (هذا الشهر)</h2>
          </div>
          <div className="px-6 py-6">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">الأرباح الشهرية</span>
                <span className="text-lg font-bold text-gray-900">{statistics.monthlyProfit.toFixed(2)} ج.م</span>
              </div>
              
              <div className="relative h-12 bg-gray-200 rounded-lg overflow-hidden">
                {/* Progress fill */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                  style={{ width: `${currentPosition}%` }}
                />
                
                {/* Milestone markers */}
                {milestones.map((milestone) => {
                  const position = (milestone / maxValue) * 100;
                  return (
                    <div
                      key={milestone}
                      className="absolute top-0 h-full w-0.5 bg-gray-600 z-10"
                      style={{ left: `${position}%` }}
                    >
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 font-medium whitespace-nowrap">
                        {milestone.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
                
                {/* Current position indicator */}
                {statistics.monthlyProfit > 0 && (
                  <div
                    className="absolute top-0 h-full w-1 bg-red-600 z-20 shadow-lg"
                    style={{ left: `${currentPosition}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap font-bold">
                      {statistics.monthlyProfit.toFixed(2)} ج.م
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Salary and Commission Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-700 mb-1">الراتب الثابت</div>
                <div className="text-2xl font-bold text-blue-900">
                  {employee.salary ? `${parseFloat(employee.salary).toFixed(2)} ج.م` : 'غير محدد'}
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm font-medium text-green-700 mb-1">الكوميشن</div>
                <div className="text-2xl font-bold text-green-900">
                  {commission.toFixed(2)} ج.م
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {statistics.monthlyProfit < 5000 ? '0%' :
                   statistics.monthlyProfit < 10000 ? '5%' :
                   statistics.monthlyProfit < 15000 ? '10%' :
                   statistics.monthlyProfit < 20000 ? '15%' :
                   statistics.monthlyProfit < 25000 ? '20%' : '25%'}
                </div>
              </div>
              
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="text-sm font-medium text-indigo-700 mb-1">إجمالي الراتب</div>
                <div className="text-2xl font-bold text-indigo-900">
                  {totalSalary.toFixed(2)} ج.م
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Profit Details */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">تفاصيل الأرباح الشهرية</h2>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">إجمالي الأرباح (هذا الشهر)</span>
                <span className="font-bold text-lg">{statistics.monthlyProfit.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">نسبة الكوميشن</span>
                <span className="font-semibold">
                  {statistics.monthlyProfit < 5000 ? '0%' :
                   statistics.monthlyProfit < 10000 ? '5%' :
                   statistics.monthlyProfit < 15000 ? '10%' :
                   statistics.monthlyProfit < 20000 ? '15%' :
                   statistics.monthlyProfit < 25000 ? '20%' : '25%'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">قيمة الكوميشن</span>
                <span className="font-bold text-green-600">{commission.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">الراتب الثابت</span>
                <span className="font-semibold">
                  {employee.salary ? `${parseFloat(employee.salary).toFixed(2)} ج.م` : 'غير محدد'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700 font-bold">إجمالي الراتب الشهري</span>
                <span className="font-bold text-2xl text-indigo-600">{totalSalary.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>
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
