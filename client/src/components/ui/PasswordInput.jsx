import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cx } from '../../utils/helpers';

/**
 * Password input with a show/hide toggle.
 * - Hidden by default; the eye icon reveals it, clicking again hides it.
 * - Works on mobile and desktop (icon is inside a touch-friendly button).
 * - Forwards every other prop (value, onChange, required, minLength, error…)
 *   to the underlying <input>, so form validation is unchanged.
 */
export default function PasswordInput({ label, error, className = '', ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <span className="relative block">
        <input
          type={visible ? 'text' : 'password'}
          className={cx(
            'btn-touch w-full rounded-xl border border-line bg-white px-4 pr-11 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20',
            error && 'border-danger',
            className
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:text-primary focus:outline-none"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
