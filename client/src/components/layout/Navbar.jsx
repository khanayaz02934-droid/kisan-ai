import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Leaf, Menu, X, ShoppingCart, User } from 'lucide-react';
import LanguageToggle from '../ui/LanguageToggle';
import { logout } from '../../redux/slices/authSlice';
import { clearCartCount } from '../../redux/slices/cartSlice';
import { cx } from '../../utils/helpers';

const linkCls = ({ isActive }) =>
  cx(
    'rounded-xl px-3 py-2.5 text-sm font-semibold transition',
    isActive ? 'bg-primary-light text-primary-hover' : 'text-ink hover:bg-gray-100'
  );

export default function Navbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const cartCount = useSelector((s) => s.cart?.count || 0);
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/scan', label: t('nav.scan') },
    { to: '/chat', label: t('nav.chat') },
    { to: '/store', label: t('nav.store') },
    { to: '/mandi', label: t('nav.mandi') },
    { to: '/grain', label: t('nav.grain') },
  ];

  const doLogout = () => {
    dispatch(logout());
    dispatch(clearCartCount());
    setOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white">
            <Leaf size={22} />
          </span>
          <span className="text-lg font-extrabold text-ink">
            Kisan <span className="text-primary">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
          {user?.userType === 'ADMIN' && (
            <NavLink to="/admin" className={linkCls}>
              {t('nav.admin')}
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LanguageToggle />
          {isAuthenticated ? (
            <>
              <Link
                to="/cart"
                className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-gray-100"
                aria-label={t('nav.cart')}
              >
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </Link>
              <Link
                to="/profile"
                className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-gray-100"
                aria-label={t('nav.profile')}
              >
                <User size={20} />
              </Link>
              <button
                onClick={doLogout}
                className="btn-touch rounded-xl bg-gray-100 px-4 text-sm font-bold hover:bg-gray-200"
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="btn-touch inline-flex items-center rounded-xl bg-gray-100 px-4 text-sm font-bold hover:bg-gray-200"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                className="btn-touch inline-flex items-center rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover"
              >
                {t('nav.register')}
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            to="/cart"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-gray-100"
            aria-label={t('nav.cart')}
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-gray-100"
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-white px-4 pb-6 pt-3 lg:hidden">
          <nav className="grid gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkCls} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            {isAuthenticated && (
              <>
                <NavLink to="/orders" className={linkCls} onClick={() => setOpen(false)}>
                  {t('nav.orders')}
                </NavLink>
                <NavLink to="/profile" className={linkCls} onClick={() => setOpen(false)}>
                  {t('nav.profile')}
                </NavLink>
                {user?.userType === 'ADMIN' && (
                  <NavLink to="/admin" className={linkCls} onClick={() => setOpen(false)}>
                    {t('nav.admin')}
                  </NavLink>
                )}
              </>
            )}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-2">
            <LanguageToggle />
            {isAuthenticated ? (
              <button
                onClick={doLogout}
                className="btn-touch rounded-xl bg-gray-100 px-4 text-sm font-bold"
              >
                {t('nav.logout')}
              </button>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="btn-touch inline-flex items-center rounded-xl bg-gray-100 px-4 text-sm font-bold"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="btn-touch inline-flex items-center rounded-xl bg-primary px-4 text-sm font-bold text-white"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
