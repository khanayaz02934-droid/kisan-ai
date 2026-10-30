import EmptyState from '../components/ui/EmptyState';

export default function Placeholder({ title }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-extrabold text-ink sm:text-2xl">{title}</h1>
      <EmptyState title={title} desc="Phase 1 foundation is ready. Feature UI comes in the next phase." />
    </div>
  );
}
