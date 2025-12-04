export function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gold-100 rounded w-1/4 mb-6"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gold-50 border border-gold-100 rounded-lg"></div>
        ))}
      </div>
      <div className="h-64 bg-gold-50 border border-gold-100 rounded-lg mb-6"></div>
      <div className="h-96 bg-gold-50 border border-gold-100 rounded-lg"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="border border-gold-100 rounded-lg overflow-hidden shadow-sm">
        <div className="h-12 bg-gold-50"></div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 border-t border-gold-100 bg-white"></div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="animate-pulse bg-white border border-gold-100 rounded-lg p-6 shadow-sm">
      <div className="h-6 bg-gold-100 rounded w-1/3 mb-4"></div>
      <div className="h-64 bg-gold-50 rounded"></div>
    </div>
  );
}
