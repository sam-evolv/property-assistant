export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">OpenHouse AI</h1>
            <div className="flex gap-4">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900">Contact</a>
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            OpenHouse AI Platform
          </h2>
          <p className="text-2xl text-gray-600 mb-8">
            Marketing Shell
          </p>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto">
            AI-powered property information assistant for modern developments. 
            Empower your residents with instant answers, 24/7.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-4xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold mb-2">Multi-Tenant SaaS</h3>
            <p className="text-gray-600">
              Isolated knowledge bases for each property development with dedicated AI training pipelines.
            </p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">RAG-Powered AI</h3>
            <p className="text-gray-600">
              Leveraging GPT-4 and vector embeddings for accurate, context-aware responses.
            </p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">Document Management</h3>
            <p className="text-gray-600">
              Upload PDFs, Word docs, and more to build comprehensive property knowledge bases.
            </p>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-8 text-center">
          <p className="text-gray-700 mb-2">
            <strong>Note:</strong> This is a placeholder marketing site created as part of the monorepo structure.
          </p>
          <p className="text-gray-600 text-sm">
            Future development will include full feature descriptions, pricing plans, customer testimonials, and contact forms.
          </p>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-8 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gray-400">
            © 2025 OpenHouse AI Platform. Part of the OpenHouse AI monorepo structure.
          </p>
        </div>
      </footer>
    </div>
  );
}
