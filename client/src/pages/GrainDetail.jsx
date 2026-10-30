import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowLeft, Wheat } from 'lucide-react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import { grainService, grainOrderService } from '../services';
import { apiErrorMessage } from '../services/api';
import { pickLang, formatINR } from '../utils/helpers';

export default function GrainDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((s) => s.auth);

  const { data: grain, isLoading, isError, error } = useQuery({
    queryKey: ['grain', id],
    queryFn: () => grainService.getById(id),
    retry: false,
  });

  const [qty, setQty] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    street: '',
    district: '',
    state: '',
    pincode: '',
    notes: '',
  });
  const [placing, setPlacing] = useState(false);

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
          message={apiErrorMessage(error, t('grain.notFound'))}
          onRetry={() => navigate('/grain')}
        />
      </div>
    );
  }

  const placeOrder = async (e) => {
    e.preventDefault();
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) {
      toast.error(t('grain.invalidQty'));
      return;
    }
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setPlacing(true);
    try {
      await grainOrderService.create({
        grainId: grain._id,
        quantityQuintal: quantity,
        address: {
          fullName: form.fullName,
          phone: form.phone,
          street: form.street,
          district: form.district,
          state: form.state,
          pincode: form.pincode,
        },
        notes: form.notes,
      });
      toast.success(t('grain.orderPlacedToast'));
      navigate('/orders');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/grain"
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft size={16} /> {t('grain.backToMarket')}
      </Link>

      <Card>
        <div className="grid gap-6 md:grid-cols-2">
          <img
            src={grain.images?.[0] || '/favicon.svg'}
            alt={pickLang(grain.name, lang)}
            className="aspect-video w-full rounded-2xl bg-gray-100"
          />
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">{grain.type}</Badge>
              {grain.isOrganic && <Badge tone="green">🌿 {t('grain.organic')}</Badge>}
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-extrabold text-ink">
              <Wheat className="text-primary" size={22} /> {pickLang(grain.name, lang)}
            </h1>
            {grain.variety && <p className="text-sm text-muted">{grain.variety}</p>}
            <p className="mt-2 text-2xl font-extrabold text-primary-hover">
              {formatINR(grain.pricePerQuintal)}
              <span className="text-sm text-muted"> / {t('mandi.quintal')}</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              {t('grain.available')}: <strong>{grain.availableQuintal}</strong> {t('mandi.quintal')}
              {' · '}
              {t('grain.minOrder')}: <strong>{grain.minOrderQuintal}</strong> {t('mandi.quintal')}
            </p>
            <p className="mt-1 text-sm text-muted">
              📍 {grain.location}
              {grain.seller?.name ? ` · ${t('grain.seller')}: ${grain.seller.name}` : ''}
            </p>
            {(grain.description?.en || grain.description?.hi) && (
              <p className="mt-3 text-sm leading-6 text-muted">
                {pickLang(grain.description, lang)}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Order form (protected — server enforces auth) */}
      {grain.availableQuintal > 0 ? (
        <Card>
          <h2 className="text-base font-bold text-ink">{t('grain.orderTitle')}</h2>
          {!isAuthenticated ? (
            <p className="mt-2 text-sm text-muted">
              {t('grain.loginToOrder')}{' '}
              <Link to="/login" className="font-bold text-primary hover:underline">
                {t('nav.login')}
              </Link>
            </p>
          ) : (
            <form onSubmit={placeOrder} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                label={`${t('common.quantity')} (${t('mandi.quintal')})`}
                type="number"
                step="0.1"
                min={grain.minOrderQuintal}
                max={grain.availableQuintal}
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={`≥ ${grain.minOrderQuintal}`}
              />
              <Input
                label={t('cart.fullName')}
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <Input
                label={t('cart.phone')}
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                label={t('cart.street')}
                required
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
              />
              <Input
                label={t('cart.district')}
                required
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
              <Input
                label={t('cart.state')}
                required
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
              <Input
                label={t('cart.pincode')}
                type="number"
                required
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
              <div className="sm:col-span-2">
                <Input
                  label={t('cart.notes')}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={placing} className="w-full sm:w-auto">
                  {placing ? (
                    <Spinner className="text-white" />
                  ) : (
                    t('grain.placeOrder')
                  )}
                </Button>
              </div>
            </form>
          )}
        </Card>
      ) : (
        <EmptyState title={t('grain.soldOut')} desc={t('grain.checkBack')} />
      )}
    </div>
  );
}
