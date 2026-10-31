import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { adminService } from '../../services';
import { useSelector } from 'react-redux';
import { apiErrorMessage } from '../../services/api';
import { formatDate, formatINR } from '../../utils/helpers';

const ROLES = [
  { value: '', label: 'All roles' },
  { value: 'USER', label: 'Users' },
  { value: 'ADMIN', label: 'Admins' },
];

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const currentUser = useSelector((s) => s.auth.user);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [toggling, setToggling] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = { page, limit: 20 };
  if (search) params.search = search;
  if (role) params.role = role;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminService.users(params),
  });

  const {
    data: detail,
    isFetching: detailLoading,
    isError: detailError,
  } = useQuery({
    queryKey: ['admin', 'user', deleteTarget?._id],
    queryFn: () => adminService.user(deleteTarget._id),
    enabled: Boolean(detailOpen && deleteTarget?._id),
  });

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }

  const openDetail = (u) => {
    setDeleteTarget(u);
    setDetailOpen(true);
  };

  const openDelete = (u) => {
    setDetailOpen(false);
    setDeleteTarget(u);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminService.deleteUser(deleteTarget._id);
      toast.success(res.message || 'User deleted');
      setDeleteTarget(null);
      // Refresh the list and every dashboard stat, so counts stay accurate.
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const toggle = async (u) => {
    setToggling(u._id);
    try {
      const res = await adminService.toggleUser(u._id);
      toast.success(res.message || 'Updated');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setToggling(null);
    }
  };

  const isSelf = (u) => currentUser?._id === u._id;
  const canDelete = (u) => !isSelf(u);

  const columns = [
    { key: 'name', label: 'Name', render: (u) => <span className="font-semibold">{u.name}</span> },
    { key: 'email', label: 'Email' },
    {
      key: 'userType',
      label: 'Role',
      render: (u) =>
        u.userType === 'ADMIN' ? <Badge tone="blue">ADMIN</Badge> : <Badge tone="gray">USER</Badge>,
    },
    { key: 'state', label: 'State', render: (u) => u.state || '—' },
    { key: 'createdAt', label: 'Registered', render: (u) => formatDate(u.createdAt) },
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
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" className="px-3 text-xs" onClick={() => openDetail(u)}>
              View
            </Button>
            <Button
              variant={u.isActive ? 'danger' : 'primary'}
              className="px-3 text-xs"
              onClick={() => toggle(u)}
            >
              {u.isActive ? 'Disable' : 'Enable'}
            </Button>
            {canDelete(u) && (
              <Button
                variant="danger"
                className="px-3 text-xs"
                title={isSelf(u) ? 'You cannot delete your own account' : undefined}
                onClick={() => {
                  if (isSelf(u)) {
                    toast.error('You cannot delete your own account');
                    return;
                  }
                  openDelete(u);
                }}
              >
                Delete
              </Button>
            )}
          </div>
        ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </div>
    );
  }

  const users = data?.users || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">
          Users ({(data?.pagination?.total ?? 0).toLocaleString('en-IN')})
        </h1>
        <Button variant="outline" className="px-3 text-xs" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name or email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="sm:max-w-sm"
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Role</span>
          <select
            className="btn-touch w-full rounded-xl border border-line px-4 text-sm"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title={search || role ? 'No users match your filters' : 'No users found'}
          desc={
            search || role
              ? 'Try a different search term or reset the role filter.'
              : 'New users will appear here after they register.'
          }
        />
      ) : (
        <Table
          columns={columns}
          rows={users}
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
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openDetail(u)}>
                  View
                </Button>
                <Button
                  variant={u.isActive ? 'danger' : 'primary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => toggle(u)}
                >
                  {u.isActive ? 'Disable' : 'Enable'}
                </Button>
                {canDelete(u) && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      if (isSelf(u)) {
                        toast.error('You cannot delete your own account');
                        return;
                      }
                      openDelete(u);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        />
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />

      {/* User details */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={deleteTarget ? `User: ${deleteTarget.name}` : 'User details'}
      >
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : detailError || !detail ? (
          <p className="text-sm text-muted">Could not load user details.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <InfoRow label="Name" value={detail.user.name} />
              <InfoRow label="Email" value={detail.user.email} />
              <InfoRow
                label="Role"
                value={
                  <Badge tone={detail.user.userType === 'ADMIN' ? 'blue' : 'gray'}>
                    {detail.user.userType}
                  </Badge>
                }
              />
              <InfoRow
                label="Status"
                value={
                  <Badge tone={detail.user.isActive ? 'green' : 'red'}>
                    {detail.user.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                }
              />
              <InfoRow label="Registered" value={formatDate(detail.user.createdAt)} />
              <InfoRow label="Phone" value={detail.user.phone || '—'} />
              <InfoRow
                label="Location"
                value={
                  [detail.user.village, detail.user.district, detail.user.state]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
              <InfoRow label="Language" value={(detail.user.preferredLang || 'en').toUpperCase()} />
              <InfoRow label="Orders" value={String(detail.orderStats?.count ?? 0)} />
              <InfoRow
                label="Lifetime spend"
                value={formatINR(detail.orderStats?.totalSpent ?? 0)}
              />
              <InfoRow label="Crop scans" value={String(detail.scanCount ?? 0)} />
            </div>
            <div className="flex gap-2 pt-2">
              {detail.user._id !== currentUser?._id && (
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    openDelete(detail.user);
                  }}
                >
                  Delete user
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        open={Boolean(deleteTarget) && !detailOpen}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete user?"
        message={`This will delete "${deleteTarget?.name}". Their account will be removed, but their order history and other records are preserved. This cannot be undone.`}
        confirmLabel="Delete user"
        busy={deleting}
      />
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink break-words">{value}</p>
    </div>
  );
}
