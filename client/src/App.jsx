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
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminOrders from './pages/admin/Orders';
import AdminScans from './pages/admin/Scans';
import AdminProducts from './pages/admin/Products';
import AdminGrains from './pages/admin/Grains';
import AdminMandi from './pages/admin/Mandi';

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

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="scans" element={<AdminScans />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="grains" element={<AdminGrains />} />
          <Route path="mandi" element={<AdminMandi />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
