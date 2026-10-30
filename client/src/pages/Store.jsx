import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ShoppingCart } from 'lucide-react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import { Skeleton } from '../components/ui/Skeleton';
import { productService, cartService } from '../services';
import { apiErrorMessage } from '../services/api';
import { useSelector, useDispatch } from 'react-redux';
import { setCartCount } from '../redux/slices/cartSlice';
import { pickLang, formatINR } from '../utils/helpers';

const CATEGORIES = ['PESTICIDE', 'FUNGICIDE', 'FERTILIZER', 'SEED', 'BIO_PRODUCT'];

function ProductCard({ product, lang, onAdd, adding }) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col">
      <Link to={`/product/${product._id}`} className="block">
        <img
          src={product.image || '/favicon.svg'}
          alt={pickLang(product.name, lang)}
          className="aspect-square w-full rounded-xl bg-gray-100"
        />
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <Badge tone="blue">{product.category}</Badge>
        {product.stock > 0 ? (
          <Badge tone="green">{t('store.inStockStat', { stock: product.stock })}</Badge>
        ) : (
          <Badge tone="red">{t('store.outOfStock')}</Badge>
        )}
      </div>
      <Link to={`/product/${product._id}`}>
        <h3 className="mt-2 line-clamp-2 text-sm font-bold text-ink hover:text-primary">
          {pickLang(product.name, lang)}
        </h3>
      </Link>
      <p className="mt-1 text-sm font-extrabold text-primary-hover">
        {formatINR(product.price)} <span className="text-xs text-muted">/ {product.unit}</span>
      </p>
      <Button
        className="mt-3 w-full"
        disabled={adding || product.stock === 0}
        onClick={onAdd}
      >
        {adding ? (
          <Spinner className="text-white" />
        ) : (
          <>
            <ShoppingCart size={16} /> {t('store.addToCart')}
          </>
        )}
      </Button>
    </Card>
  );
}

export default function Store() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSelector((s) => s.auth);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(1);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = { page, limit: 12 };
  if (search) params.search = search;
  if (category) params.category = category;
  if (inStock) params.inStock = 'true';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', params],
    queryFn: () => productService.list(params),
  });

  const addToCart = async (product) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setAddingId(product._id);
    try {
      const cart = await cartService.add(product._id, 1);
      dispatch(setCartCount(cart?.itemCount ?? 0));
      toast.success(t('cart.addedToast'));
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setAddingId(null);
    }
  };

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }

  const products = data?.products || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{t('store.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('store.subtitle')}</p>
        </div>
        <span className="hidden text-xs text-muted sm:block">
          {data ? t('store.resultsText', { count: data.total }) : ''}
        </span>
      </div>

      {/* Search + filters */}
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            placeholder={t('store.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('store.allCategories')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-4 text-sm text-ink">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => {
                setInStock(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 accent-green-600"
            />
            {t('store.inStockOnly')}
          </label>
        </div>
      </Card>

      {/* Products grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState title={t('store.noProducts')} desc={t('common.noDataDesc')} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p._id}
              product={p}
              lang={lang}
              adding={addingId === p._id}
              onAdd={() => addToCart(p)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={(p) => setPage(p)}
      />
    </div>
  );
}
