export default function InstallationsLoading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-56 bg-gray-200 rounded-lg mb-2" />
      <div className="h-4 w-80 bg-gray-200 rounded-lg mb-6" />

      {/* Search bar skeleton */}
      <div className="h-11 w-full bg-white border border-gray-100 rounded-xl mb-5" />

      {/* Tab pills */}
      <div className="flex gap-2 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-28 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* Installation card skeletons */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-4 w-48 bg-gray-200 rounded-lg" />
                  <div className="h-3 w-32 bg-gray-200 rounded-lg" />
                </div>
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
