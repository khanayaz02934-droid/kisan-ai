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
import { adminService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatINR } from '../../utils/helpers';

// Must match the `type` enum in server/models/grainModel.js exactly.
const TYPES = ['RICE', 'WHEAT', 'MAIZE', 'PULSES', 'MILLETS', 'OILSEEDS', 'BARLEY', 'SORGHUM', 'OTHER'];

const emptyForm = {
  name: { en: '', hi: '' },
  type: 'RICE',
  variety: '',
  description: { en: '', hi: '' },
  pricePerQuintal: '',
  minOrderQuintal: '1',
  availableQuintal: '',
  location: '',
  state: '',
  district: '',
  images: '',
  isOrganic: false,
};

export default function AdminGrains() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const params = { page, limit: 20 };
  // NOTE: the admin-only /grain/admin/all endpoint is used (NOT the public
  // /grain list) so sold-out (availableQuintal=0) and deactivated grains stay
  // visible here — otherwise they could never be restocked or re-activated.
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'grains', params],
    queryFn: () => adminService.allGrains(params),
  });

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (g) => {
    setEditing(g);
    setForm({
      name: { ...g.name },
      type: g.type,
      variety: g.variety || '',
      description: { ...g.description },
      pricePerQuintal: g.pricePerQuintal,
      minOrderQuintal: g.minOrderQuintal,
      availableQuintal: g.availableQuintal,
      location: g.location,
      state: g.state || '',
      district: g.district || '',
      images: (g.images || []).join(', '),
      isOrganic: g.isOrganic,
    });
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        variety: form.variety,
        description: form.description,
        pricePerQuintal: Number(form.pricePerQuintal),
        minOrderQuintal: Number(form.minOrderQuintal) || 1,
        availableQuintal: Number(form.availableQuintal) || 0,
        location: form.location,
        state: form.state,
        district: form.district,
        images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
        isOrganic: form.isOrganic,
      };
      if (editing) {
        await adminService.updateGrain(editing._id, payload);
        toast.success('Grain updated');
      } else {
        await adminService.createGrain(payload);
        toast.success('Grain created');
      }
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'grains'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g) => {
    if (!window.confirm(`Delete "${g.name.en}"? This cannot be undone.`)) return;
    setDeleting(g._id);
    try {
      await adminService.deleteGrain(g._id);
      toast.success('Grain deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'grains'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const columns = [
    {
      key: 'image',
      label: 'Img',
      render: (g) => (
        <img src={g.images?.[0] || '/favicon.svg'} alt="" className="h-10 w-10 rounded-lg bg-gray-100" />
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (g) => (
        <span className="font-semibold">
          {g.name.en}
          <span className="block text-xs text-muted">{g.name.hi}</span>
        </span>
      ),
    },
    { key: 'type', label: 'Type' },
    { key: 'pricePerQuintal', label: 'Price/q', render: (g) => formatINR(g.pricePerQuintal) },
    { key: 'availableQuintal', label: 'Available (q)' },
    { key: 'location', label: 'Location' },
    {
      key: 'actions',
      label: 'Actions',
      render: (g) => (
        <div className="flex gap-1">
          {deleting === g._id ? (
            <Spinner />
          ) : (
            <>
              <Button variant="outline" className="px-3 text-xs" onClick={() => openEdit(g)}>
                Edit
              </Button>
              <Button variant="danger" className="px-3 text-xs" onClick={() => remove(g)}>
                Delete
              </Button>
            </>
          )}
        </div>
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
          Grain Listings ({data?.total ?? 0})
        </h1>
        <Button onClick={openCreate}>+ New Grain</Button>
      </div>

      {(data?.grains || []).length === 0 ? (
        <EmptyState title="No grain listings" />
      ) : (
        <Table columns={columns} rows={data.grains} />
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit: ${editing.name.en}` : 'New Grain Listing'}>
        <form onSubmit={save} className="space-y-3">
          <Input
            label="Name (English)"
            required
            value={form.name.en}
            onChange={(e) => setForm({ ...form, name: { ...form.name, en: e.target.value } })}
          />
          <Input
            label="Name (Hindi)"
            required
            value={form.name.hi}
            onChange={(e) => setForm({ ...form, name: { ...form.name, hi: e.target.value } })}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Type</span>
              <select
                className="btn-touch w-full rounded-xl border border-line px-4 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TYPES.map((ty) => (
                  <option key={ty}>{ty}</option>
                ))}
              </select>
            </label>
            <Input
              label="Variety"
              value={form.variety}
              onChange={(e) => setForm({ ...form, variety: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Price ₹/q"
              type="number"
              min="0"
              required
              value={form.pricePerQuintal}
              onChange={(e) => setForm({ ...form, pricePerQuintal: e.target.value })}
            />
            <Input
              label="Min order (q)"
              type="number"
              min="0"
              value={form.minOrderQuintal}
              onChange={(e) => setForm({ ...form, minOrderQuintal: e.target.value })}
            />
            <Input
              label="Available (q)"
              type="number"
              min="0"
              required
              value={form.availableQuintal}
              onChange={(e) => setForm({ ...form, availableQuintal: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Location"
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <Input
              label="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
            <Input
              label="District"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
          </div>
          <Input
            label="Image URLs (comma separated)"
            value={form.images}
            onChange={(e) => setForm({ ...form, images: e.target.value })}
            placeholder="https://…, https://…"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isOrganic}
              onChange={(e) => setForm({ ...form, isOrganic: e.target.checked })}
              className="h-4 w-4 accent-green-600"
            />
            Organic 🌿
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Spinner className="text-white" /> : 'Save Grain'}
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
