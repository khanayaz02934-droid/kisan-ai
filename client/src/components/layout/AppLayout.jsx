import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import Footer from './Footer';
import { cartService } from '../../services';
import { setCartCount } from '../../redux/slices/cartSlice';

export default function AppLayout() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((s) => s.auth);

  // Refresh the cart badge whenever auth state changes (login/logout/refresh).
  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(setCartCount(0));
      return;
    }
    let cancelled = false;
    cartService
      .get()
      .then((cart) => {
        if (!cancelled) dispatch(setCartCount(cart?.itemCount ?? 0));
      })
      .catch(() => {
        /* silent — cart badge is best-effort on load */
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, dispatch]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="container-page flex-1 py-5 pb-24 sm:py-8 md:pb-8">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
