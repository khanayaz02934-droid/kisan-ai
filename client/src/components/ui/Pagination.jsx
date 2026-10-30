import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

export default function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <Button
        variant="outline"
        className="px-3"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={18} />
      </Button>
      <span className="text-sm font-semibold text-ink">
        {page} / {pages}
      </span>
      <Button
        variant="outline"
        className="px-3"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={18} />
      </Button>
    </div>
  );
}
