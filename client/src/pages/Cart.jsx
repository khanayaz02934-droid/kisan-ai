import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ShoppingCart, Trash2 } from 'lucide-react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { cartService, orderService } from '../services';
import { apiErrorMessage } from '../services/api';
import { setCartCount } from '../redux/slices/cartSlice';
import { pickLang, formatINR } from '../utils/helpers';

export default function Cart() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const { data: cart, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartService.get(),
  });

  const [busyItem, setBusyItem] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [address, setAddress] = useState({
    fullName: '',
    phone: '',
    street: '',
    district: '',
    state: '',
    pincode: '',
  });
  const [notes, setNotes] = useState('');

  const items = cart?.items || [];
  const totalPrice = cart?.totalPrice || 0;

  const updateQty = async (productId, quantity) => {
    if (busyItem) return;
    setBusyItem(productId);
    try {
      const updated = await cartService.updateQty(productId, quantity);
      dispatch(setCartCount(updated?.itemCount ?? 0));
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyItem(null);
    }
  };

  const removeItem = async (productId) => {
    setBusyItem(productId);
    try {
      await cartService.remove(productId);
      const fresh = await cartService.get();
      dispatch(setCartCount(fresh?.itemCount ?? 0));
      toast.success(t('cart.removedToast'));
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyItem(null);
    }
  };

  const placeOrder = async () => {
    if (placing) return;
    setPlacing(true);
    try {
      await orderService.create({
        address: { ...address, notes },
        notes,
      });
      const fresh = await cartService.get();
      dispatch(setCartCount(fresh?.itemCount ?? 0));
      toast.success(t('cart.orderPlacedToast'));
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      navigate('/orders');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  };

  if (isError) {
    return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          title={t('cart.emptyTitle')}
          desc={t('cart.emptyDesc')}
        />
        <Link
          to="/store"
          className="btn-touch mt-4 block rounded-xl bg-primary px-6 py-3 text-center text-sm font-bold text-white hover:bg-primary-hover"
        >
          {t('cart.browseStore')}
        </Link>
      </div>
    );
  }

  const filled = Object.values(address).every((v) => v.trim());

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink sm:text-2xl">
        <ShoppingCart className="text-primary" /> {t('cart.title')}
      </h1>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Items */}
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => {
            const p = item.product;
            const qty = item.quantity;
            return (
              <Card key={p._id} className="flex gap-3">
                <img
                  src={p.image || '/favicon.svg'}
                  alt={pickLang(p.name, lang)}
                  className="h-20 w-20 shrink-0 rounded-xl bg-gray-100"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${p._id}`}
                    className="line-clamp-1 text-sm font-bold text-ink hover:text-primary"
                  >
                    {pickLang(p.name, lang)}
                  </Link>
                  <p className="text-sm text-muted">
                    {formatINR(p.price)} / {p.unit}
                  </p>
                  {p.stock < qty && (
                    <Badge tone="amber" className="mt-1">
                      {t('cart.onlyStock', { stock: p.stock })}
                    </Badge>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-xl border border-line">
                      <button
                        className="btn-touch px-3 font-bold text-ink"
                        disabled={busyItem === p._id}
                        onClick={() => updateQty(p._id, qty - 1)}
                        aria-label={t('cart.decrease')}
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-sm font-bold text-ink">
                        {busyItem === p._id ? <Spinner className="mx-auto scale-75" /> : qty}
                      </span>
                      <button
                        className="btn-touch px-3 font-bold text-ink"
                        disabled={busyItem === p._id || qty >= p.stock}
                        onClick={() => updateQty(p._id, qty + 1)}
                        aria-label={t('cart.increase')}
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-extrabold text-primary-hover">
                      {formatINR(p.price * qty)}
                    </span>
                    <button
                      className="btn-touch ml-auto flex items-center rounded-xl px-3 text-danger hover:bg-red-50"
                      disabled={busyItem === p._id}
                      onClick={() => removeItem(p._id)}
                      aria-label={t('cart.remove')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Order summary + delivery address */}
        <div className="space-y-3">
          <Card>
            <h2 className="text-base font-bold text-ink">{t('cart.summary')}</h2>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">{t('cart.subtotal')}</span>
              <span className="font-extrabold text-primary-hover">{formatINR(totalPrice)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{t('cart.codNote')}</p>
          </Card>

          <Card>
            <h2 className="text-base font-bold text-ink">{t('cart.addressTitle')}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                placeOrder();
              }}
              className="mt-3 space-y-3"
            >
              <Input
                label={t('cart.fullName')}
                required
                value={address.fullName}
                onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
              />
              <Input
                label={t('cart.phone')}
                type="tel"
                required
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              />
              <Input
                label={t('cart.street')}
                required
                value={address.street}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('cart.district')}
                  required
                  value={address.district}
                  onChange={(e) => setAddress({ ...address, district: e.target.value })}
                />
                <Input
                  label={t('cart.state')}
                  required
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                />
              </div>
              <Input
                label={t('cart.pincode')}
                type="number"
                required
                value={address.pincode}
                onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
              />
              <Input
                label={t('cart.notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button type="submit" disabled={placing || !filled} className="w-full">
                {placing ? <Spinner className="text-white" /> : t('cart.placeOrder')}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
