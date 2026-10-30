import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { adminService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = { page, limit: 20 };
  if (search) params.search = search;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminService.users(params),
  });

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }

  const toggle = async (id) => {
    setToggling(id);
    try {
      const res = await adminService.toggleUser(id);
      toast.success(res.message || 'Updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setToggling(null);
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (u) => <span className="font-semibold">{u.name}</span> },
    { key: 'email', label: 'Email' },
    { key: 'userType', label: 'Role', render: (u) => (u.userType === 'ADMIN' ? <Badge tone="blue">ADMIN</Badge> : <Badge tone="gray">USER</Badge>) },
    { key: 'state', label: 'State', render: (u) => u.state || '—' },
    { key: 'createdAt', label: 'Joined', render: (u) => formatDate(u.createdAt) },
    {
      key: 'isActive',
      label: 'Status',
      render: (u) =>
        u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (u) =>
        toggling === u._id ? (
          <Spinner />
        ) : (
          <Button
            variant={u.isActive ? 'danger' : 'primary'}
            className="px-3 text-xs"
            onClick={() => toggle(u._id)}
          >
            {u.isActive ? 'Disable' : 'Enable'}
          </Button>
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
      <h1 className="text-xl font-extrabold text-ink sm:text-2xl">Users ({data?.total ?? 0})</h1>

      <Input
        placeholder="Search by name or email…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="sm:max-w-sm"
      />

      {(data?.users || []).length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <Table
          columns={columns}
          rows={data.users}
          renderMobile={(u) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink">{u.name}</p>
                <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
              </div>
              <p className="text-sm text-muted">{u.email}</p>
              <p className="text-xs text-muted">
                {u.userType} · {u.state || '—'} · {formatDate(u.createdAt)}
              </p>
              <Button
                variant={u.isActive ? 'danger' : 'primary'}
                size="sm"
                className="mt-2 w-full"
                onClick={() => toggle(u._id)}
              >
                {u.isActive ? 'Disable' : 'Enable'}
              </Button>
            </div>
          )}
        />
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />
    </div>
  );
}
