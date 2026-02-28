export default function ContentManagerLoading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-56 bg-gray-200 rounded-lg mb-2" />
      <div className="h-4 w-80 bg-gray-200 rounded-lg mb-6" />

      {/* Filter pills */}
      <div className="flex gap-2 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* Upload zone skeleton */}
      <div className="h-32 bg-white border-2 border-dashed border-gray-200 rounded-xl mb-6 flex items-center justify-center">
        <div className="space-y-2 flex flex-col items-center">
          <div className="h-10 w-10 bg-gray-200 rounded-lg" />
          <div className="h-4 w-40 bg-gray-200 rounded-lg" />
          <div className="h-3 w-28 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* 6 content item skeletons */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 bg-white border border-gray-100 rounded-xl p-4">
            <div className="h-20 bg-gray-200 rounded-lg mb-3" />
            <div className="h-4 w-3/4 bg-gray-200 rounded-lg mb-2" />
            <div className="h-3 w-1/2 bg-gray-200 rounded-lg mb-3" />
            <div className="flex justify-between items-center">
              <div className="h-3 w-16 bg-gray-200 rounded-lg" />
              <div className="h-3 w-20 bg-gray-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
