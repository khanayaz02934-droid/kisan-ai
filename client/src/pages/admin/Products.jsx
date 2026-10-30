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
import { adminService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatINR } from '../../utils/helpers';

const CATEGORIES = ['PESTICIDE', 'FUNGICIDE', 'FERTILIZER', 'SEED', 'BIO_PRODUCT'];

const emptyForm = {
  name: { en: '', hi: '' },
  description: { en: '', hi: '' },
  category: 'FERTILIZER',
  tags: '',
  price: '',
  unit: '500ml',
  stock: '',
  image: '',
};

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // product object or null for create
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

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
    queryKey: ['admin', 'products', params],
    queryFn: () => adminService.allProducts(params),
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
      name: { ...p.name },
      description: { ...p.description },
      category: p.category,
      tags: (p.tags || []).join(', '),
      price: p.price,
      unit: p.unit,
      stock: p.stock,
      image: p.image || '',
    });
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        category: form.category,
        tags: form.tags.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        price: Number(form.price),
        unit: form.unit,
        stock: Number(form.stock),
        image: form.image,
        isActive: editing ? editing.isActive : true,
      };
      if (editing) {
        await adminService.updateProduct(editing._id, payload);
        toast.success('Product updated');
      } else {
        await adminService.createProduct(payload);
        toast.success('Product created');
      }
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name.en}"? This cannot be undone.`)) return;
    setDeleting(p._id);
    try {
      await adminService.deleteProduct(p._id);
      toast.success('Product deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
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
      render: (p) => (
        <img src={p.image || '/favicon.svg'} alt="" className="h-10 w-10 rounded-lg bg-gray-100" />
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (p) => (
        <span className="font-semibold">
          {p.name.en}
          <span className="block text-xs text-muted">{p.name.hi}</span>
        </span>
      ),
    },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price', render: (p) => `${formatINR(p.price)} / ${p.unit}` },
    {
      key: 'stock',
      label: 'Stock',
      render: (p) =>
        p.stock > 0 ? (
          p.stock
        ) : (
          <Badge tone="red">Out of stock</Badge>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (p) => (
        <div className="flex gap-1">
          {deleting === p._id ? (
            <Spinner />
          ) : (
            <>
              <Button variant="outline" className="px-3 text-xs" onClick={() => openEdit(p)}>
                Edit
              </Button>
              <Button variant="danger" className="px-3 text-xs" onClick={() => remove(p)}>
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
          Products ({data?.total ?? 0})
        </h1>
        <Button onClick={openCreate}>+ New Product</Button>
      </div>

      <Input
        placeholder="Search products…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="sm:max-w-sm"
      />

      {(data?.products || []).length === 0 ? (
        <EmptyState title="No products found" />
      ) : (
        <Table columns={columns} rows={data.products} />
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit: ${editing.name.en}` : 'New Product'}>
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
          <Input
            label="Description (English)"
            value={form.description.en}
            onChange={(e) =>
              setForm({ ...form, description: { ...form.description, en: e.target.value } })
            }
          />
          <Input
            label="Description (Hindi)"
            value={form.description.hi}
            onChange={(e) =>
              setForm({ ...form, description: { ...form.description, hi: e.target.value } })
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Category</span>
              <select
                className="btn-touch w-full rounded-xl border border-line px-4 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <Input
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price (₹)"
              type="number"
              min="0"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              required
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
          <Input
            label="Image URL"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            placeholder="https://…"
          />
          <Input
            label="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="neem, aphids, organic"
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Spinner className="text-white" /> : 'Save Product'}
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
