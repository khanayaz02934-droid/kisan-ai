import { Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EmptyState({ title, desc }) {
  const { t } = useTranslation();
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
        <Sprout size={28} />
      </span>
      <h3 className="mt-4 text-base font-bold text-ink">{title || t('common.noData')}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{desc || t('common.noDataDesc')}</p>
    </div>
  );
}
