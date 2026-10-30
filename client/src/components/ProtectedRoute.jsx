import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { authService } from '../services';
import { setUser } from '../redux/slices/authSlice';
import Spinner from './ui/Spinner';

/**
 * Guards routes client-side. The stored token is also re-validated against
 * GET /api/auth/me on first mount of a protected page, so a stale/expired
 * token cannot keep the UI unlocked — the axios interceptor logs the user
 * out automatically on the 401.
 */
export function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, user, token } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const [checking, setChecking] = useState(Boolean(token));
  const verified = useRef(false);

  useEffect(() => {
    if (!token || verified.current) return;
    verified.current = true;
    authService
      .me()
      .then((me) => {
        if (me) dispatch(setUser(me));
      })
      .catch(() => {
        /* 401 handled globally: interceptor dispatches logout */
      })
      .finally(() => setChecking(false));
  }, [token, dispatch]);

  if (!isAuthenticated && !checking) return <Navigate to="/login" replace />;
  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (adminOnly && user?.userType !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}
