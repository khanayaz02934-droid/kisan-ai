import { cx } from '../../utils/helpers';

export function Skeleton({ className = '' }) {
  return <div className={cx('animate-pulse rounded-xl bg-gray-100', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="card p-4">
      <Skeleton className="aspect-[4/3] w-full" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-3 h-11 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
