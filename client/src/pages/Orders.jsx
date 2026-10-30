import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import { orderService, grainOrderService } from '../services';
import { apiErrorMessage } from '../services/api';
import { pickLang, formatINR, formatDate } from '../utils/helpers';

const statusTone = {
  PLACED: 'amber',
  CONFIRMED: 'blue',
  SHIPPED: 'blue',
  DISPATCHED: 'blue',
  DELIVERED: 'green',
  CANCELLED: 'red',
};

export default function Orders() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const [tab, setTab] = useState('product');
  const [page, setPage] = useState(1);

  const productQuery = useQuery({
    queryKey: ['orders', page],
    queryFn: () => orderService.myOrders({ page, limit: 10 }),
    enabled: tab === 'product',
    placeholderData: (prev) => prev,
  });

  const grainQuery = useQuery({
    queryKey: ['grainOrders', page],
    queryFn: () => grainOrderService.myOrders({ page, limit: 10 }),
    enabled: tab === 'grain',
    placeholderData: (prev) => prev,
  });

  const active = tab === 'product' ? productQuery : grainQuery;

  if (active.isError) {
    return <ErrorState message={apiErrorMessage(active.error)} onRetry={active.refetch} />;
  }

  const orders =
    tab === 'product' ? productQuery.data?.orders || [] : grainQuery.data?.orders || [];
  const pagination = tab === 'product' ? productQuery.data?.pagination : grainQuery.data?.pagination;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink sm:text-2xl">
        <Package className="text-primary" /> {t('orders.title')}
      </h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'product' ? 'primary' : 'outline'}
          onClick={() => {
            setTab('product');
            setPage(1);
          }}
        >
          {t('orders.productOrders')}
        </Button>
        <Button
          variant={tab === 'grain' ? 'primary' : 'outline'}
          onClick={() => {
            setTab('grain');
            setPage(1);
          }}
        >
          {t('orders.grainOrders')}
        </Button>
      </div>

      {active.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title={t('orders.emptyTitle')}
          desc={t('orders.emptyDesc')}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o._id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">
                    {t('orders.orderId')}: <span className="font-mono">{o._id.slice(-8)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {t('orders.placedOn')}: {formatDate(o.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[o.status] || 'gray'}>{o.status}</Badge>
                  <span className="text-sm font-extrabold text-primary-hover">
                    {formatINR(o.totalPrice)}
                  </span>
                </div>
              </div>

              {/* Product order items */}
              {tab === 'product' && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {o.items.map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl border border-line p-2"
                    >
                      <img
                        src={it.image || '/favicon.svg'}
                        alt={pickLang(it.name, lang)}
                        className="h-12 w-12 rounded-lg bg-gray-100"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {pickLang(it.name, lang)}
                        </p>
                        <p className="text-xs text-muted">
                          {it.quantity} × {formatINR(it.price)}
                        </p>
                      </div>
                      {o.status === 'PLACED' && (
                        <Link
                          to={`/product/${it.product}`}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          {t('orders.viewProduct')}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Grain order info */}
              {tab === 'grain' && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
                  <p className="font-bold text-ink">
                    {pickLang(o.grainName, lang)} · {o.quantityQuintal} {t('mandi.quintal')} ×{' '}
                    {formatINR(o.pricePerQuintal)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t('cart.addressTitle')}: {o.address?.fullName}, {o.address?.street},{' '}
                    {o.address?.district}, {o.address?.state} - {o.address?.pincode}
                  </p>
                </div>
              )}

              {o.notes && <p className="mt-2 text-xs text-muted">📝 {o.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <Pagination page={pagination?.page || page} pages={pagination?.pages || 1} onChange={setPage} />
    </div>
  );
}
