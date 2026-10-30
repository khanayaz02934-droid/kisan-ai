import { Loader2 } from 'lucide-react';
import { cx } from '../../utils/helpers';

export default function Spinner({ className = '' }) {
  return (
    <span className={cx('inline-flex items-center justify-center', className)}>
      <Loader2 className="animate-spin text-primary" size={24} />
    </span>
  );
}
