export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">✅ Test Page Working</h1>
        <p className="text-gray-700">
          If you can see this page without errors, the basic Next.js app is functioning correctly.
        </p>
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800 font-medium">Server-side rendering: OK</p>
        </div>
      </div>
    </div>
  );
}
