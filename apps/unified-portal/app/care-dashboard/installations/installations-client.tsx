'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Sun,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Download,
  Plus,
  MapPin,
  Phone,
  Mail,
  Zap,
  Activity,
  Clock,
  ArrowUpDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthStatus = 'healthy' | 'issue' | 'pending';
type PortalStatus = 'Active' | 'Pending' | 'Inactive';
type Source = 'Dev' | 'Private';
type ViewTab = 'status' | 'region' | 'timeline' | 'table';

interface Installation {
  id: string;
  jobRef: string;
  firstName: string;
  lastName: string;
  address: string;
  region: string;
  systemSize: number;
  systemType: string;
  inverter: string;
  installedDate: string;
  portalStatus: PortalStatus;
  health: HealthStatus;
  source: Source;
  email: string;
  phone: string;
  lastActivity: string;
  issueDetail?: string;
  activityTimeline: { message: string; time: string; dotColor: string }[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InstallationsProps {
  installations?: Installation[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Demo Data — fallback if no props provided
// ---------------------------------------------------------------------------

const defaultInstallations: Installation[] = [
  {
    id: '1',
    jobRef: 'SE-2025-1198',
    firstName: 'Siobhán',
    lastName: 'Kelleher',
    address: '14 Orchard Lane, Ballincollig, Cork',
    region: 'Cork County',
    systemSize: 6.15,
    systemType: '15-Panel Roof Mount',
    inverter: 'SolarEdge SE6000H',
    installedDate: '2025-09-14',
    portalStatus: 'Active',
    health: 'issue',
    source: 'Dev',
    email: 'siobhan.kelleher@email.ie',
    phone: '+353 87 123 4567',
    lastActivity: '14 min ago',
    issueDetail: 'Inverter fault — error code E0x31. Escalation #412 raised.',
    activityTimeline: [
      { message: 'Escalation #412 created — inverter fault', time: '14 min ago', dotColor: 'bg-red-500' },
      { message: 'Customer reported no generation', time: '1 hour ago', dotColor: 'bg-amber-500' },
      { message: 'Portal login', time: '2 hours ago', dotColor: 'bg-blue-500' },
      { message: 'System installed', time: 'Sep 14, 2025', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '2',
    jobRef: 'SE-2025-1142',
    firstName: 'Dermot',
    lastName: 'Crowley',
    address: '8 Marine Terrace, Crosshaven, Cork',
    region: 'Cork County',
    systemSize: 4.92,
    systemType: '12-Panel Roof Mount',
    inverter: 'Huawei SUN2000-5KTL',
    installedDate: '2025-08-22',
    portalStatus: 'Active',
    health: 'issue',
    source: 'Dev',
    email: 'dermot.crowley@email.ie',
    phone: '+353 86 234 5678',
    lastActivity: '32 min ago',
    issueDetail: 'Generation 40% below expected — possible shading or panel issue.',
    activityTimeline: [
      { message: 'Low generation alert triggered', time: '32 min ago', dotColor: 'bg-amber-500' },
      { message: 'AI diagnostic initiated', time: '45 min ago', dotColor: 'bg-blue-500' },
      { message: 'Customer contacted via portal', time: '1 hour ago', dotColor: 'bg-emerald-500' },
      { message: 'System installed', time: 'Aug 22, 2025', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '3',
    jobRef: 'SE-2026-0341',
    firstName: 'Eoghan',
    lastName: 'McCarthy',
    address: '22 Lakeview Drive, Carrigaline, Cork',
    region: 'Cork County',
    systemSize: 5.74,
    systemType: '14-Panel Roof Mount',
    inverter: 'SolarEdge SE5000H',
    installedDate: '2026-02-18',
    portalStatus: 'Pending',
    health: 'pending',
    source: 'Dev',
    email: 'eoghan.mccarthy@email.ie',
    phone: '+353 85 345 6789',
    lastActivity: '2 days ago',
    activityTimeline: [
      { message: 'Portal activation email sent', time: '2 days ago', dotColor: 'bg-blue-500' },
      { message: 'System commissioned', time: 'Feb 18, 2026', dotColor: 'bg-emerald-500' },
      { message: 'Installation completed', time: 'Feb 18, 2026', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '4',
    jobRef: 'SE-2025-0892',
    firstName: 'Róisín',
    lastName: 'Walsh',
    address: '6 Elm Court, Douglas, Cork',
    region: 'Cork City',
    systemSize: 3.69,
    systemType: '9-Panel Roof Mount',
    inverter: 'Fronius Primo 3.6',
    installedDate: '2025-06-30',
    portalStatus: 'Pending',
    health: 'pending',
    source: 'Private',
    email: 'roisin.walsh@email.ie',
    phone: '+353 87 456 7890',
    lastActivity: '5 days ago',
    activityTimeline: [
      { message: 'Second activation reminder sent', time: '5 days ago', dotColor: 'bg-amber-500' },
      { message: 'First activation email sent', time: 'Jul 5, 2025', dotColor: 'bg-blue-500' },
      { message: 'System installed', time: 'Jun 30, 2025', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '5',
    jobRef: 'SE-2025-1087',
    firstName: 'Pádraig',
    lastName: "O\u2019Sullivan",
    address: '31 Harbour View, Kinsale, Cork',
    region: 'Cork County',
    systemSize: 8.2,
    systemType: '20-Panel Roof Mount',
    inverter: 'SolarEdge SE8K',
    installedDate: '2025-07-19',
    portalStatus: 'Active',
    health: 'healthy',
    source: 'Dev',
    email: 'padraig.osullivan@email.ie',
    phone: '+353 86 567 8901',
    lastActivity: '2 hours ago',
    activityTimeline: [
      { message: 'Activated Care portal', time: '2 hours ago', dotColor: 'bg-emerald-500' },
      { message: 'Viewed Solar Panel Cleaning Guide', time: '3 hours ago', dotColor: 'bg-blue-500' },
      { message: 'System installed', time: 'Jul 19, 2025', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '6',
    jobRef: 'SE-2025-0756',
    firstName: 'Mary',
    lastName: 'Murphy',
    address: '9 Ashwood Park, Midleton, Cork',
    region: 'Cork County',
    systemSize: 5.33,
    systemType: '13-Panel Roof Mount',
    inverter: 'Huawei SUN2000-5KTL',
    installedDate: '2025-05-11',
    portalStatus: 'Active',
    health: 'healthy',
    source: 'Dev',
    email: 'mary.murphy@email.ie',
    phone: '+353 85 678 9012',
    lastActivity: '14 min ago',
    activityTimeline: [
      { message: 'Completed Inverter Error diagnostic — resolved', time: '14 min ago', dotColor: 'bg-emerald-500' },
      { message: 'Started diagnostic flow', time: '25 min ago', dotColor: 'bg-blue-500' },
      { message: 'System installed', time: 'May 11, 2025', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '7',
    jobRef: 'SE-2025-0643',
    firstName: 'Colm',
    lastName: 'Fitzgerald',
    address: '17 Castle Heights, Cobh, Cork',
    region: 'Cork County',
    systemSize: 4.1,
    systemType: '10-Panel Roof Mount',
    inverter: 'Fronius Primo 4.0',
    installedDate: '2025-04-03',
    portalStatus: 'Active',
    health: 'healthy',
    source: 'Private',
    email: 'colm.fitzgerald@email.ie',
    phone: '+353 87 789 0123',
    lastActivity: '32 min ago',
    activityTimeline: [
      { message: 'Asked: What does the green light mean?', time: '32 min ago', dotColor: 'bg-blue-500' },
      { message: 'Portal login', time: '35 min ago', dotColor: 'bg-gray-500' },
      { message: 'System installed', time: 'Apr 3, 2025', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '8',
    jobRef: 'SE-2026-0298',
    firstName: 'Brendan',
    lastName: 'Daly',
    address: '5 Riverside Walk, Fermoy, Cork',
    region: 'Cork County',
    systemSize: 6.56,
    systemType: '16-Panel Roof Mount',
    inverter: 'SolarEdge SE6000H',
    installedDate: '2026-02-05',
    portalStatus: 'Active',
    health: 'healthy',
    source: 'Dev',
    email: 'brendan.daly@email.ie',
    phone: '+353 86 890 1234',
    lastActivity: '3 hours ago',
    activityTimeline: [
      { message: 'Viewed Solar Panel Cleaning Guide', time: '3 hours ago', dotColor: 'bg-purple-500' },
      { message: 'Portal activation', time: 'Feb 6, 2026', dotColor: 'bg-emerald-500' },
      { message: 'System installed', time: 'Feb 5, 2026', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '9',
    jobRef: 'SE-2026-0315',
    firstName: 'Aoife',
    lastName: 'Brennan',
    address: '42 Hillcrest Road, Mallow, Cork',
    region: 'Cork County',
    systemSize: 7.38,
    systemType: '18-Panel Roof Mount',
    inverter: 'Huawei SUN2000-8KTL',
    installedDate: '2026-02-12',
    portalStatus: 'Active',
    health: 'healthy',
    source: 'Dev',
    email: 'aoife.brennan@email.ie',
    phone: '+353 85 901 2345',
    lastActivity: '1 day ago',
    activityTimeline: [
      { message: 'Portal login', time: '1 day ago', dotColor: 'bg-gray-500' },
      { message: 'Portal activated', time: 'Feb 13, 2026', dotColor: 'bg-emerald-500' },
      { message: 'System installed', time: 'Feb 12, 2026', dotColor: 'bg-emerald-500' },
    ],
  },
  {
    id: '10',
    jobRef: 'SE-2026-0367',
    firstName: 'Ciarán',
    lastName: "O\u2019Brien",
    address: '11 Meadow Lane, Bandon, Cork',
    region: 'Cork County',
    systemSize: 5.74,
    systemType: '14-Panel Roof Mount',
    inverter: 'SolarEdge SE5000H',
    installedDate: '2026-02-24',
    portalStatus: 'Active',
    health: 'healthy',
    source: 'Dev',
    email: 'ciaran.obrien@email.ie',
    phone: '+353 87 012 3456',
    lastActivity: '4 hours ago',
    activityTimeline: [
      { message: 'Viewed generation dashboard', time: '4 hours ago', dotColor: 'bg-blue-500' },
      { message: 'Portal activated', time: 'Feb 25, 2026', dotColor: 'bg-emerald-500' },
      { message: 'System installed', time: 'Feb 24, 2026', dotColor: 'bg-emerald-500' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Region data
// ---------------------------------------------------------------------------

interface RegionData {
  name: string;
  count: number;
  percentage: number;
  healthy: number;
  amber: number;
  red: number;
  gray: number;
}

function computeRegionData(installs: Installation[]): RegionData[] {
  const regions: Record<string, { healthy: number; issue: number; pending: number }> = {};
  installs.forEach((inst) => {
    const r = inst.region || 'Unknown';
    if (!regions[r]) regions[r] = { healthy: 0, issue: 0, pending: 0 };
    if (inst.health === 'healthy') regions[r].healthy++;
    else if (inst.health === 'issue') regions[r].issue++;
    else regions[r].pending++;
  });
  const total = installs.length || 1;
  return Object.entries(regions)
    .map(([name, data]) => {
      const count = data.healthy + data.issue + data.pending;
      return {
        name,
        count,
        percentage: Math.round((count / total) * 100),
        healthy: data.healthy,
        amber: 0,
        red: data.issue,
        gray: data.pending,
      };
    })
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`;
}

function getHealthColors(health: HealthStatus) {
  switch (health) {
    case 'healthy':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
    case 'issue':
      return { bg: 'bg-red-100', text: 'text-red-700' };
    case 'pending':
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

function getStatusBadge(status: PortalStatus) {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Inactive':
      return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

function getHealthDotColor(health: HealthStatus) {
  switch (health) {
    case 'healthy':
      return 'bg-emerald-500';
    case 'issue':
      return 'bg-red-500';
    case 'pending':
      return 'bg-gray-400';
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InstallationCard({
  inst,
  onClick,
}: {
  inst: Installation;
  onClick: () => void;
}) {
  const colors = getHealthColors(inst.health);
  const statusBadge = getStatusBadge(inst.portalStatus);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[10px] border border-gray-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-[#D4AF37] hover:shadow-md"
    >
      {/* Avatar */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${colors.bg} ${colors.text}`}
      >
        {getInitials(inst.firstName, inst.lastName)}
      </div>

      {/* Name + address */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {inst.firstName} {inst.lastName}
        </p>
        <p className="truncate text-xs text-gray-500">{inst.address}</p>
      </div>

      {/* System spec */}
      <div className="hidden flex-shrink-0 text-right sm:block">
        <p className="text-sm font-bold text-gray-900">{inst.systemSize.toFixed(2)} kWp</p>
        <p className="text-xs text-gray-500">{inst.inverter}</p>
      </div>

      {/* Status badge */}
      <span
        className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge}`}
      >
        {inst.portalStatus}
      </span>

      {/* Time */}
      <span className="hidden flex-shrink-0 whitespace-nowrap text-xs text-gray-400 md:inline">
        {inst.lastActivity}
      </span>

      {/* Chevron */}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
    </button>
  );
}

function CollapsibleSection({
  title,
  dotColor,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  dotColor: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {count}
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 text-gray-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
      </button>
      {isOpen && <div className="space-y-2">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function DetailPanel({
  inst,
  onClose,
}: {
  inst: Installation;
  onClose: () => void;
}) {
  const colors = getHealthColors(inst.health);
  const statusBadge = getStatusBadge(inst.portalStatus);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 flex h-full w-[500px] max-w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out animate-in slide-in-from-right">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-100 px-6 pb-6 pt-6">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold ${colors.bg} ${colors.text}`}
              >
                {getInitials(inst.firstName, inst.lastName)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  {inst.firstName} {inst.lastName}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">{inst.address}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge}`}
                  >
                    {inst.portalStatus}
                  </span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                    {inst.source}
                  </span>
                  <span className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                    <span className={`h-1.5 w-1.5 rounded-full ${getHealthDotColor(inst.health)}`} />
                    {inst.health === 'healthy' ? 'Healthy' : inst.health === 'issue' ? 'Issue' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
            {inst.issueDetail && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{inst.issueDetail}</p>
                </div>
              </div>
            )}
          </div>

          {/* System Details */}
          <div className="border-b border-gray-100 px-6 py-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              <Zap className="h-3.5 w-3.5" />
              System Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] font-medium text-gray-400">Job Ref</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-[#D4AF37]">
                  {inst.jobRef}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] font-medium text-gray-400">System Size</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {inst.systemSize.toFixed(2)} kWp
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] font-medium text-gray-400">System Type</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {inst.systemType}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] font-medium text-gray-400">Inverter</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {inst.inverter}
                </p>
              </div>
              <div className="col-span-2 rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] font-medium text-gray-400">Installed</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {formatDate(inst.installedDate)}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="border-b border-gray-100 px-6 py-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              <MapPin className="h-3.5 w-3.5" />
              Customer Info
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">{inst.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">{inst.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">{inst.address}</span>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="px-6 py-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              <Activity className="h-3.5 w-3.5" />
              Activity Timeline
            </h3>
            <div className="space-y-0">
              {inst.activityTimeline.map((event, idx) => (
                <div key={idx} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${event.dotColor}`}
                    />
                    {idx < inst.activityTimeline.length - 1 && (
                      <div className="mt-1 w-px flex-1 bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-sm text-gray-700">{event.message}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
            >
              Contact Customer
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c9a432] hover:shadow-md"
            >
              View Full Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: By Status
// ---------------------------------------------------------------------------

function StatusView({
  filtered,
  onSelect,
}: {
  filtered: Installation[];
  onSelect: (inst: Installation) => void;
}) {
  const needsAttention = filtered.filter((i) => i.health === 'issue');
  const notActivated = filtered.filter((i) => i.health === 'pending');
  const healthy = filtered.filter((i) => i.health === 'healthy');

  return (
    <div className="space-y-6">
      {needsAttention.length > 0 && (
        <CollapsibleSection title="Needs Attention" dotColor="bg-red-500" count={needsAttention.length}>
          {needsAttention.map((inst) => (
            <InstallationCard key={inst.id} inst={inst} onClick={() => onSelect(inst)} />
          ))}
        </CollapsibleSection>
      )}

      {notActivated.length > 0 && (
        <CollapsibleSection title="Not Activated" dotColor="bg-gray-400" count={notActivated.length}>
          {notActivated.map((inst) => (
            <InstallationCard key={inst.id} inst={inst} onClick={() => onSelect(inst)} />
          ))}
        </CollapsibleSection>
      )}

      {healthy.length > 0 && (
        <CollapsibleSection title="Healthy" dotColor="bg-emerald-500" count={healthy.length}>
          {healthy.map((inst) => (
            <InstallationCard key={inst.id} inst={inst} onClick={() => onSelect(inst)} />
          ))}
        </CollapsibleSection>
      )}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">No installations match your search</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: By Region
// ---------------------------------------------------------------------------

function RegionView({ regionData }: { regionData: RegionData[] }) {
  const maxCount = regionData.length > 0 ? Math.max(...regionData.map((r) => r.count)) : 1;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {regionData.map((region) => {
        const barWidth = Math.round((region.count / maxCount) * 100);
        return (
          <div
            key={region.name}
            className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-[22px] shadow-sm transition-all hover:-translate-y-px hover:border-[#D4AF37] hover:shadow-md"
          >
            <p className="text-sm font-medium text-gray-500">{region.name}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[32px] font-extrabold tracking-tight text-gray-900">
                {region.count}
              </span>
              <span className="text-sm font-medium text-gray-400">
                {region.percentage}%
              </span>
            </div>
            <p className="text-xs text-gray-400">installations</p>

            {/* Proportion bar */}
            <div className="mt-3 h-[1.5px] w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${barWidth}%`,
                  background: 'linear-gradient(90deg, #D4AF37, #e8c94b)',
                }}
              />
            </div>

            {/* Health dots row */}
            <div className="mt-3 flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {region.healthy}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {region.amber}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {region.red}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                {region.gray}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: Timeline
// ---------------------------------------------------------------------------

function TimelineView({
  filtered,
  onSelect,
}: {
  filtered: Installation[];
  onSelect: (inst: Installation) => void;
}) {
  // Group by time period based on installed date
  const now = new Date('2026-02-28');
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);

  const thisWeek = filtered.filter((i) => new Date(i.installedDate) >= oneWeekAgo);
  const lastWeek = filtered.filter((i) => {
    const d = new Date(i.installedDate);
    return d >= twoWeeksAgo && d < oneWeekAgo;
  });
  const thisMonth = filtered.filter((i) => {
    const d = new Date(i.installedDate);
    return d.getMonth() === 1 && d.getFullYear() === 2026 && d < twoWeeksAgo;
  });
  const older = filtered.filter((i) => {
    const d = new Date(i.installedDate);
    return !(d.getMonth() === 1 && d.getFullYear() === 2026) && d < twoWeeksAgo;
  });

  return (
    <div className="space-y-6">
      {thisWeek.length > 0 && (
        <CollapsibleSection title="This Week" dotColor="bg-blue-500" count={thisWeek.length}>
          {thisWeek.map((inst) => (
            <InstallationCard key={inst.id} inst={inst} onClick={() => onSelect(inst)} />
          ))}
        </CollapsibleSection>
      )}

      {lastWeek.length > 0 && (
        <CollapsibleSection title="Last Week" dotColor="bg-blue-400" count={lastWeek.length}>
          {lastWeek.map((inst) => (
            <InstallationCard key={inst.id} inst={inst} onClick={() => onSelect(inst)} />
          ))}
        </CollapsibleSection>
      )}

      {thisMonth.length > 0 && (
        <CollapsibleSection title="Earlier This Month" dotColor="bg-blue-300" count={thisMonth.length}>
          {thisMonth.map((inst) => (
            <InstallationCard key={inst.id} inst={inst} onClick={() => onSelect(inst)} />
          ))}
        </CollapsibleSection>
      )}

      {older.length > 0 && (
        <CollapsibleSection title="Older" dotColor="bg-gray-400" count={older.length}>
          {older.map((inst) => (
            <InstallationCard key={inst.id} inst={inst} onClick={() => onSelect(inst)} />
          ))}
        </CollapsibleSection>
      )}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">No installations match your search</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: Table
// ---------------------------------------------------------------------------

function TableView({
  filtered,
  onSelect,
}: {
  filtered: Installation[];
  onSelect: (inst: Installation) => void;
}) {
  const [sortField, setSortField] = useState<string>('installedDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      switch (sortField) {
        case 'jobRef':
          valA = a.jobRef;
          valB = b.jobRef;
          break;
        case 'customer':
          valA = `${a.lastName} ${a.firstName}`;
          valB = `${b.lastName} ${b.firstName}`;
          break;
        case 'systemSize':
          valA = a.systemSize;
          valB = b.systemSize;
          break;
        case 'installedDate':
          valA = a.installedDate;
          valB = b.installedDate;
          break;
        default:
          valA = a.installedDate;
          valB = b.installedDate;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortHeader({ field, children }: { field: string; children: React.ReactNode }) {
    return (
      <th
        className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-900"
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-[#D4AF37]' : 'text-gray-300'}`} />
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-gray-100 bg-gray-50/60">
            <tr>
              <SortHeader field="jobRef">Job Ref</SortHeader>
              <SortHeader field="customer">Customer</SortHeader>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                System Type
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Inverter
              </th>
              <SortHeader field="systemSize">Size</SortHeader>
              <SortHeader field="installedDate">Installed</SortHeader>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Portal
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Health
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((inst) => {
              const statusBadge = getStatusBadge(inst.portalStatus);
              return (
                <tr
                  key={inst.id}
                  className="cursor-pointer transition-colors hover:bg-gray-50/60"
                  onClick={() => onSelect(inst)}
                >
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-[#D4AF37]">
                    {inst.jobRef}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {inst.firstName} {inst.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{inst.address}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{inst.systemType}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{inst.inverter}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {inst.systemSize.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDate(inst.installedDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge}`}>
                      {inst.portalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${getHealthDotColor(inst.health)}`} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        inst.source === 'Dev'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-purple-200 bg-purple-50 text-purple-700'
                      }`}
                    >
                      {inst.source}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <div className="px-6 py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">No installations match your search</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat cards data
// ---------------------------------------------------------------------------

interface StatCardData {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  detail?: string;
}

function computeStatCards(installs: Installation[]): StatCardData[] {
  const total = installs.length;
  const active = installs.filter((i) => i.portalStatus === 'Active').length;
  const issues = installs.filter((i) => i.health === 'issue').length;
  const now = new Date();
  const thisMonth = installs.filter((i) => {
    const d = new Date(i.installedDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const activationPct = total > 0 ? Math.round((active / total) * 100) : 0;

  return [
    {
      label: 'Total Installations',
      value: total.toLocaleString(),
      icon: Sun,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
    },
    {
      label: 'Portal Active',
      value: active.toLocaleString(),
      icon: CheckCircle,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      detail: `${activationPct}% activation`,
    },
    {
      label: 'Needs Attention',
      value: issues.toLocaleString(),
      icon: AlertTriangle,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
    },
    {
      label: 'This Month',
      value: thisMonth.toLocaleString(),
      icon: Calendar,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      detail: now.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' }),
    },
  ];
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const tabs: { id: ViewTab; label: string }[] = [
  { id: 'status', label: 'By Status' },
  { id: 'region', label: 'By Region' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'table', label: 'Table' },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function InstallationsClient({ installations: installationsProp, error }: InstallationsProps) {
  const installations = installationsProp && installationsProp.length > 0 ? installationsProp : defaultInstallations;
  const [activeTab, setActiveTab] = useState<ViewTab>('status');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);

  const statCards = useMemo(() => computeStatCards(installations), [installations]);
  const regionData = useMemo(() => computeRegionData(installations), [installations]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
        <div className="mx-8 mt-6 rounded-xl border border-red-200 bg-red-50/60 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-red-800">Error loading data</h3>
          <p className="text-xs text-red-600 mt-1">Please refresh the page or contact support.</p>
        </div>
      </div>
    );
  }

  // Filter installations by search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return installations;
    const q = searchQuery.toLowerCase();
    return installations.filter(
      (i) =>
        i.firstName.toLowerCase().includes(q) ||
        i.lastName.toLowerCase().includes(q) ||
        i.address.toLowerCase().includes(q) ||
        i.jobRef.toLowerCase().includes(q)
    );
  }, [searchQuery, installations]);

  return (
    <div className="min-h-screen bg-gray-50/50 px-6 py-8 lg:px-10">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900">
            Installations
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage customer installations and monitor system health
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c9a432] hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Add Installation
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Stat Cards                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}>
                  <Icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight text-gray-900">
                {card.value}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                {card.label}
              </p>
              {card.detail && (
                <p className="mt-1 text-[11px] text-gray-400">{card.detail}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Search Bar                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, address, or job ref..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-[3px] focus:ring-[#D4AF37]/[0.08]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* View Tabs (Segmented Control)                                      */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6">
        <div className="inline-flex rounded-[10px] bg-gray-100 p-[3px]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[8px] px-5 py-2 text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-white font-semibold text-gray-900 shadow'
                  : 'font-medium text-gray-400 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* View Content                                                       */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'status' && (
        <StatusView
          filtered={filtered}
          onSelect={setSelectedInstallation}
        />
      )}

      {activeTab === 'region' && <RegionView regionData={regionData} />}

      {activeTab === 'timeline' && (
        <TimelineView
          filtered={filtered}
          onSelect={setSelectedInstallation}
        />
      )}

      {activeTab === 'table' && (
        <TableView
          filtered={filtered}
          onSelect={setSelectedInstallation}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Detail Panel                                                       */}
      {/* ----------------------------------------------------------------- */}
      {selectedInstallation && (
        <DetailPanel
          inst={selectedInstallation}
          onClose={() => setSelectedInstallation(null)}
        />
      )}
    </div>
  );
}
