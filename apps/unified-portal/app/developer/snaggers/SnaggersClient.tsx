'use client';

/**
 * /developer/snaggers client. Three regions:
 *   1. Members list
 *   2. Pending invitations list
 *   3. Invite snagger modal (email + development picker + expiry)
 *
 * Spec section 8.
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Copy, Mail, ShieldCheck, UserPlus, X } from 'lucide-react';

interface SnaggersClientProps {
  tenantId: string;
}

interface Member {
  id: string;
  user_id: string;
  email: string | null;
  role: 'admin' | 'site_team' | 'snagger_external';
  development_ids: string[] | null;
  active: boolean;
  expires_at: string | null;
  invited_at: string;
  accepted_at: string | null;
  is_expired: boolean;
}

interface Invitation {
  id: string;
  email: string;
  development_id: string;
  expires_at: string;
  created_at: string;
  is_expired: boolean;
  invite_url: string;
}

interface DevelopmentLite {
  id: string;
  name: string;
}

interface TeamPayload {
  members: Member[];
  invitations: Invitation[];
  developments: DevelopmentLite[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRY_OPTIONS = [7, 14, 30] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function roleLabel(role: Member['role']): string {
  if (role === 'admin') return 'Admin';
  if (role === 'site_team') return 'Site team';
  return 'External snagger';
}

export function SnaggersClient(_props: SnaggersClientProps) {
  const [data, setData] = useState<TeamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/snag/team', { cache: 'no-store' });
      if (!res.ok) {
        setLoadError("Couldn't load the snagging team.");
        return;
      }
      const json = (await res.json()) as TeamPayload;
      setData(json);
    } catch {
      setLoadError("Couldn't load the snagging team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyInvite = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(id);
      setTimeout(() => setCopiedToken((curr) => (curr === id ? null : curr)), 1500);
    } catch {
      // Fallback: select-and-show. Best-effort only.
      window.prompt('Copy invite URL', url);
    }
  };

  const developments = data?.developments ?? [];
  const developmentName = (id: string) => developments.find((d) => d.id === id)?.name ?? id;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-heading-md text-neutral-900">Snagging team</h1>
          <p className="text-body-sm text-neutral-600 mt-1">
            Invite external snaggers and manage site team access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 active:bg-brand-700 min-h-[44px]"
        >
          <UserPlus className="w-4 h-4" />
          Invite snagger
        </button>
      </header>

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-6 text-body-sm text-neutral-500">
          Loading...
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-body-sm text-red-700">
          {loadError}
        </div>
      ) : data ? (
        <>
          <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-neutral-500" />
              <h2 className="text-body-sm font-medium text-neutral-700">Current team</h2>
              <span className="ml-auto text-caption text-neutral-500">{data.members.length} {data.members.length === 1 ? 'person' : 'people'}</span>
            </div>
            {data.members.length === 0 ? (
              <div className="px-4 py-6 text-body-sm text-neutral-500 text-center">
                No team members yet. Invite a snagger to get started.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {data.members.map((m) => (
                  <li key={m.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-body text-neutral-900 truncate">{m.email ?? m.user_id}</div>
                      <div className="text-caption text-neutral-500 mt-0.5">
                        {roleLabel(m.role)}
                        {m.role === 'snagger_external' && Array.isArray(m.development_ids) && m.development_ids.length > 0
                          ? ' . ' + m.development_ids.map(developmentName).join(', ')
                          : null}
                      </div>
                      <div className="text-caption text-neutral-500 mt-0.5">
                        {m.accepted_at ? `Accepted ${formatDate(m.accepted_at)}` : `Invited ${formatDate(m.invited_at)}`}
                        {m.expires_at ? ` . expires ${formatDate(m.expires_at)}` : null}
                      </div>
                    </div>
                    <span
                      className={`text-caption px-2 py-0.5 rounded-full ${
                        !m.active
                          ? 'bg-neutral-100 text-neutral-500'
                          : m.is_expired
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {!m.active ? 'Inactive' : m.is_expired ? 'Expired' : 'Active'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
              <Mail className="w-4 h-4 text-neutral-500" />
              <h2 className="text-body-sm font-medium text-neutral-700">Pending invitations</h2>
              <span className="ml-auto text-caption text-neutral-500">{data.invitations.length}</span>
            </div>
            {data.invitations.length === 0 ? (
              <div className="px-4 py-6 text-body-sm text-neutral-500 text-center">
                No pending invitations.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {data.invitations.map((inv) => (
                  <li key={inv.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-body text-neutral-900 truncate">{inv.email}</div>
                      <div className="text-caption text-neutral-500 mt-0.5">
                        {developmentName(inv.development_id)} . expires {formatDate(inv.expires_at)}
                      </div>
                    </div>
                    {inv.is_expired ? (
                      <span className="text-caption px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Expired</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => copyInvite(inv.invite_url, inv.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-md text-body-sm hover:bg-neutral-200 active:bg-neutral-300 min-h-[36px]"
                      >
                        {copiedToken === inv.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedToken === inv.id ? 'Copied' : 'Copy link'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {inviteOpen ? (
        <InviteModal
          developments={developments}
          onClose={() => setInviteOpen(false)}
          onSuccess={() => {
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

interface InviteModalProps {
  developments: DevelopmentLite[];
  onClose: () => void;
  onSuccess: () => void;
}

function InviteModal({ developments, onClose, onSuccess }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [developmentId, setDevelopmentId] = useState<string>(() => developments[0]?.id ?? '');
  const [expiresInDays, setExpiresInDays] = useState<7 | 14 | 30>(14);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const valid = EMAIL_RE.test(email.trim()) && !!developmentId;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/snag/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          development_id: developmentId,
          expires_in_days: expiresInDays,
        }),
      });
      if (!res.ok) {
        let message = "Couldn't create the invitation.";
        try {
          const json = await res.json();
          if (typeof json?.error === 'string' && json.error.length < 200) message = json.error;
        } catch {
          // ignore
        }
        setError(message);
        return;
      }
      const json = await res.json();
      setInviteUrl(typeof json?.invite_url === 'string' ? json.invite_url : null);
      onSuccess();
    } catch {
      setError("Couldn't create the invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy invite URL', inviteUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-modal bg-neutral-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <header className="px-5 py-4 border-b border-neutral-200 flex items-center gap-3">
          <h2 className="text-heading-sm text-neutral-900 flex-1">Invite snagger</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-1 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {inviteUrl ? (
          <div className="px-5 py-5 space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-body-sm text-emerald-700 flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5" />
              <div>Invitation created. Copy this link and send it via WhatsApp or email.</div>
            </div>
            <div>
              <label className="text-caption text-neutral-500 block mb-1" htmlFor="invite-url">
                Invite link
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  id="invite-url"
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-body-sm text-neutral-900 truncate"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white rounded-lg text-body-sm hover:bg-neutral-800 active:bg-neutral-700 min-h-[40px]"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 active:bg-brand-700 min-h-[44px]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="text-caption text-neutral-500 block mb-1" htmlFor="invite-email">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="snagger@company.ie"
                autoComplete="email"
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-caption text-neutral-500 block mb-1" htmlFor="invite-dev">
                Development
              </label>
              <select
                id="invite-dev"
                value={developmentId}
                onChange={(e) => setDevelopmentId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[44px]"
              >
                {developments.length === 0 ? (
                  <option value="">No developments in this tenant</option>
                ) : null}
                {developments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-caption text-neutral-500 block mb-1" htmlFor="invite-expiry">
                Expires in
              </label>
              <div className="flex gap-2">
                {EXPIRY_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setExpiresInDays(days)}
                    className={`flex-1 py-2.5 rounded-lg border text-body-sm min-h-[44px] ${
                      expiresInDays === days
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-caption text-neutral-600 flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 mt-0.5" />
              <div>
                Polished invitation emails are a later sprint. Copy the resulting link and send it via your usual channel.
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-body-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={submit}
              disabled={!valid || submitting}
              className="w-full py-2.5 bg-brand-500 text-white rounded-lg font-medium disabled:bg-neutral-200 disabled:text-neutral-400 hover:bg-brand-600 active:bg-brand-700 min-h-[44px]"
            >
              {submitting ? 'Creating...' : 'Create invitation'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
