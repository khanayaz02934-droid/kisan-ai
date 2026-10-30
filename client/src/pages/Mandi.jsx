import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TrendingUp, RefreshCw, Database } from 'lucide-react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import Table from '../components/ui/Table';
import { mandiService } from '../services';
import { apiErrorMessage } from '../services/api';
import { pickLang, formatINR, formatDate } from '../utils/helpers';

export default function Mandi() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [commodity, setCommodity] = useState('');
  const [page, setPage] = useState(1);

  // Apply filters only on submit so users control when expensive queries run.
  const [applied, setApplied] = useState({});
  const applyFilters = (e) => {
    e.preventDefault();
    const next = { state: state.trim(), district: district.trim(), commodity: commodity.trim() };
    // Strip empty values from the request
    Object.keys(next).forEach((k) => !next[k] && delete next[k]);
    setApplied(next);
    setPage(1);
  };

  const params = { ...applied, page, limit: 30 };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['mandi', params],
    queryFn: () => mandiService.list(params),
    keepPreviousData: true,
  });

  const prices = data?.prices || [];

  // Suggest states from currently loaded records (render-time derivation).
  const stateSuggestions = [...new Set(prices.map((p) => p.state).filter(Boolean))].slice(0, 50);

  const sourceLabel = () => {
    if (!data) return null;
    if (data.isLive) return t('mandi.sourceLive');
    if (data.isSeedData) return t('mandi.sourceSeed');
    if (data.source === 'cache_fallback') return t('mandi.sourceFallback');
    if (data.source === 'cache') return t('mandi.sourceCache');
    return null;
  };

  const columns = [
    {
      key: 'commodity',
      label: t('mandi.commodity'),
      render: (r) => (
        <span className="font-bold text-ink">
          {pickLang(r.commodity, lang)}
          {r.variety ? ` (${r.variety})` : ''}
        </span>
      ),
    },
    {
      key: 'market',
      label: t('mandi.market'),
      render: (r) => (
        <span>
          {r.market || '—'}
          <span className="block text-xs text-muted">
            {r.district}
            {r.state ? `, ${r.state}` : ''}
          </span>
        </span>
      ),
    },
    { key: 'minPrice', label: t('mandi.minPrice'), render: (r) => formatINR(r.minPrice) },
    { key: 'maxPrice', label: t('mandi.maxPrice'), render: (r) => formatINR(r.maxPrice) },
    {
      key: 'modalPrice',
      label: t('mandi.modalPrice'),
      render: (r) => (
        <span className="font-bold text-primary-hover">{formatINR(r.modalPrice)}</span>
      ),
    },
    {
      key: 'date',
      label: t('mandi.date'),
      render: (r) => <span className="text-xs text-muted">{r.date || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink sm:text-2xl">
          <TrendingUp className="text-primary" /> {t('mandi.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">{t('mandi.subtitle')}</p>
        <p className="mt-1 text-xs text-muted">{t('mandi.priceUnitNote')}</p>
      </div>

      {/* Filters */}
      <Card>
        <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-4">
          <Input
            label={t('mandi.state')}
            placeholder={t('mandi.statePlaceholder')}
            value={state}
            onChange={(e) => setState(e.target.value)}
            list="mandi-states"
          />
          <datalist id="mandi-states">
            {stateSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Input
            label={t('mandi.district')}
            placeholder={t('mandi.districtPlaceholder')}
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
          <Input
            label={t('mandi.commodity')}
            placeholder={t('mandi.commodityPlaceholder')}
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
          />
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1">
              {t('common.search')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="px-3"
              onClick={() => {
                setState('');
                setDistrict('');
                setCommodity('');
                setApplied({});
                setPage(1);
              }}
              aria-label={t('common.cancel')}
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </form>
      </Card>

      {/* Data source + freshness — always visible, never claims fake liveness */}
      {data && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge tone={data.isLive ? 'green' : 'amber'}>
            <Database size={12} className="mr-1" />
            {sourceLabel()}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            {isFetching ? (
              <Spinner className="scale-75" />
            ) : (
              <>
                {data.latestDate && (
                  <>
                    {t('mandi.marketDate')}: <strong>{formatDate(data.latestDate)}</strong> ·
                  </>
                )}
                {data.lastUpdated && (
                  <>
                    {t('mandi.lastUpdated')}: <strong>{formatDate(data.lastUpdated)}</strong>
                  </>
                )}
              </>
            )}
          </span>
        </div>
      )}

      {data?.note && (
        <Card className="border-amber-300 bg-amber-50 py-3">
          <p className="text-sm font-semibold text-amber-800">
            {typeof data.note === 'string' ? data.note : data.note[lang] || data.note.en}
          </p>
          {data.isSeedData && (
            <p className="mt-1 text-xs text-amber-700">{t('mandi.seedNote')}</p>
          )}
        </Card>
      )}

      {/* Results */}
      {isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : prices.length === 0 ? (
        <EmptyState title={t('mandi.noPrices')} desc={t('mandi.noPricesDesc')} />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="p-4 text-xs font-semibold text-muted sm:p-5">
            ₹ / {t('mandi.quintal')}
          </div>
          <div className="px-2 sm:px-4">
            <Table
              columns={columns}
              rows={prices}
              renderMobile={(r) => (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {pickLang(r.commodity, lang)}
                        {r.variety ? ` (${r.variety})` : ''}
                      </p>
                      <p className="text-xs text-muted">
                        {r.market || ''} {r.district && `· ${r.district}`}
                      </p>
                      <p className="text-xs text-muted">{r.date}</p>
                    </div>
                    <Badge tone={r.source === 'SEED' ? 'amber' : 'gray'}>
                      {formatDate(r.date)}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-2 text-center">
                    <div>
                      <p className="text-[11px] text-muted">{t('mandi.minPrice')}</p>
                      <p className="text-sm font-semibold text-ink">{formatINR(r.minPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted">{t('mandi.maxPrice')}</p>
                      <p className="text-sm font-semibold text-ink">{formatINR(r.maxPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted">{t('mandi.modalPrice')}</p>
                      <p className="text-sm font-extrabold text-primary-hover">
                        {formatINR(r.modalPrice)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            />
          </div>
        </Card>
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />
    </div>
  );
}
