import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { adminService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function AdminScans() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = { page, limit: 20 };
  if (status) params.status = status;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'scans', params],
    queryFn: () => adminService.allScans(params),
  });

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }

  const columns = [
    {
      key: 'imageUrl',
      label: 'Image',
      render: (s) => (
        <a href={s.imageUrl} target="_blank" rel="noreferrer">
          <img src={s.imageUrl} alt="scan" className="h-14 w-14 rounded-lg" />
        </a>
      ),
    },
    {
      key: 'user',
      label: 'User',
      render: (s) => (
        <div>
          <span className="font-semibold">{s.user?.name || '—'}</span>
          <span className="block text-xs text-muted">{s.user?.email}</span>
        </div>
      ),
    },
    {
      key: 'disease',
      label: 'Result',
      render: (s) =>
        s.result
          ? `${s.result.disease?.en || '—'} (${Math.round((s.result.confidence || 0) * 100)}%)`
          : '—',
    },
    { key: 'status', label: 'Status', render: (s) => <Badge tone={s.status === 'COMPLETED' ? 'green' : 'amber'}>{s.status}</Badge> },
    { key: 'createdAt', label: 'Date', render: (s) => formatDate(s.createdAt) },
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
      <h1 className="text-xl font-extrabold text-ink sm:text-2xl">Scans ({data?.total ?? 0})</h1>

      <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:max-w-xs">
        <option value="">All statuses</option>
        <option value="COMPLETED">COMPLETED</option>
        <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
      </Select>

      {(data?.scans || []).length === 0 ? (
        <EmptyState title="No scans yet" />
      ) : (
        <Table columns={columns} rows={data.scans} />
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />
    </div>
  );
}
