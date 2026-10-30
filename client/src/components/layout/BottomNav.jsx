import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ScanLine, Store, TrendingUp, Wheat, MessageCircleMore } from 'lucide-react';
import { cx } from '../../utils/helpers';

export default function BottomNav() {
  const { t } = useTranslation();
  const items = [
    { to: '/', icon: Home, label: t('nav.home'), end: true },
    { to: '/scan', icon: ScanLine, label: t('nav.scan') },
    { to: '/chat', icon: MessageCircleMore, label: t('nav.chat') },
    { to: '/store', icon: Store, label: t('nav.store') },
    { to: '/mandi', icon: TrendingUp, label: t('nav.mandi') },
    { to: '/grain', icon: Wheat, label: t('nav.grain') },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-6">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex min-h-[64px] flex-col items-center justify-center gap-1 text-[10px] font-semibold',
                isActive ? 'text-primary' : 'text-muted'
              )
            }
          >
            <Icon size={21} />
            <span className="max-w-full truncate px-0.5">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
