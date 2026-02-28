export default function DiagnosticFlowsLoading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-56 bg-gray-200 rounded-lg mb-6" />

      {/* 4 stat card skeletons */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-white border border-gray-100 rounded-xl p-4">
            <div className="h-3 w-20 bg-gray-200 rounded-lg mb-3" />
            <div className="h-7 w-16 bg-gray-200 rounded-lg mb-2" />
            <div className="h-3 w-24 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>

      {/* 5 flow card skeletons */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-5 w-48 bg-gray-200 rounded-lg" />
                  <div className="h-3 w-72 bg-gray-200 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-gray-200 rounded-lg" />
                <div className="h-6 w-16 bg-gray-200 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-4 mt-2">
              <div className="h-3 w-24 bg-gray-200 rounded-lg" />
              <div className="h-3 w-20 bg-gray-200 rounded-lg" />
              <div className="h-3 w-28 bg-gray-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
