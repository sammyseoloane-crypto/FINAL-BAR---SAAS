import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { AddOnsProvider } from './contexts/AddOnsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import CookieConsent from './components/CookieConsent';
import ErrorReportButton from './components/ErrorReportButton';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Legal pages
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';

// Pricing page
import PricingPage from './pages/PricingPage';

// Add-ons page
import AddOnsPage from './pages/AddOnsPage';

// Support and Onboarding
import HelpCenter from './components/HelpCenter';
import OnboardingWizard from './components/OnboardingWizard';
import SupportPanel from './pages/SupportPanel';

// Dashboard pages
import Dashboard from './pages/Dashboard';

// Owner/Admin pages
import SubscriptionPage from './pages/owner/SubscriptionPage';
import LocationsPage from './pages/owner/LocationsPage';
import EventsPage from './pages/owner/EventsPage';
import StaffPage from './pages/owner/StaffPage';
import TasksPage from './pages/owner/TasksPage';
import ReportsPage from './pages/owner/ReportsPage';
import ManageProductsPage from './pages/owner/ManageProductsPage';
import TransactionsPage from './pages/owner/TransactionsPage';
import EmailLogsPage from './pages/owner/EmailLogsPage';
import SystemOverviewPage from './pages/owner/SystemOverviewPage';
import VIPTablesDashboard from './components/VIPTablesDashboard';
import ClubDashboard from './components/ClubDashboard';

// Platform Admin pages
import TenantManagementPage from './pages/platform-admin/TenantManagementPage';
import UserManagementPage from './pages/platform-admin/UserManagementPage';
import PlatformAnalyticsPage from './pages/platform-admin/PlatformAnalyticsPage';
import BillingOverviewPage from './pages/platform-admin/BillingOverviewPage';
import SubscriptionPlansPage from './pages/platform-admin/SubscriptionPlansPage';
import SystemLogsPage from './pages/platform-admin/SystemLogsPage';
import SupportTicketsPage from './pages/platform-admin/SupportTicketsPage';

// Manager pages
import ManagerStaffPage from './pages/manager/StaffPage';
import ManagerReservationsPage from './pages/manager/ReservationsPage';
import ManagerGuestListsPage from './pages/manager/GuestListsPage';
import ManagerPOSMonitoringPage from './pages/manager/POSMonitoringPage';
import ManagerShiftsPage from './pages/manager/ShiftsPage';

// Staff pages
import TableQRCodesPage from './pages/staff/TableQRCodesPage';

// Promoter pages
import PromoterGuestListsPage from './pages/promoter/GuestListsPage';
import PromoterCommissionPage from './pages/promoter/CommissionTrackingPage';
import PromoterEventsPage from './pages/promoter/EventsPage';

// VIP Host pages
import VIPHostTableReservationsPage from './pages/vip-host/TableReservationsPage';
import VIPHostBottleServicePage from './pages/vip-host/BottleServicePage';
import VIPHostVIPGuestsPage from './pages/vip-host/VIPGuestsPage';

// Staff pages
import MyTasksPage from './pages/staff/MyTasksPage';
import QRScannerPage from './pages/staff/QRScannerPage';
import PaymentsPage from './pages/staff/PaymentsPage';

// Customer pages
import EventsListPage from './pages/customer/EventsListPage';
import ProductsPage from './pages/customer/ProductsPage';
import MyPurchasesPage from './pages/customer/MyPurchasesPage';
import ProfilePage from './pages/customer/ProfilePage';
import MenuPage from './pages/customer/MenuPage';
import OrdersPage from './pages/customer/OrdersPage';
import QRCodesPage from './pages/customer/QRCodesPage';
import TableBookingPage from './pages/customer/TableBookingPage';
import LoyaltyPage from './pages/customer/LoyaltyPage';
import CustomerGuestListPage from './pages/customer/GuestListPage';

// Digital Bar Tabs
import OpenTabPage from './pages/OpenTabPage';
import TabStartPage from './pages/TabStartPage';
import CustomerTabView from './components/CustomerTabView';
import BartenderTabManager from './components/BartenderTabManager';

import './style.css';

function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AddOnsProvider>
          <CartProvider>
            <NotificationProvider>
              <Router>
                <CookieConsent />
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Navigate to="/auth/login" replace />} />
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/register" element={<Register />} />
                  <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />

                  {/* Legal pages (public) */}
                  <Route path="/terms-of-service" element={<TermsOfService />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                  {/* Pricing page (public) */}
                  <Route path="/pricing" element={<PricingPage />} />

                  {/* Add-ons page (owner/admin only) */}
                  <Route
                    path="/owner/addons"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <AddOnsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Help center (public) */}
                  <Route path="/help" element={<HelpCenter />} />

                  {/* Digital Bar Tabs (public - QR code landing) */}
                  <Route path="/tab/open" element={<OpenTabPage />} />
                  <Route path="/tab/start/:token" element={<TabStartPage />} />
                  <Route path="/tab/view" element={<CustomerTabView />} />

                  {/* Protected routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Onboarding (authenticated users) */}
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <OnboardingWizard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Platform Admin routes */}
                  <Route
                    path="/platform-admin/tenants"
                    element={
                      <ProtectedRoute allowedRoles={['platform_admin']}>
                        <TenantManagementPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/platform-admin/users"
                    element={
                      <ProtectedRoute allowedRoles={['platform_admin']}>
                        <UserManagementPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/platform-admin/analytics"
                    element={
                      <ProtectedRoute allowedRoles={['platform_admin']}>
                        <PlatformAnalyticsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/platform-admin/billing"
                    element={
                      <ProtectedRoute allowedRoles={['platform_admin']}>
                        <BillingOverviewPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/platform-admin/plans"
                    element={
                      <ProtectedRoute allowedRoles={['platform_admin']}>
                        <SubscriptionPlansPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/platform-admin/logs"
                    element={
                      <ProtectedRoute allowedRoles={['platform_admin']}>
                        <SystemLogsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/platform-admin/support"
                    element={
                      <ProtectedRoute allowedRoles={['platform_admin']}>
                        <SupportTicketsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Owner/Admin routes */}
                  <Route
                    path="/owner/subscription"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <SubscriptionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/locations"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <LocationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/events"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <EventsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/staff"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <StaffPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/tasks"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <TasksPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/products"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <ManageProductsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/transactions"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <TransactionsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/reports"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <ReportsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/email-logs"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <EmailLogsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/system-overview"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <SystemOverviewPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/support"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <SupportPanel />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/vip-tables"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <VIPTablesDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/club-dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['owner', 'admin', 'platform_admin']}>
                        <ClubDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Manager routes */}
                  <Route
                    path="/manager/staff"
                    element={
                      <ProtectedRoute allowedRoles={['manager']}>
                        <ManagerStaffPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/manager/shifts"
                    element={
                      <ProtectedRoute allowedRoles={['manager']}>
                        <ManagerShiftsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/manager/reservations"
                    element={
                      <ProtectedRoute allowedRoles={['manager']}>
                        <ManagerReservationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/manager/guest-lists"
                    element={
                      <ProtectedRoute allowedRoles={['manager']}>
                        <ManagerGuestListsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/manager/pos-monitor"
                    element={
                      <ProtectedRoute allowedRoles={['manager']}>
                        <ManagerPOSMonitoringPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/manager/reports"
                    element={
                      <ProtectedRoute allowedRoles={['manager']}>
                        <ReportsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/manager/events"
                    element={
                      <ProtectedRoute allowedRoles={['manager']}>
                        <EventsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Promoter routes */}
                  <Route
                    path="/promoter/guest-lists"
                    element={
                      <ProtectedRoute allowedRoles={['promoter']}>
                        <PromoterGuestListsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/promoter/commission"
                    element={
                      <ProtectedRoute allowedRoles={['promoter']}>
                        <PromoterCommissionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/promoter/events"
                    element={
                      <ProtectedRoute allowedRoles={['promoter']}>
                        <PromoterEventsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* VIP Host routes */}
                  <Route
                    path="/vip-host/tables"
                    element={
                      <ProtectedRoute allowedRoles={['vip_host']}>
                        <VIPHostTableReservationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/vip-host/bottle-service"
                    element={
                      <ProtectedRoute allowedRoles={['vip_host']}>
                        <VIPHostBottleServicePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/vip-host/guests"
                    element={
                      <ProtectedRoute allowedRoles={['vip_host']}>
                        <VIPHostVIPGuestsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/vip-host/guest-lists"
                    element={
                      <ProtectedRoute allowedRoles={['vip_host']}>
                        <ManagerGuestListsPage />
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
                    path="/staff/guest-lists"
                    element={
                      <ProtectedRoute allowedRoles={['staff']}>
                        <ManagerGuestListsPage />
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
                  <Route
                    path="/staff/tabs"
                    element={
                      <ProtectedRoute allowedRoles={['staff', 'bartender', 'admin']}>
                        <BartenderTabManager />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/staff/qr-codes"
                    element={
                      <ProtectedRoute allowedRoles={['staff', 'manager', 'owner', 'platform_admin']}>
                        <TableQRCodesPage />
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
                  <Route
                    path="/customer/tables"
                    element={
                      <ProtectedRoute allowedRoles={['customer']}>
                        <TableBookingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/loyalty"
                    element={
                      <ProtectedRoute allowedRoles={['customer']}>
                        <LoyaltyPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/guest-lists"
                    element={
                      <ProtectedRoute allowedRoles={['customer']}>
                        <CustomerGuestListPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch all - redirect to login */}
                  <Route path="*" element={<Navigate to="/auth/login" replace />} />
                </Routes>
                <ErrorReportButton />
              </Router>
            </NotificationProvider>
          </CartProvider>
        </AddOnsProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default App;
