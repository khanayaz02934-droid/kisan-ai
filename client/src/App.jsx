import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AdminLayout from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Scan from './pages/Scan';
import Chat from './pages/Chat';
import Store from './pages/Store';
import ProductDetail from './pages/ProductDetail';
import Mandi from './pages/Mandi';
import Grain from './pages/Grain';
import GrainDetail from './pages/GrainDetail';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Placeholder from './pages/Placeholder';
import { useSelector } from 'react-redux';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminOrders from './pages/admin/Orders';
import AdminScans from './pages/admin/Scans';
import AdminProducts from './pages/admin/Products';
import AdminGrains from './pages/admin/Grains';
import AdminMandi from './pages/admin/Mandi';
import AdminSettings from './pages/admin/Settings';

/**
 * Compatibility redirect for the legacy "/auth/admin" style URLs that get
 * typed or bookmarked by hand. There is no page at /auth/* — admins belong
 * at /admin (the dashboard) and everyone else at the login page, so these
 * links must never land on the 404 placeholder.
 */
function LegacyAuthRedirect() {
  const user = useSelector((s) => s.auth.user);
  // Role is backend-defined ('ADMIN') but normalised so any case variant
  // ('admin', 'Admin') stored in older documents still routes correctly.
  const isAdmin = String(user?.userType || '').toUpperCase() === 'ADMIN';
  return <Navigate to={isAdmin ? '/admin' : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route
            path="scan"
            element={
              <ProtectedRoute>
                <Scan />
              </ProtectedRoute>
            }
          />
          <Route
            path="chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route path="store" element={<Store />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="mandi" element={<Mandi />} />
          <Route path="grain" element={<Grain />} />
          <Route path="grain/:id" element={<GrainDetail />} />
          <Route
            path="cart"
            element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Placeholder title="404" />} />
        </Route>

        {/* /auth/admin (and any /auth/x) → real admin dashboard or login */}
        <Route path="/auth/*" element={<LegacyAuthRedirect />} />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          {/* /admin/dashboard is an explicit alias of the index dashboard,
              so post-login navigation to that exact URL renders the page
              without changing the address bar. */}
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="scans" element={<AdminScans />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="grains" element={<AdminGrains />} />
          <Route path="mandi" element={<AdminMandi />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
