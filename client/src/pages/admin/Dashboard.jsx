import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  UserCheck,
  ShieldCheck,
  Package,
  PackageCheck,
  ShoppingBag,
  Clock,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ErrorState from '../../components/ui/ErrorState';
import Table from '../../components/ui/Table';
import { Skeleton, TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { adminService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatINR, formatDate, pickLang } from '../../utils/helpers';
import { useLang } from '../../hooks/useLang';
function StatCard({ icon: Icon, label, value, to, sub }) {
  const navigate = useNavigate();
  return (
    <Card className="cursor-pointer hover:border-primary/40" onClick={() => to && navigate(to)}>
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-ink">{value ?? '—'}</p>
      <p className="text-xs font-semibold text-ink/80">{label}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <TableSkeleton rows={4} />
      <TableSkeleton rows={4} />
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lang = useLang();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminService.dashboard(),
  });

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }
  if (isLoading) return <LoadingDashboard />;

  const s = data.stats;

  const statCards = [
    { icon: Users, label: 'Total Users', value: s.totalUsers, to: '/admin/users' },
    {
      // Activity tracking does not exist in this project, so the metric is
      // explicitly labelled as enabled accounts.
      icon: UserCheck,
      label: 'Active Users',
      value: s.activeUsers,
      sub: 'Enabled accounts (no activity tracking)',
      to: '/admin/users',
    },
    { icon: ShieldCheck, label: 'Admin Users', value: s.totalAdmins, to: '/admin/users' },
    { icon: Package, label: 'Total Products', value: s.totalProducts, to: '/admin/products' },
    {
      icon: PackageCheck,
      label: 'Available Products',
      value: s.availableProducts,
      to: '/admin/products',
    },
    { icon: ShoppingBag, label: 'Total Orders', value: s.totalOrders, to: '/admin/orders' },
    { icon: Clock, label: 'Pending Orders', value: s.pendingOrders, to: '/admin/orders' },
    {
      icon: TrendingUp,
      label: 'Total Revenue',
      value: formatINR(s.totalRevenue),
      to: '/admin/orders',
    },
  ];

  const chartData = data.charts?.registrations?.map((r, i) => ({
    day: r.day.slice(5),
    users: r.count,
    orders: data.charts.orders?.[i]?.count ?? 0,
  })) || [];

  const recentUserColumns = [
    { key: 'name', label: 'Name', render: (u) => <span className="font-semibold">{u.name}</span> },
    { key: 'email', label: 'Email' },
    {
      key: 'userType',
      label: 'Role',
      render: (u) =>
        u.userType === 'ADMIN' ? <Badge tone="blue">ADMIN</Badge> : <Badge tone="gray">USER</Badge>,
    },
    { key: 'createdAt', label: 'Joined', render: (u) => formatDate(u.createdAt) },
  ];

  const recentOrderColumns = [
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

      {/* Statistic cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ icon, label, value, to, sub }) => (
          <StatCard key={label} icon={icon} label={label} value={value} to={to} sub={sub} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-bold text-ink">New users (last 14 days)</h2>
          {chartData.some((d) => d.users > 0) ? (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#16a34a"
                    strokeWidth={2}
                    fill="url(#gUsers)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No registrations yet" />
          )}
        </Card>

        <Card>
          <h2 className="text-base font-bold text-ink">New orders (last 14 days)</h2>
          {chartData.some((d) => d.orders > 0) ? (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="url(#gOrders)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No orders yet" />
          )}
        </Card>
      </div>

      {/* Recent users + recent orders */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Recent registered users</h2>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-sm font-semibold text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="mt-3">
            {data.recentUsers?.length ? (
              <Table columns={recentUserColumns} rows={data.recentUsers} />
            ) : (
              <EmptyState title="No users yet" />
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">{t('admin.recentOrders')}</h2>
            <button
              onClick={() => navigate('/admin/orders')}
              className="text-sm font-semibold text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="mt-3">
            {data.recentOrders?.length ? (
              <Table columns={recentOrderColumns} rows={data.recentOrders} />
            ) : (
              <EmptyState title="No orders yet" />
            )}
          </div>
        </Card>
      </div>

      {/* Recent product activity */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <ClipboardList size={18} className="text-primary" />
            Recent product activity
          </h2>
          <button
            onClick={() => navigate('/admin/products')}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View all
          </button>
        </div>
        {data.recentProducts?.length ? (
          <ul className="mt-3 divide-y divide-gray-100">
            {data.recentProducts.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{pickLang(p.name, lang) || p.name?.en}</p>
                  <p className="text-xs text-muted">
                    {p.category} · {formatINR(p.price)} · Stock {p.stock}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.isActive && p.stock > 0 ? 'green' : 'red'}>
                    {p.isActive && p.stock > 0 ? 'Available' : 'Unavailable'}
                  </Badge>
                  <span className="text-xs text-muted">Updated {formatDate(p.updatedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No products yet" desc="Add your first product from the Products page." />
        )}
      </Card>
    </div>
  );
}
