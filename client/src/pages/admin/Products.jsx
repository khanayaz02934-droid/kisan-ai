import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
import { apiErrorMessage } from '../../services/api';
import { formatINR, formatDate } from '../../utils/helpers';

const CATEGORIES = ['PESTICIDE', 'FUNGICIDE', 'FERTILIZER', 'SEED', 'BIO_PRODUCT'];
const AVAILABILITY = [
  { value: '', label: 'All availability' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'UNAVAILABLE', label: 'Unavailable' },
];

const emptyForm = {
  name: { en: '', hi: '' },
  description: { en: '', hi: '' },
  category: 'FERTILIZER',
  tags: '',
  price: '',
  unit: '500ml',
  stock: '',
  image: '',
  isActive: true,
};

const validateForm = (form) => {
  const errors = [];
  if (!form.name.en.trim()) errors.push('English name is required');
  if (!form.name.hi.trim()) errors.push('Hindi name is required');
  if (form.price === '' || Number(form.price) < 0 || Number.isNaN(Number(form.price)))
    errors.push('Price must be a number greater than or equal to 0');
  if (form.stock === '' || Number(form.stock) < 0 || Number.isNaN(Number(form.stock)))
    errors.push('Stock must be a number greater than or equal to 0');
  if (!CATEGORIES.includes(form.category)) errors.push('Please choose a valid category');
  return errors;
};

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // product object or null for create
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Sidebar "Add Product" links to /admin/products?new=1 → auto-open the form.
  useEffect(() => {
    if (searchParams.get('new')) {
      setEditing(null);
      setForm(emptyForm);
      setFormErrors([]);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const params = { page, limit: 20 };
  if (search) params.search = search;
  if (category) params.category = category;
  if (availability) params.availability = availability;

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
    setFormErrors([]);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: { en: p.name?.en || '', hi: p.name?.hi || '' },
      description: { en: p.description?.en || '', hi: p.description?.hi || '' },
      category: p.category,
      tags: (p.tags || []).join(', '),
      price: p.price,
      unit: p.unit || '500ml',
      stock: p.stock,
      image: p.image || '',
      isActive: Boolean(p.isActive),
    });
    setFormErrors([]);
    setModalOpen(true);
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await adminService.uploadProductImage(file);
      setForm((f) => ({ ...f, image: res.url }));
      toast.success('Image uploaded');
    } catch (err) {
      // The backend returns a clear 503 message when Cloudinary is not configured.
      toast.error(apiErrorMessage(err, 'Image upload failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const errors = validateForm(form);
    setFormErrors(errors);
    if (errors.length) return;

    setSaving(true);
    try {
      const payload = {
        name: { en: form.name.en.trim(), hi: form.name.hi.trim() },
        description: {
          en: form.description.en.trim() || '',
          hi: form.description.hi.trim() || '',
        },
        category: form.category,
        tags: form.tags.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        price: Number(form.price),
        unit: form.unit.trim() || '500ml',
        stock: Number(form.stock),
        image: form.image,
        isActive: form.isActive,
      };
      if (editing) {
        await adminService.updateProduct(editing._id, payload);
        toast.success('Product updated');
      } else {
        await adminService.createProduct(payload);
        toast.success('Product created');
      }
      setModalOpen(false);
      // Refresh list and dashboard counts.
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminService.deleteProduct(deleteTarget._id);
      toast.success('Product deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const toggleAvailability = async (p) => {
    try {
      await adminService.updateProduct(p._id, { isActive: !p.isActive });
      toast.success(p.isActive ? 'Product marked unavailable' : 'Product marked available');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
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
      render: (p) => (p.stock > 0 ? p.stock : <Badge tone="red">Out of stock</Badge>),
    },
    {
      key: 'availability',
      label: 'Availability',
      render: (p) => (
        <button
          onClick={() => toggleAvailability(p)}
          className="inline-flex items-center"
          title="Click to toggle availability"
        >
          <Badge tone={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Available' : 'Unavailable'}</Badge>
        </button>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created / Updated',
      render: (p) => (
        <span className="text-xs text-muted">
          {formatDate(p.createdAt)}
          <span className="block">upd. {formatDate(p.updatedAt)}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (p) => (
        <div className="flex gap-1">
          <Button variant="outline" className="px-3 text-xs" onClick={() => openEdit(p)}>
            Edit
          </Button>
          <Button variant="danger" className="px-3 text-xs" onClick={() => setDeleteTarget(p)}>
            Delete
          </Button>
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

  const products = data?.products || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">
          Products ({(data?.pagination?.total ?? 0).toLocaleString('en-IN')})
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" className="px-3 text-xs" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button onClick={openCreate}>+ New Product</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search products…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="sm:max-w-sm"
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Category</span>
          <select
            className="btn-touch w-full rounded-xl border border-line px-4 text-sm"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Availability</span>
          <select
            className="btn-touch w-full rounded-xl border border-line px-4 text-sm"
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value);
              setPage(1);
            }}
          >
            {AVAILABILITY.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title={search || category || availability ? 'No products match your filters' : 'No products yet'}
          desc={
            search || category || availability
              ? 'Try different filters or a different search term.'
              : 'Create your first product with the "+ New Product" button.'
          }
        />
      ) : (
        <Table
          columns={columns}
          rows={products}
          renderMobile={(p) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <img src={p.image || '/favicon.svg'} alt="" className="h-9 w-9 rounded-lg bg-gray-100" />
                  <p className="font-bold text-ink">{p.name.en}</p>
                </div>
                <Badge tone={p.isActive ? 'green' : 'gray'}>
                  {p.isActive ? 'Available' : 'Unavailable'}
                </Badge>
              </div>
              <p className="text-sm text-muted">
                {p.category} · {formatINR(p.price)} / {p.unit} · Stock {p.stock}
              </p>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" className="flex-1" onClick={() => setDeleteTarget(p)}>
                  Delete
                </Button>
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

      {/* Create / edit product */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.name.en}` : 'New Product'}
      >
        <form onSubmit={save} className="space-y-3">
          {formErrors.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {formErrors.map((msg) => (
                <li key={msg}>• {msg}</li>
              ))}
            </ul>
          )}
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
            label="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="neem, aphids, organic"
          />

          {/* Product image: upload + preview */}
          <div>
            <span className="mb-1 block text-sm font-medium text-ink">Product image</span>
            <div className="flex flex-wrap items-center gap-3">
              <img
                src={form.image || '/favicon.svg'}
                alt="Product preview"
                className="h-20 w-20 rounded-xl border border-line bg-gray-100 object-cover"
              />
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="block w-full text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary cursor-pointer"
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                />
                <p className="mt-1 text-[11px] text-muted">
                  JPG, PNG or WebP, up to 5MB. {uploading && 'Uploading…'}
                </p>
              </div>
            </div>
            <Input
              label="Or paste an image URL"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="https://…"
              className="mt-2"
            />
          </div>

          {/* Availability */}
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#16a34a]"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Product is available in the store
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || uploading} className="flex-1">
              {saving ? <Spinner className="text-white" /> : 'Save Product'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete product?"
        message={`This will permanently delete "${deleteTarget?.name?.en}". Customers will no longer see it. This cannot be undone.`}
        confirmLabel="Delete product"
        busy={deleting}
      />
    </div>
  );
}
