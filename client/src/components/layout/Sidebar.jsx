import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, ShoppingBag, ScanLine, Wheat, TrendingUp, Package } from 'lucide-react';
import { cx } from '../../utils/helpers';

export default function Sidebar() {
  const { t } = useTranslation();
  const items = [
    { to: '/admin', end: true, icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
    { to: '/admin/scans', icon: ScanLine, label: 'Scans' },
    { to: '/admin/products', icon: Package, label: 'Products' },
    { to: '/admin/grains', icon: Wheat, label: 'Grains' },
    { to: '/admin/mandi', icon: TrendingUp, label: 'Mandi' },
  ];
  return (
    <aside className="hidden w-60 shrink-0 md:block">
      <div className="sticky top-20 space-y-1 rounded-2xl border border-line bg-white p-3 shadow-soft">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
      </div>
    </aside>
  );
}
