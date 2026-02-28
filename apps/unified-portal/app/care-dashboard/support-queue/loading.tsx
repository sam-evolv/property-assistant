export default function SupportQueueLoading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-52 bg-gray-200 rounded-lg mb-6" />

      {/* 4 stat card skeletons in a row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-white border border-gray-100 rounded-xl p-4">
            <div className="h-3 w-20 bg-gray-200 rounded-lg mb-3" />
            <div className="h-7 w-16 bg-gray-200 rounded-lg mb-2" />
            <div className="h-3 w-24 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Filter pills skeleton */}
      <div className="flex gap-2 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* 3 ticket card skeletons */}
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-2">
                <div className="h-5 w-64 bg-gray-200 rounded-lg" />
                <div className="h-3 w-40 bg-gray-200 rounded-lg" />
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded-lg" />
            </div>
            <div className="h-4 w-full bg-gray-200 rounded-lg mb-2" />
            <div className="h-4 w-3/4 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
