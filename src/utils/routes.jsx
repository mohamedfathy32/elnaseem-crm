import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import Login from '../pages/Login';
import Unauthorized from '../pages/Unauthorized';
import ManagerDashboard from '../pages/manager/ManagerDashboard';
import AddEmployee from '../pages/manager/AddEmployee';
import UnassignedClients from '../pages/manager/UnassignedClients';
import EmployeeDetails from '../pages/manager/EmployeeDetails';
import DataEntryDashboard from '../pages/dataentry/DataEntryDashboard';
import AddClient from '../pages/dataentry/AddClient';
import SalesDashboard from '../pages/sales/SalesDashboard';
import ClientDetails from '../pages/ClientDetails';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/unauthorized',
    element: <Unauthorized />
  },
  {
    path: '/manager/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['manager']}>
        <ManagerDashboard />
      </ProtectedRoute>
    )
  },
  {
    path: '/manager/add-employee',
    element: (
      <ProtectedRoute allowedRoles={['manager']}>
        <AddEmployee />
      </ProtectedRoute>
    )
  },
  {
    path: '/manager/unassigned-clients',
    element: (
      <ProtectedRoute allowedRoles={['manager']}>
        <UnassignedClients />
      </ProtectedRoute>
    )
  },
  {
    path: '/manager/employee/:id',
    element: (
      <ProtectedRoute allowedRoles={['manager']}>
        <EmployeeDetails />
      </ProtectedRoute>
    )
  },
  {
    path: '/dataentry/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['dataentry']}>
        <DataEntryDashboard />
      </ProtectedRoute>
    )
  },
  {
    path: '/dataentry/add-client',
    element: (
      <ProtectedRoute allowedRoles={['dataentry']}>
        <AddClient />
      </ProtectedRoute>
    )
  },
  {
    path: '/sales/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['sales']}>
        <SalesDashboard />
      </ProtectedRoute>
    )
  },
  {
    path: '/client/:id',
    element: (
      <ProtectedRoute allowedRoles={['manager', 'dataentry', 'sales']}>
        <ClientDetails />
      </ProtectedRoute>
    )
  },
  {
    path: '/',
    element: <Navigate to="/login" replace />
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />
  }
]);
