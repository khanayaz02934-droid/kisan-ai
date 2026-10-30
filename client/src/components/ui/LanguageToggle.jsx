import { useDispatch, useSelector } from 'react-redux';
import { setLanguage } from '../../redux/slices/languageSlice';
import { cx } from '../../utils/helpers';

export default function LanguageToggle({ className = '' }) {
  const lang = useSelector((s) => s.language?.lang || 'en');
  const dispatch = useDispatch();

  const btn = (value, label) => (
    <button
      key={value}
      onClick={() => dispatch(setLanguage(value))}
      className={cx(
        'btn-touch rounded-lg px-3 text-sm font-bold transition',
        lang === value ? 'bg-primary text-white shadow' : 'text-muted hover:text-ink'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cx('flex items-center gap-1 rounded-xl bg-gray-100 p-1', className)}>
      {btn('en', 'EN')}
      {btn('hi', 'हिन्दी')}
    </div>
  );
}
