export function SkeletonTableRow() {
  return (
    <div className="border-b p-4 space-y-2">
      <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
      <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4 space-y-3">
      <div className="h-5 bg-slate-200 rounded w-2/3 animate-pulse" />
      <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
      <div className="h-4 bg-slate-100 rounded w-4/5 animate-pulse" />
    </div>
  );
}

export function SkeletonGrid({ count = 6, cols = 3 }) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid ${gridCols[cols as keyof typeof gridCols]} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 8 }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </div>
  );
}
