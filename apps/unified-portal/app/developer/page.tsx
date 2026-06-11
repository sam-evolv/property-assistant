'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Sparkles, Home, FolderArchive,
  MessageSquare, ClipboardList, CheckCircle2, Circle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { isDeveloperDashboardEnabled } from '@/lib/feature-flags';

interface DashboardData {
  kpis?: {
    documentCoverage?: { value: number };
  };
  unansweredQueries?: Array<{ question: string; topic: string; date: string }>;
  upcomingHandovers?: Array<{ address: string; unit_uid: string | null; handover_date: string }>;
  summary?: {
    totalUnits: number;
    registeredHomeowners: number;
    activeHomeowners: number;
    totalMessages: number;
    messageGrowth: number;
    totalDocuments: number;
  };
}

interface BriefItem {
  title: string;
  detail: string;
  action: string;
  href: string;
}

const SUGGESTIONS = [
  'What needs my attention this week?',
  'How is homeowner registration trending?',
  'Which homes are missing documents?',
  'What are homeowners asking most?',
];

function greetingForHour() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayPage() {
  const router = useRouter();
  const { email, displayName: authDisplayName } = useAuth();
  const { developmentId, developmentName } = useCurrentContext();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [question, setQuestion] = useState('');

  const firstName = (
    authDisplayName ||
    (email ? email.split('@')[0].replace(/[._-]/g, ' ') : 'there')
  )
    .split(' ')[0]
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setFailed(false);
    fetch('/api/analytics/developer/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('dashboard failed');
        return res.json();
      })
      .then((payload) => setData(payload))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    router.push(`/developer/scheme-intelligence?q=${encodeURIComponent(q)}`);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  const summary = data?.summary;
  const snagsHref = isDeveloperDashboardEnabled() ? '/developer/issues' : '/developer/snagging';

  // The brief: at most three things that genuinely need a human today.
  const brief: BriefItem[] = [];
  if (data) {
    const gaps = data.unansweredQueries || [];
    if (gaps.length > 0) {
      brief.push({
        title: `${gaps.length} homeowner question${gaps.length === 1 ? '' : 's'} the assistant couldn't answer`,
        detail: `"${gaps[0].question.slice(0, 90)}${gaps[0].question.length > 90 ? '…' : ''}"`,
        action: 'Close the gap',
        href: '/developer/knowledge-base',
      });
    }
    const handovers = data.upcomingHandovers || [];
    if (handovers.length > 0) {
      const next = handovers[0];
      const when = next.handover_date
        ? new Date(next.handover_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
        : '';
      brief.push({
        title: `${handovers.length} handover${handovers.length === 1 ? '' : 's'} coming up`,
        detail: `Next: ${next.address}${when ? ` · ${when}` : ''}`,
        action: 'Prepare the homes',
        href: '/developer/homeowners',
      });
    }
    const coverage = data.kpis?.documentCoverage?.value;
    if (typeof coverage === 'number' && coverage < 80) {
      brief.push({
        title: `Document coverage is at ${Math.round(coverage)}%`,
        detail: 'Homes are missing documents their owners will ask about.',
        action: 'Drop in documents',
        href: '/developer/archive',
      });
    }
  }

  const needsSetup = !loading && !failed && (summary?.totalUnits ?? 0) === 0;

  const setupSteps = [
    {
      title: 'Add your scheme',
      detail: 'A name and a county. That’s all it takes to start.',
      done: Boolean(developmentId),
      href: '/developer/scheme-setup',
    },
    {
      title: 'Bring in your homes',
      detail: 'Drop your sales sheet — every home and purchaser becomes a live profile.',
      done: (summary?.totalUnits ?? 0) > 0,
      href: '/developer/homeowners/import',
    },
    {
      title: 'Drop in your documents',
      detail: 'Drawings, certs, manuals. The assistant files them and starts answering.',
      done: (summary?.totalDocuments ?? 0) > 0,
      href: '/developer/archive',
    },
  ];

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-20 md:pt-24">
        {/* Greeting */}
        <p className="text-sm font-medium tracking-wide text-gold-600">
          {developmentName || 'OpenHouse'}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-grey-900 md:text-5xl">
          {greetingForHour()}, {firstName}.
        </h1>
        <p className="mt-3 text-lg text-grey-500">
          {needsSetup
            ? 'Three steps and you’re live.'
            : loading
              ? 'Pulling together your brief…'
              : failed
                ? 'Here whenever you are.'
                : brief.length === 0
                  ? 'All quiet. Nothing needs you right now.'
                  : `${brief.length} thing${brief.length === 1 ? '' : 's'} need${brief.length === 1 ? 's' : ''} you today.`}
        </p>

        {needsSetup ? (
          /* ------------------------------------------------------------- */
          /* Onboarding is not a wizard. It is the empty state of Today.   */
          /* ------------------------------------------------------------- */
          <div className="mt-12 space-y-3">
            {setupSteps.map((step, i) => (
              <Link
                key={step.title}
                href={step.href}
                className="group flex items-center gap-5 rounded-2xl border border-grey-200 bg-white p-6 transition-all hover:border-gold-400 hover:shadow-lg hover:shadow-gold-500/5"
              >
                {step.done ? (
                  <CheckCircle2 className="h-7 w-7 flex-shrink-0 text-gold-500" />
                ) : (
                  <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center">
                    <Circle className="h-7 w-7 text-grey-300" />
                    <span className="absolute text-xs font-semibold text-grey-500">{i + 1}</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className={`text-base font-semibold ${step.done ? 'text-grey-400 line-through' : 'text-grey-900'}`}>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-grey-500">{step.detail}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-grey-300 transition-all group-hover:translate-x-0.5 group-hover:text-gold-500" />
              </Link>
            ))}
            <p className="pt-4 text-center text-sm text-grey-400">
              That’s it. Profiles, filing and answers are handled for you.
            </p>
          </div>
        ) : (
          <>
            {/* Ask bar — the front door to everything */}
            <form onSubmit={handleSubmit} className="mt-10">
              <div className="group relative">
                <Sparkles className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gold-500" />
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={`Ask anything about ${developmentName || 'your schemes'}…`}
                  className="w-full rounded-2xl border border-grey-200 bg-white py-5 pl-14 pr-14 text-base text-grey-900 shadow-sm outline-none transition-all placeholder:text-grey-400 focus:border-gold-400 focus:shadow-lg focus:shadow-gold-500/10"
                />
                <button
                  type="submit"
                  aria-label="Ask"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-gold-500 p-2.5 text-white transition-all hover:bg-gold-600 disabled:opacity-40"
                  disabled={!question.trim()}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-full border border-grey-200 bg-white px-3.5 py-1.5 text-xs font-medium text-grey-600 transition-all hover:border-gold-400 hover:text-gold-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </form>

            {/* The brief */}
            <div className="mt-12">
              {loading ? (
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-2xl bg-grey-100" />
                  ))}
                </div>
              ) : failed ? (
                <div className="rounded-2xl border border-grey-200 bg-white p-6 text-center">
                  <p className="text-sm text-grey-500">Couldn’t load today’s brief.</p>
                  <button
                    onClick={loadDashboard}
                    className="mt-2 text-sm font-semibold text-gold-600 hover:text-gold-700"
                  >
                    Try again
                  </button>
                </div>
              ) : brief.length === 0 ? (
                <div className="rounded-2xl border border-grey-200 bg-white p-8 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-gold-500" />
                  <p className="mt-3 text-base font-semibold text-grey-900">All clear.</p>
                  <p className="mt-1 text-sm text-grey-500">
                    Every question answered, every handover covered.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {brief.slice(0, 3).map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="group flex items-center gap-5 rounded-2xl border border-grey-200 bg-white p-6 transition-all hover:border-gold-400 hover:shadow-lg hover:shadow-gold-500/5"
                    >
                      <div className="flex-1">
                        <p className="text-base font-semibold text-grey-900">{item.title}</p>
                        <p className="mt-0.5 text-sm text-grey-500">{item.detail}</p>
                      </div>
                      <span className="flex flex-shrink-0 items-center gap-1 text-sm font-semibold text-gold-600 transition-all group-hover:gap-2">
                        {item.action}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Four quiet doors */}
            <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Link
                href="/developer/homeowners"
                className="group rounded-2xl border border-grey-200 bg-white p-5 transition-all hover:border-gold-400 hover:shadow-lg hover:shadow-gold-500/5"
              >
                <Home className="h-5 w-5 text-gold-500" />
                <p className="mt-4 text-2xl font-semibold tracking-tight text-grey-900">
                  {summary ? summary.totalUnits : '—'}
                </p>
                <p className="text-sm text-grey-500">
                  homes{summary ? ` · ${summary.registeredHomeowners} registered` : ''}
                </p>
              </Link>
              <Link
                href="/developer/archive"
                className="group rounded-2xl border border-grey-200 bg-white p-5 transition-all hover:border-gold-400 hover:shadow-lg hover:shadow-gold-500/5"
              >
                <FolderArchive className="h-5 w-5 text-gold-500" />
                <p className="mt-4 text-2xl font-semibold tracking-tight text-grey-900">
                  {summary ? summary.totalDocuments : '—'}
                </p>
                <p className="text-sm text-grey-500">documents filed</p>
              </Link>
              <Link
                href={snagsHref}
                className="group rounded-2xl border border-grey-200 bg-white p-5 transition-all hover:border-gold-400 hover:shadow-lg hover:shadow-gold-500/5"
              >
                <ClipboardList className="h-5 w-5 text-gold-500" />
                <p className="mt-4 flex items-center gap-1 text-2xl font-semibold tracking-tight text-grey-900">
                  Snags
                  <ArrowUpRight className="h-4 w-4 text-grey-300 transition-colors group-hover:text-gold-500" />
                </p>
                <p className="text-sm text-grey-500">every issue, one place</p>
              </Link>
              <Link
                href="/developer/overview"
                className="group rounded-2xl border border-grey-200 bg-white p-5 transition-all hover:border-gold-400 hover:shadow-lg hover:shadow-gold-500/5"
              >
                <MessageSquare className="h-5 w-5 text-gold-500" />
                <p className="mt-4 text-2xl font-semibold tracking-tight text-grey-900">
                  {summary ? summary.totalMessages : '—'}
                </p>
                <p className="text-sm text-grey-500">
                  conversations
                  {summary && summary.messageGrowth ? ` · ${summary.messageGrowth > 0 ? '+' : ''}${summary.messageGrowth}%` : ''}
                </p>
              </Link>
            </div>

            {/* One quiet exit to depth */}
            <p className="mt-10 text-center text-sm text-grey-400">
              Want the detail?{' '}
              <Link href="/developer/overview" className="font-semibold text-grey-500 hover:text-gold-600">
                Full dashboard
              </Link>{' '}
              ·{' '}
              <Link href="/developer/analytics" className="font-semibold text-grey-500 hover:text-gold-600">
                Analytics
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
