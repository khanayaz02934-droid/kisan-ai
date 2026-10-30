import { cx } from '../../utils/helpers';

export default function Input({ label, error, className = '', ...rest }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <input
        className={cx(
          'btn-touch w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20',
          error && 'border-danger',
          className
        )}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
