import { useTranslation } from 'react-i18next';
import { Leaf } from 'lucide-react';

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-12 border-t border-line bg-gray-50 pb-24 md:pb-8">
      <div className="container-page flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
            <Leaf size={18} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-ink">
              Kisan <span className="text-primary">AI</span>
            </p>
            <p className="text-xs text-muted">{t('footer.tagline')}</p>
          </div>
        </div>
        <p className="text-xs text-muted">© 2026 Kisan AI. {t('footer.rights')}</p>
      </div>
    </footer>
  );
}
