import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { adminService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatINR, formatDate } from '../../utils/helpers';

const STATUSES = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState(null);

  const params = { page, limit: 20 };
  if (status) params.status = status;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: () => adminService.allOrders(params),
  });

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }

  const setOrderStatus = async (id, next) => {
    setUpdating(id);
    try {
      await adminService.updateOrderStatus(id, next);
      toast.success('Order updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUpdating(null);
    }
  };

  const columns = [
    {
      key: 'user',
      label: 'Customer',
      render: (o) => (
        <div>
          <span className="font-semibold">{o.user?.name || '—'}</span>
          <span className="block text-xs text-muted">{o.user?.phone || o.user?.email || ''}</span>
        </div>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      render: (o) =>
        o.items
          ?.map((it) => `${it.name?.en || '?'} × ${it.quantity}`)
          .join(', ')
          .slice(0, 60) || `—`,
    },
    { key: 'totalPrice', label: 'Total', render: (o) => formatINR(o.totalPrice) },
    { key: 'createdAt', label: 'Date', render: (o) => formatDate(o.createdAt) },
    {
      key: 'status',
      label: 'Status',
      render: (o) => <Badge tone={o.status === 'CANCELLED' ? 'red' : o.status === 'DELIVERED' ? 'green' : 'blue'}>{o.status}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (o) =>
        updating === o._id ? (
          <Spinner />
        ) : (
          <select
            className="rounded-lg border border-line px-2 py-1.5 text-xs"
            value={o.status}
            onChange={(e) => setOrderStatus(o._id, e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink sm:text-2xl">Orders ({data?.total ?? 0})</h1>

      <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:max-w-xs">
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      {(data?.orders || []).length === 0 ? (
        <EmptyState title="No orders found" />
      ) : (
        <Table columns={columns} rows={data.orders} />
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />
    </div>
  );
}
