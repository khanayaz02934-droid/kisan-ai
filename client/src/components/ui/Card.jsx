import { cx } from '../../utils/helpers';

export default function Card({ children, className = '' }) {
  return <div className={cx('card p-4 sm:p-5', className)}>{children}</div>;
}
