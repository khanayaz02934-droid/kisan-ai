import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ShoppingBag,
  ScanLine,
  Package,
  Wheat,
  TrendingUp,
  IndianRupee,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import ErrorState from '../../components/ui/ErrorState';
import Table from '../../components/ui/Table';
import { adminService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatINR, formatDate } from '../../utils/helpers';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminService.stats(),
  });

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const statCards = [
    { icon: Users, label: 'Users', value: data.totalUsers, to: '/admin/users' },
    { icon: Package, label: 'Products', value: data.totalProducts, to: '/admin/products' },
    { icon: ShoppingBag, label: 'Orders', value: data.totalOrders, to: '/admin/orders' },
    { icon: ScanLine, label: 'Scans', value: data.totalScans, to: '/admin/scans' },
    { icon: Wheat, label: 'Grains', value: data.totalGrains, to: '/admin/grains' },
    { icon: TrendingUp, label: 'Grain Orders', value: data.totalGrainOrders, to: '/admin/orders' },
    {
      icon: IndianRupee,
      label: 'Total Revenue',
      value: formatINR(data.totalRevenue),
      to: '/admin/orders',
    },
    { icon: ShoppingBag, label: 'Pending Orders', value: data.pendingOrders, to: '/admin/orders' },
  ];

  const recentColumns = [
    { key: 'user', label: 'Customer', render: (o) => o.user?.name || '—' },
    { key: 'totalPrice', label: 'Total', render: (o) => formatINR(o.totalPrice) },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Date', render: (o) => formatDate(o.createdAt) },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{t('admin.dashboardTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('admin.dashboardSub')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ icon: Icon, label, value, to }) => (
          <Card
            key={label}
            className="cursor-pointer hover:border-primary/40"
            onClick={() => navigate(to)}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Icon size={20} />
            </span>
            <p className="mt-3 text-2xl font-extrabold text-ink">{value ?? '—'}</p>
            <p className="text-xs text-muted">{label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-base font-bold text-ink">{t('admin.recentOrders')}</h2>
        {data.recentOrders?.length > 0 ? (
          <div className="mt-3">
            <Table columns={recentColumns} rows={data.recentOrders} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No orders yet.</p>
        )}
      </Card>
    </div>
  );
}
