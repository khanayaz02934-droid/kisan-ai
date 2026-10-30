import { useState } from 'react';
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
import { adminService, mandiService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatINR, pickLang } from '../../utils/helpers';

const emptyForm = {
  state: '',
  district: '',
  market: '',
  commodity: { en: '', hi: '' },
  variety: '',
  minPrice: '',
  maxPrice: '',
  modalPrice: '',
  date: new Date().toISOString().split('T')[0],
};

export default function AdminMandi() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const params = { page, limit: 20 };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'mandi', params],
    queryFn: () => mandiService.list(params),
  });

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      state: p.state,
      district: p.district,
      market: p.market || '',
      commodity: { ...p.commodity },
      variety: p.variety || '',
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      modalPrice: p.modalPrice,
      date: p.date || new Date().toISOString().split('T')[0],
    });
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        minPrice: Number(form.minPrice) || 0,
        maxPrice: Number(form.maxPrice) || 0,
        modalPrice: Number(form.modalPrice) || 0,
      };
      if (editing) {
        await adminService.updateMandi(editing._id, payload);
        toast.success('Price updated');
      } else {
        await adminService.createMandi(payload);
        toast.success('Price record added');
      }
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'mandi'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'commodity',
      label: 'Commodity',
      render: (p) => (
        <span className="font-semibold">
          {pickLang(p.commodity)}
          {p.variety ? ` (${p.variety})` : ''}
        </span>
      ),
    },
    {
      key: 'market',
      label: 'Market',
      render: (p) => (
        <span>
          {p.market || '—'}
          <span className="block text-xs text-muted">
            {p.district}, {p.state}
          </span>
        </span>
      ),
    },
    { key: 'minPrice', label: 'Min', render: (p) => formatINR(p.minPrice) },
    { key: 'maxPrice', label: 'Max', render: (p) => formatINR(p.maxPrice) },
    {
      key: 'modalPrice',
      label: 'Modal',
      render: (p) => <span className="font-bold text-primary-hover">{formatINR(p.modalPrice)}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      render: (p) => (
        <span className="text-xs">
          <Badge tone={p.source === 'SEED' ? 'amber' : p.source === 'API' ? 'green' : 'gray'}>
            {p.source}
          </Badge>
          <span className="block">{p.date}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (p) => (
        <Button variant="outline" className="px-3 text-xs" onClick={() => openEdit(p)}>
          Edit
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">
          Mandi Prices ({data?.total ?? 0})
        </h1>
        <Button onClick={openCreate}>+ Add Price</Button>
      </div>

      {(data?.prices || []).length === 0 ? (
        <EmptyState title="No mandi price records" />
      ) : (
        <Table columns={columns} rows={data.prices} />
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Mandi Price' : 'Add Mandi Price'}
      >
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="State"
              required
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
            <Input
              label="District"
              required
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
          </div>
          <Input
            label="Market"
            value={form.market}
            onChange={(e) => setForm({ ...form, market: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Commodity (EN)"
              required
              value={form.commodity.en}
              onChange={(e) =>
                setForm({ ...form, commodity: { ...form.commodity, en: e.target.value } })
              }
            />
            <Input
              label="Commodity (HI)"
              required
              value={form.commodity.hi}
              onChange={(e) =>
                setForm({ ...form, commodity: { ...form.commodity, hi: e.target.value } })
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Min ₹"
              type="number"
              min="0"
              required
              value={form.minPrice}
              onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
            />
            <Input
              label="Max ₹"
              type="number"
              min="0"
              required
              value={form.maxPrice}
              onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
            />
            <Input
              label="Modal ₹"
              type="number"
              min="0"
              required
              value={form.modalPrice}
              onChange={(e) => setForm({ ...form, modalPrice: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <Input
              label="Variety"
              value={form.variety}
              onChange={(e) => setForm({ ...form, variety: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Spinner className="text-white" /> : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
