import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { Link } from 'react-router-dom';
import { auth } from '../../firebase/firebase';

export default function UnassignedClients() {
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [assignMode, setAssignMode] = useState('single'); // 'single' or 'multiple'
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Get all clients and filter unassigned ones
      // Firestore doesn't support querying null directly, so we fetch all and filter
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const allClients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Filter clients where assignedTo is null or doesn't exist
      const unassignedClients = allClients.filter(client => !client.assignedTo || client.assignedTo === null);
      setClients(unassignedClients);

      // Get all employees (dataentry and sales)
      const employeesQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['dataentry', 'sales'])
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      const employeesData = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmployees(employeesData);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
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
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  }

  async function assignClient(clientId, employeeId) {
    try {
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, {
        assignedTo: employeeId,
        assignedAt: new Date().toISOString()
      });
      
      // Remove from list
      setClients(clients.filter(c => c.id !== clientId));
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
      
      // Remove assigned clients from list
      setClients(clients.filter(c => !selectedClients.has(c.id)));
      setSelectedClients(new Set());
      setSelectedEmployee('');
      alert('تم تعيين العملاء بنجاح');
    } catch (error) {
      console.error('Error assigning clients:', error);
      alert('فشل تعيين العملاء');
    } finally {
      setAssigning(false);
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
            <h1 className="text-2xl font-bold text-gray-800">العملاء غير المسندين</h1>
            <Link
              to="/manager/dashboard"
              className="text-blue-600 hover:text-blue-700 px-4 py-2"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {clients.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-xl text-gray-600">لا يوجد عملاء غير مسندين</p>
          </div>
        ) : (
          <>
            {/* Assignment Mode Selector */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex gap-4 items-center mb-4">
                <label className="text-sm font-medium text-gray-700">وضع التعيين:</label>
                <select
                  value={assignMode}
                  onChange={(e) => {
                    setAssignMode(e.target.value);
                    setSelectedClients(new Set());
                    setSelectedEmployee('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="single">تعيين فردي</option>
                  <option value="multiple">تعيين جماعي</option>
                </select>
              </div>

              {assignMode === 'multiple' && (
                <div className="flex gap-4 items-center">
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg flex-1"
                  >
                    <option value="">اختر موظف</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name || emp.email} ({emp.role === 'dataentry' ? 'Data Entry' : 'Sales'})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={assignMultipleClients}
                    disabled={assigning || !selectedEmployee || selectedClients.size === 0}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assigning ? 'جاري التعيين...' : `تعيين ${selectedClients.size} عميل`}
                  </button>
                </div>
              )}
            </div>

            {/* Clients Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">
                  العملاء ({clients.length})
                </h2>
                {assignMode === 'multiple' && (
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {selectedClients.size === clients.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {assignMode === 'multiple' && (
                        <th className="px-6 py-3 text-right">
                          <input
                            type="checkbox"
                            checked={selectedClients.size === clients.length && clients.length > 0}
                            onChange={handleSelectAll}
                            className="rounded border-gray-300"
                          />
                        </th>
                      )}
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
                        مطار الانطلاق
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        مطار الوصول
                      </th>
                      {assignMode === 'single' && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          إجراء
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-gray-50">
                        {assignMode === 'multiple' && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedClients.has(client.id)}
                              onChange={() => handleClientSelect(client.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {client.clientName}
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
                          {client.departureAirport || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {client.arrivalAirport || '-'}
                        </td>
                        {assignMode === 'single' && (
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
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
