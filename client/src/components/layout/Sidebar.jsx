import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  ScanLine,
  Package,
  Wheat,
  TrendingUp,
  PlusCircle,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { logout } from '../../redux/slices/authSlice';
import { cx } from '../../utils/helpers';

const items = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Manage Users' },
  { to: '/admin/products', icon: Package, label: 'Manage Products' },
  { to: '/admin/orders', icon: ShoppingBag, label: 'Manage Orders' },
  { to: '/admin/products?new=1', icon: PlusCircle, label: 'Add Product' },
  { to: '/admin/scans', icon: ScanLine, label: 'Scans' },
  { to: '/admin/grains', icon: Wheat, label: 'Grains' },
  { to: '/admin/mandi', icon: TrendingUp, label: 'Mandi' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

function NavLinks({ onNavigate }) {
  const { t } = useTranslation();
  return (
    <>
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition',
              isActive ? 'bg-primary-light text-primary-hover' : 'text-ink hover:bg-gray-100'
            )
          }
        >
          <Icon size={18} />
          {label}
          <span className="sr-only">{t('nav.admin')}</span>
        </NavLink>
      ))}
    </>
  );
}

function ProfileBlock() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="mt-2 border-t border-line pt-3">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-extrabold text-primary">
          {(user?.name || 'A').slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{user?.name || 'Admin'}</p>
          <span className="inline-flex items-center rounded-md bg-primary-light px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
            {user?.userType === 'ADMIN' ? 'Admin' : (user?.userType || 'User')}
          </span>
          <p className="mt-0.5 truncate text-xs text-muted">{user?.email || ''}</p>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
      >
        <LogOut size={18} />
        Logout
      </button>
    </div>
  );
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col rounded-2xl border border-line bg-white p-3 shadow-soft">
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            <NavLinks />
          </nav>
          <ProfileBlock />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 flex bg-black/40 md:hidden"
          onClick={onCloseMobile}
        >
          <aside
            className="flex h-full w-72 flex-col rounded-r-2xl bg-white p-3 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-sm font-extrabold text-ink">Admin Menu</span>
              <button
                aria-label="Close menu"
                onClick={onCloseMobile}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              <NavLinks onNavigate={onCloseMobile} />
            </nav>
            <ProfileBlock />
          </aside>
        </div>
      )}
    </>
  );
}
