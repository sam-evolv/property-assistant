export function LazyLoadFallback() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 animate-pulse">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-gold-100 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gold-50 rounded w-1/2"></div>
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 bg-gold-100 rounded w-1/2"></div>
                <div className="h-10 w-10 bg-gold-50 rounded-full"></div>
              </div>
              <div className="h-8 bg-gold-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm">
          <div className="h-6 bg-gold-100 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gold-50 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
