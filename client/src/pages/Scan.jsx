import { useMemo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ScanLine,
  Camera,
  ImagePlus,
  RotateCcw,
  FlaskConical,
  AlertTriangle,
  Leaf,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import ErrorState from '../components/ui/ErrorState';
import { scanService } from '../services';
import { apiErrorMessage } from '../services/api';
import { pickLang, formatINR, formatDate } from '../utils/helpers';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB, must match backend multer limit
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const STAGES = [
  'Uploading image…',
  'AI is examining your crop…',
  'Matching expert advice…',
];

export default function Scan() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'hi' ? 'hi' : 'en';
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState(0);
  const [scan, setScan] = useState(null);
  const [error, setError] = useState('');

  // Clean up blob URLs so we never leak memory per preview.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const disclaimer = useMemo(
    () => pickLang(scan?.disclaimer, lang),
    [scan, lang]
  );

  const validateAndSet = (selected) => {
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error(t('scan.fileTypeError'));
      return;
    }
    if (selected.size > MAX_SIZE) {
      toast.error(t('scan.fileSizeError'));
      return;
    }
    setError('');
    setScan(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const onPick = (e) => {
    validateAndSet(e.target.files?.[0]);
    e.target.value = ''; // allow re-selecting the same file
  };

  const removeImage = () => {
    setFile(null);
    setScan(null);
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  };

  const analyze = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    setStage(0);
    setError('');
    setScan(null);
    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      6000
    );
    try {
      const data = await scanService.create(file);
      setScan(data);
      if (data?.scan?.status === 'COMPLETED') {
        toast.success(t('scan.successToast'));
      } else {
        toast.error(t('scan.needsReviewToast'));
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      clearInterval(ticker);
      setAnalyzing(false);
    }
  };

  const result = scan?.scan;
  // typeof null === 'object', so a null reviewMessage (always the case for
  // COMPLETED scans) passed the old object check and crashed on `.en`.
  // pickLang safely handles null/string/partial objects and falls back en↔hi.
  const reviewMessage = pickLang(result?.reviewMessage, lang);
  const confidence = result?.result?.confidence;

  // Symptom/treatment/prevention lists: prefer the current language, then
  // fall back to the other one so a partially translated AI result still
  // renders its full sections instead of silently dropping them.
  const localizedList = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    const list = Array.isArray(obj[lang])
      ? obj[lang]
      : Array.isArray(obj.en)
        ? obj.en
        : obj.hi;
    return Array.isArray(list) ? list : [];
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{t('scan.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('scan.subtitle')}</p>
      </div>

      {/* Step 1: pick / preview image */}
      {!previewUrl && !analyzing && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-light text-primary">
              <ScanLine size={32} />
            </span>
            <p className="text-sm text-muted">{t('scan.pickHint')}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => cameraInputRef.current?.click()}>
                <Camera size={18} /> {t('scan.takePhoto')}
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={18} /> {t('scan.choosePhoto')}
              </Button>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              <li>{t('scan.tip1')}</li>
              <li>{t('scan.tip2')}</li>
              <li>{t('scan.tip3')}</li>
            </ul>
          </div>
        </Card>
      )}

      {previewUrl && (
        <Card>
          <img
            src={previewUrl}
            alt={t('scan.previewAlt')}
            className="max-h-80 w-full rounded-xl"
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={analyze} disabled={analyzing} className="flex-1">
              <FlaskConical size={18} />
              {analyzing ? t('scan.analyzing') : t('scan.analyze')}
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
            >
              <RotateCcw size={18} /> {t('scan.retake')}
            </Button>
            <Button variant="danger" onClick={removeImage} disabled={analyzing}>
              {t('scan.remove')}
            </Button>
          </div>

          {analyzing && (
            <div className="mt-5 rounded-xl bg-primary-light px-4 py-4">
              <div className="flex items-center gap-3">
                <Spinner />
                <div className="flex-1">
                  <p className="text-sm font-bold text-primary-hover">{STAGES[stage]}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-green-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${((stage + 1) / STAGES.length) * 90 + 5}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Hidden inputs: camera (rear lens on mobile) + file picker */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onPick}
      />

      {/* Error state (never a fake diagnosis) */}
      {error && (
        <ErrorState message={error} onRetry={previewUrl ? analyze : undefined} />
      )}

      {/* Unclear / low-confidence: ask for another photo */}
      {result && result.status === 'NEEDS_REVIEW' && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 text-amber-600" size={22} />
            <div>
              <h3 className="text-sm font-bold text-amber-800">{t('scan.reviewTitle')}</h3>
              <p className="mt-1 text-sm text-amber-800">{reviewMessage}</p>
              <Button className="mt-3" variant="outline" onClick={removeImage}>
                {t('scan.retake')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Success result */}
      {result && result.status === 'COMPLETED' && result.result && (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">
                <Leaf size={12} className="mr-1" /> {pickLang(result.result.cropName, lang) || t('scan.crop')}
              </Badge>
              <Badge tone={result.result.isHealthy ? 'green' : 'red'}>
                {pickLang(result.result.disease, lang) || t('scan.disease')}
              </Badge>
              {typeof confidence === 'number' && (
                <Badge tone={confidence >= 0.6 ? 'blue' : 'amber'}>
                  {t('scan.confidence')}: {Math.round(confidence * 100)}%
                </Badge>
              )}
            </div>

            {result.result.isHealthy ? (
              <p className="mt-3 text-sm text-muted">{t('scan.healthyNote')}</p>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                {localizedList(result.result.symptoms).length > 0 && (
                  <div>
                    <h3 className="font-bold text-ink">{t('scan.symptoms')}</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                      {localizedList(result.result.symptoms).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {localizedList(result.result.treatment).length > 0 && (
                  <div>
                    <h3 className="font-bold text-ink">{t('scan.treatment')}</h3>
                    <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted">
                      {localizedList(result.result.treatment).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {localizedList(result.result.prevention).length > 0 && (
                  <div>
                    <h3 className="font-bold text-ink">{t('scan.prevention')}</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                      {localizedList(result.result.prevention).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-muted">
              ⚠️ {disclaimer}
            </p>
          </Card>

          {/* Recommended products straight from MongoDB */}
          <Card>
            <h3 className="text-base font-bold text-ink">{t('scan.productsTitle')}</h3>
            <p className="mt-1 text-xs text-muted">{t('scan.productsNote')}</p>
            {(result.matchedProducts?.length || 0) > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.matchedProducts.map((p) => (
                  <div
                    key={p._id}
                    className="flex gap-3 rounded-xl border border-line p-3"
                  >
                    <img
                      src={p.image || '/favicon.svg'}
                      alt={pickLang(p.name, lang)}
                      className="h-16 w-16 shrink-0 rounded-lg bg-gray-100"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {pickLang(p.name, lang)}
                      </p>
                      <p className="text-sm text-primary-hover">
                        {formatINR(p.price)} / {p.unit}
                      </p>
                      {p.stock > 0 ? (
                        <Badge tone="green" className="mt-1">
                          {t('store.inStock')}
                        </Badge>
                      ) : (
                        <Badge tone="red" className="mt-1">
                          {t('store.outOfStock')}
                        </Badge>
                      )}
                      <Link
                        to={`/product/${p._id}`}
                        className="mt-1 block text-xs font-bold text-primary hover:underline"
                      >
                        {t('scan.viewProduct')} →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">{t('scan.noProducts')}</p>
            )}
            <p className="mt-4 text-xs text-muted">🛡️ {t('scan.safetyNote')}</p>
          </Card>

          <p className="text-center text-xs text-muted">
            {t('scan.dateLabel')}: {formatDate(result.createdAt)}
          </p>
        </>
      )}
    </div>
  );
}
