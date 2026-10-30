import { cx } from '../../utils/helpers';

const tones = {
  green: 'bg-primary-light text-primary-hover',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-danger',
  gray: 'bg-gray-100 text-muted',
  blue: 'bg-blue-50 text-blue-700',
};

export default function Badge({ children, tone = 'gray', className = '' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        tones[tone] || tones.gray,
        className
      )}
    >
      {children}
    </span>
  );
}
