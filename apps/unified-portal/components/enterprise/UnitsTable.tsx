export function UnitsTable() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-semibold text-white">Units</h2>
        <p className="text-sm text-gray-400 mt-1">Phase 2 Placeholder</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Unit Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Development</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">House Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                No data - Component shell ready for Phase 3+ integration
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
