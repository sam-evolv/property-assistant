'use client';

import { useState } from 'react';
import { Plug, Check, Globe, Mail, HardDrive, Database, Zap, Link2, Clock, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';
const tokens = { gold: '#D4AF37', goldDark: '#B8934C', cream: '#fafaf8', dark: '#1a1a1a' };

const INTEGRATIONS = [
  { name: 'Daft.ie', desc: 'Enquiry syncing', icon: Globe },
  { name: 'MyHome.ie', desc: 'Property listings', icon: Globe },
  { name: 'Microsoft Outlook', desc: 'Email & calendar', icon: Mail },
  { name: 'Google Drive', desc: 'Document storage', icon: HardDrive },
  { name: 'Salesforce', desc: 'CRM sync', icon: Database },
  { name: 'Property Register', desc: 'Sales verification', icon: Database },
  { name: 'Zapier', desc: 'Workflow automation', icon: Zap },
  { name: 'OpenHouse MCP', desc: 'AI tool integration', icon: Link2 },
];

export default function AgentDashboardDataIntegrationsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-full" style={{ backgroundColor: tokens.cream }}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Data & Integrations</h1>
        <p className="text-sm text-gray-500 mb-6">Connect your tools and data sources</p>

        <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 px-5 py-3 mb-6">
          <span className="text-sm text-gray-500 flex items-center gap-2"><Plug className="w-4 h-4 text-gray-400" /> 0 integrations connected</span>
          <span className="w-px h-4 bg-gray-200" />
          <span className="text-sm text-green-600 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Ready to connect</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Available Integrations</h3></div>
            {INTEGRATIONS.map((integ, i) => {
              const Icon = integ.icon;
              return (
                <div key={integ.name} onClick={() => setSelected(integ.name)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50/50 ${i < INTEGRATIONS.length - 1 ? 'border-b border-gray-50' : ''} ${selected === integ.name ? 'bg-gray-50' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-gray-500" /></div>
                  <div className="flex-1"><p className="text-sm font-medium text-gray-900">{integ.name}</p><p className="text-xs text-gray-500">{integ.desc}</p></div>
                  <button className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors">Connect</button>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">{selected || 'Select an integration'}</h3></div>
              <div className="p-5 text-center">
                {selected ? <p className="text-sm text-gray-500 mb-3">Connect {selected} to start syncing data.</p> : <p className="text-sm text-gray-400">Click an integration to view details</p>}
                {selected && <button className="px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ backgroundColor: tokens.gold }}>Connect</button>}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">API Access</h3></div>
              {[{ name: 'REST API', desc: 'Programmatic access' }, { name: 'Webhooks', desc: 'Event notifications' }, { name: 'OpenHouse MCP', desc: 'AI tool integration' }].map((api, i) => (
                <div key={api.name} className={`flex items-center justify-between px-5 py-3 ${i < 2 ? 'border-b border-gray-50' : ''}`}>
                  <div><p className="text-sm font-medium text-gray-900">{api.name}</p><p className="text-xs text-gray-500">{api.desc}</p></div>
                  <button className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors">Configure</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
