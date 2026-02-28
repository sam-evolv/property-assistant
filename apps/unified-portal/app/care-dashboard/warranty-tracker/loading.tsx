export default function WarrantyTrackerLoading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-56 bg-gray-200 rounded-lg mb-2" />
      <div className="h-4 w-72 bg-gray-200 rounded-lg mb-6" />

      {/* Alert banner skeleton */}
      <div className="h-16 bg-white border border-gray-100 rounded-xl mb-6 p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-gray-200 rounded-lg" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-64 bg-gray-200 rounded-lg" />
            <div className="h-3 w-96 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-28 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* 6 warranty row skeletons */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-4 w-44 bg-gray-200 rounded-lg" />
                  <div className="h-3 w-28 bg-gray-200 rounded-lg" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-3 w-24 bg-gray-200 rounded-lg" />
                <div className="h-6 w-20 bg-gray-200 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
