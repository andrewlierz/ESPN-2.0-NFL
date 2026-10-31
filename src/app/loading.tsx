export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 animate-pulse rounded bg-card-2" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-line bg-card" />
        ))}
      </div>
      <p className="text-sm text-muted">Loading the latest NFL data… the first load after a restart can take a few seconds.</p>
    </div>
  );
}
