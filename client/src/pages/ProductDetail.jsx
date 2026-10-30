import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import ErrorState from '../components/ui/ErrorState';
import { productService, cartService } from '../services';
import { apiErrorMessage } from '../services/api';
import { setCartCount } from '../redux/slices/cartSlice';
import { pickLang, formatINR } from '../utils/helpers';

export default function ProductDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getById(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-md">
        <ErrorState
          message={apiErrorMessage(error, t('store.noProducts'))}
          onRetry={() => navigate('/store')}
        />
      </div>
    );
  }

  const outOfStock = product.stock === 0;

  const addToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setAdding(true);
    try {
      const cart = await cartService.add(product._id, qty);
      dispatch(setCartCount(cart?.itemCount ?? 0));
      toast.success(t('cart.addedToast'));
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      navigate('/cart');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/store"
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft size={16} /> {t('store.backToStore')}
      </Link>

      <Card>
        <div className="grid gap-6 md:grid-cols-2">
          <img
            src={product.image || '/favicon.svg'}
            alt={pickLang(product.name, lang)}
            className="aspect-square w-full rounded-2xl bg-gray-100"
          />
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">{product.category}</Badge>
              {outOfStock ? (
                <Badge tone="red">{t('store.outOfStock')}</Badge>
              ) : (
                <Badge tone="green">
                  {t('store.inStockStat', { stock: product.stock })}
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold text-ink">
              {pickLang(product.name, lang)}
            </h1>
            <p className="mt-2 text-2xl font-extrabold text-primary-hover">
              {formatINR(product.price)}{' '}
              <span className="text-sm text-muted">/ {product.unit}</span>
            </p>

            {(product.description?.en || product.description?.hi) && (
              <p className="mt-4 text-sm leading-6 text-muted">
                {pickLang(product.description, lang)}
              </p>
            )}

            {product.expireOn && (
              <p className="mt-2 text-xs text-muted">
                {t('product.expiresOn')}: {new Date(product.expireOn).toLocaleDateString('en-IN')}
              </p>
            )}

            {product.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-ink">
                {t('common.quantity')}
                <input
                  type="number"
                  min="1"
                  max={Math.max(product.stock, 1)}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="btn-touch mt-1 w-24 rounded-xl border border-line px-3 text-sm"
                  disabled={outOfStock}
                />
              </label>
              <Button
                onClick={addToCart}
                disabled={adding || outOfStock}
                className="flex-1 min-w-40"
              >
                {adding ? (
                  <Spinner className="text-white" />
                ) : (
                  <>
                    <ShoppingCart size={18} /> {t('store.addToCart')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
