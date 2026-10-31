import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Wheat, Leaf } from 'lucide-react';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import { Skeleton } from '../components/ui/Skeleton';
import { grainService } from '../services';
import { apiErrorMessage } from '../services/api';
import { pickLang, formatINR } from '../utils/helpers';

// Must match the `type` enum in server/models/grainModel.js exactly.
const GRAIN_TYPES = ['RICE', 'WHEAT', 'MAIZE', 'PULSES', 'MILLETS', 'OILSEEDS', 'BARLEY', 'SORGHUM', 'OTHER'];

export default function Grain() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const [type, setType] = useState('');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [page, setPage] = useState(1);

  const params = { page, limit: 12 };
  if (type) params.type = type;
  if (organicOnly) params.isOrganic = 'true';

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['grains', params],
    queryFn: () => grainService.list(params),
    placeholderData: (prev) => prev,
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-md">
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink sm:text-2xl">
          <Wheat className="text-primary" /> {t('grain.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">{t('grain.subtitle')}</p>
        <p className="mt-1 text-xs text-muted">{t('grain.priceUnitNote')}</p>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label={t('grain.type')}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('grain.allTypes')}</option>
            {GRAIN_TYPES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
          <label className="flex cursor-pointer items-end gap-2 pb-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={organicOnly}
              onChange={(e) => {
                setOrganicOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 accent-green-600"
            />
            <Leaf size={16} className="text-primary" /> {t('grain.organicOnly')}
          </label>
          {isFetching && <span className="self-end pb-3"><Spinner /></span>}
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (data?.grains || []).length === 0 ? (
        <EmptyState title={t('grain.noGrains')} desc={t('common.noDataDesc')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.grains.map((g) => (
            <Card key={g._id} className="flex flex-col">
              <Link to={`/grain/${g._id}`}>
                <img
                  src={g.images?.[0] || '/favicon.svg'}
                  alt={pickLang(g.name, lang)}
                  className="aspect-video w-full rounded-xl bg-gray-100"
                />
              </Link>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge tone="blue">{g.type}</Badge>
                {g.isOrganic && <Badge tone="green">🌿 {t('grain.organic')}</Badge>}
              </div>
              <Link to={`/grain/${g._id}`}>
                <h3 className="mt-2 text-sm font-bold text-ink hover:text-primary">
                  {pickLang(g.name, lang)}
                </h3>
              </Link>
              {g.variety && <p className="text-xs text-muted">{g.variety}</p>}
              <p className="mt-1 font-extrabold text-primary-hover">
                {formatINR(g.pricePerQuintal)}
                <span className="text-xs text-muted"> / {t('mandi.quintal')}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {t('grain.available')}: <strong>{g.availableQuintal}</strong> {t('mandi.quintal')} ·{' '}
                {g.location}
              </p>
              <Link
                to={`/grain/${g._id}`}
                className="mt-3 block text-center text-sm font-bold text-primary hover:underline"
              >
                {t('grain.viewDetails')} →
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={data?.pagination?.page || page}
        pages={data?.pagination?.pages || 1}
        onChange={setPage}
      />
    </div>
  );
}
