import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ScanLine, TrendingUp, Store, Wheat, Leaf } from 'lucide-react';
import Card from '../components/ui/Card';

export default function Home() {
  const { t } = useTranslation();
  const features = [
    { icon: ScanLine, title: t('home.fScanT'), desc: t('home.fScanD'), to: '/scan' },
    { icon: Store, title: t('home.fStoreT'), desc: t('home.fStoreD'), to: '/store' },
    { icon: TrendingUp, title: t('home.fMandiT'), desc: t('home.fMandiD'), to: '/mandi' },
    { icon: Wheat, title: t('home.fGrainT'), desc: t('home.fGrainD'), to: '/grain' },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-primary-light border border-primary/20">
        <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary-hover shadow-soft">
              <Leaf size={14} />
              {t('home.heroBadge')}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight text-ink sm:text-4xl lg:text-5xl">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">{t('home.heroSubtitle')}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/scan" className="btn-touch inline-flex items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-white hover:bg-primary-hover">
                <ScanLine size={18} className="mr-2" />
                {t('home.ctaScan')}
              </Link>
              <Link to="/mandi" className="btn-touch inline-flex items-center justify-center rounded-xl border border-primary/30 bg-white px-6 text-sm font-bold text-primary-hover hover:bg-green-50">
                <TrendingUp size={18} className="mr-2" />
                {t('home.ctaMandi')}
              </Link>
            </div>
          </div>
          <div className="hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=600&fit=crop"
              alt="Farm"
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lift"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-extrabold text-ink sm:text-2xl">{t('home.featuresTitle')}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc, to }) => (
            <Link key={to} to={to}>
              <Card className="h-full hover:-translate-y-0.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <Icon size={24} />
                </span>
                <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-muted">{desc}</p>
                <span className="mt-3 inline-block text-sm font-bold text-primary">{t('common.viewAll')} →</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
