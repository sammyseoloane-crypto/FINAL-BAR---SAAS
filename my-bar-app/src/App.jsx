import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import ProtectedRoute from './components/ProtectedRoute'

// Auth pages
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Dashboard pages
import Dashboard from './pages/Dashboard'

// Owner/Admin pages
import SubscriptionPage from './pages/owner/SubscriptionPage'
import LocationsPage from './pages/owner/LocationsPage'
import EventsPage from './pages/owner/EventsPage'
import StaffPage from './pages/owner/StaffPage'
import TasksPage from './pages/owner/TasksPage'
import ReportsPage from './pages/owner/ReportsPage'
import ManageProductsPage from './pages/owner/ManageProductsPage'
import TransactionsPage from './pages/owner/TransactionsPage'
import EmailLogsPage from './pages/owner/EmailLogsPage'

// Staff pages
import MyTasksPage from './pages/staff/MyTasksPage'
import QRScannerPage from './pages/staff/QRScannerPage'
import PaymentConfirmationPage from './pages/staff/PaymentConfirmationPage'
import PaymentsPage from './pages/staff/PaymentsPage'

// Customer pages
import EventsListPage from './pages/customer/EventsListPage'
import ProductsPage from './pages/customer/ProductsPage'
import MyPurchasesPage from './pages/customer/MyPurchasesPage'
import ProfilePage from './pages/customer/ProfilePage'
import MenuPage from './pages/customer/MenuPage'
import OrdersPage from './pages/customer/OrdersPage'
import QRCodesPage from './pages/customer/QRCodesPage'

import './style.css'

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/auth/login" replace />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Owner/Admin routes */}
          <Route
            path="/owner/subscription"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <SubscriptionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/locations"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <LocationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/events"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <EventsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/staff"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/tasks"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <TasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/products"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <ManageProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/transactions"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <TransactionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/reports"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/email-logs"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <EmailLogsPage />
              </ProtectedRoute>
            }
          />

          {/* Staff routes */}
          <Route
            path="/staff/tasks"
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <MyTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/scanner"
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <QRScannerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/payments"
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />

          {/* Customer routes */}
          <Route
            path="/customer/events"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <EventsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/products"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/menu"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <MenuPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/purchases"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <MyPurchasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/orders"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/qrcodes"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <QRCodesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/profile"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Router>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
