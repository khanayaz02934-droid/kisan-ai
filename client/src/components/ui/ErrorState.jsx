import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from './Button';

export default function ErrorState({ message, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-danger">
        <AlertTriangle size={28} />
      </span>
      <h3 className="mt-4 text-base font-bold text-ink">{t('common.errorTitle')}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} className="mt-4">
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
