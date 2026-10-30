import { cx } from '../../utils/helpers';

export default function Button({
  children,
  variant = 'primary',
  className = '',
  disabled,
  ...rest
}) {
  const styles = {
    primary: 'bg-primary text-white hover:bg-primary-hover disabled:bg-gray-300',
    secondary: 'bg-primary-light text-primary-hover border border-primary/30 hover:bg-green-100',
    outline: 'bg-white text-ink border border-line hover:border-primary hover:text-primary-hover',
    danger: 'bg-danger text-white hover:opacity-90',
  };
  return (
    <button
      className={cx(
        'btn-touch inline-flex items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed',
        styles[variant] || styles.primary,
        className
      )}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
