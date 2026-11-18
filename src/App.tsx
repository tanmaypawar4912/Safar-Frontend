import type { ReactNode } from "react";
import { Route, Routes } from "react-router";

import Home from "./pages/public/Home";
import PublicBooking from "./pages/public/PublicBooking";
import Business from "./pages/public/Business";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

import CustomerDashboard from "./pages/customer/CustomerDashboard";
import CustomerProfile from "./pages/customer/CustomerProfile";
import BookDelivery from "./pages/customer/BookDelivery";
import MyOrders from "./pages/customer/MyOrders";
import BookingDetails from "./pages/customer/BookingDetails";
import CustomerReviews from "./pages/customer/CustomerReviews";
import CustomerComplaints from "./pages/customer/CustomerComplaints";

import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverProfile from "./pages/driver/DriverProfile";
import DriverVerification from "./pages/driver/DriverVerification";
import DriverJobs from "./pages/driver/DriverJobs";
import DriverVehicleDetails from "./pages/driver/DriverVehicleDetails";
import DriverDocuments from "./pages/driver/DriverDocuments";
import DriverReviews from "./pages/driver/DriverReviews";
import DriverCompleted from "./pages/driver/DriverCompleted";
import DriverEarning from "./pages/driver/DriverEarning";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDriverApprovals from "./pages/admin/AdminDriverApprovals";
import AdminDriverActivity from "./pages/admin/AdminDriverActivity";
import AdminDrivers from "./pages/admin/AdminDrivers";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminVehicles from "./pages/admin/AdminVehicles";
import AdminPricing from "./pages/admin/AdminPricing";
import AdminComplaints from "./pages/admin/AdminComplaints";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminEnterpriseEnquiries from "./pages/admin/AdminEnterpriseEnquiries";
import AdminPayments from "./pages/admin/AdminPayments";

import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import ScrollToTop from "./components/routing/ScrollToTop";

type WorkspaceRole = "customer" | "driver" | "admin";

function WorkspaceRoute({
  role,
  children,
}: {
  role: WorkspaceRole;
  children: ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={[role]}>
      <DashboardLayout role={role}>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<PublicBooking />} />
      <Route path="/business" element={<Business />} />

      {/* Authentication routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Customer workspace */}
      <Route
        path="/customer"
        element={<WorkspaceRoute role="customer"><CustomerDashboard /></WorkspaceRoute>}
      />
      <Route
        path="/customer/profile"
        element={<WorkspaceRoute role="customer"><CustomerProfile /></WorkspaceRoute>}
      />
      <Route
        path="/customer/book"
        element={<WorkspaceRoute role="customer"><BookDelivery /></WorkspaceRoute>}
      />
      <Route
        path="/customer/orders"
        element={<WorkspaceRoute role="customer"><MyOrders /></WorkspaceRoute>}
      />
      <Route
        path="/customer/orders/:id"
        element={<WorkspaceRoute role="customer"><BookingDetails /></WorkspaceRoute>}
      />
      <Route
        path="/customer/reviews"
        element={<WorkspaceRoute role="customer"><CustomerReviews /></WorkspaceRoute>}
      />
      <Route
        path="/customer/complaints"
        element={<WorkspaceRoute role="customer"><CustomerComplaints /></WorkspaceRoute>}
      />

      {/* Driver workspace */}
      <Route
        path="/driver"
        element={<WorkspaceRoute role="driver"><DriverDashboard /></WorkspaceRoute>}
      />
      <Route
        path="/driver/jobs"
        element={<WorkspaceRoute role="driver"><DriverJobs /></WorkspaceRoute>}
      />
      <Route
        path="/driver/profile"
        element={<WorkspaceRoute role="driver"><DriverProfile /></WorkspaceRoute>}
      />
      <Route
        path="/driver/verification"
        element={<WorkspaceRoute role="driver"><DriverVerification /></WorkspaceRoute>}
      />
      <Route
        path="/driver/reviews"
        element={<WorkspaceRoute role="driver"><DriverReviews /></WorkspaceRoute>}
      />
      <Route
        path="/driver/completed"
        element={<WorkspaceRoute role="driver"><DriverCompleted /></WorkspaceRoute>}
      />
      <Route
        path="/driver/earnings"
        element={<WorkspaceRoute role="driver"><DriverEarning /></WorkspaceRoute>}
      />
      <Route
        path="/driver/vehicles"
        element={<WorkspaceRoute role="driver"><DriverVehicleDetails /></WorkspaceRoute>}
      />
      <Route
        path="/driver/documents"
        element={<WorkspaceRoute role="driver"><DriverDocuments /></WorkspaceRoute>}
      />

      {/* Admin workspace */}
      <Route
        path="/admin"
        element={<WorkspaceRoute role="admin"><AdminDashboard /></WorkspaceRoute>}
      />
      <Route
        path="/admin/bookings"
        element={<WorkspaceRoute role="admin"><AdminBookings /></WorkspaceRoute>}
      />
      <Route
        path="/admin/customers"
        element={<WorkspaceRoute role="admin"><AdminCustomers /></WorkspaceRoute>}
      />
      <Route
        path="/admin/drivers"
        element={<WorkspaceRoute role="admin"><AdminDrivers /></WorkspaceRoute>}
      />
      <Route
        path="/admin/driver-approvals"
        element={<WorkspaceRoute role="admin"><AdminDriverApprovals /></WorkspaceRoute>}
      />
      <Route
        path="/admin/driver-activity"
        element={<WorkspaceRoute role="admin"><AdminDriverActivity /></WorkspaceRoute>}
      />
      <Route
        path="/admin/vehicles"
        element={<WorkspaceRoute role="admin"><AdminVehicles /></WorkspaceRoute>}
      />
      <Route
        path="/admin/pricing"
        element={<WorkspaceRoute role="admin"><AdminPricing /></WorkspaceRoute>}
      />
      <Route
        path="/admin/payments"
        element={<WorkspaceRoute role="admin"><AdminPayments /></WorkspaceRoute>}
      />
      <Route
        path="/admin/complaints"
        element={<WorkspaceRoute role="admin"><AdminComplaints /></WorkspaceRoute>}
      />
      <Route
        path="/admin/reviews"
        element={<WorkspaceRoute role="admin"><AdminReviews /></WorkspaceRoute>}
      />
      <Route
        path="/admin/settings"
        element={<WorkspaceRoute role="admin"><AdminSettings /></WorkspaceRoute>}
      />
      <Route
        path="/admin/enterprise-enquiries"
        element={<WorkspaceRoute role="admin"><AdminEnterpriseEnquiries /></WorkspaceRoute>}
      />

      {/* Fallback */}
      <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;