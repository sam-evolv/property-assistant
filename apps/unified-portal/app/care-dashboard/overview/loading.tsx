export default function OverviewLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg mb-6" />
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-white border border-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-24 bg-white border border-gray-100 rounded-xl mb-6" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 bg-white border border-gray-100 rounded-xl" />
        <div className="h-64 bg-white border border-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
