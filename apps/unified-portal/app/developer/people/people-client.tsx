'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  Users, HardHat, Mail, Loader2, Trash2, Clock, ArrowRight, CheckCircle2,
} from 'lucide-react';

interface OfficePerson {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface SitePerson {
  id: string;
  email: string | null;
  role: string;
  development_ids: string[] | null;
  expires_at: string | null;
}

interface Invitation {
  id: string;
  email: string;
  expires_at: string | null;
}

interface PeopleData {
  office: OfficePerson[];
  site: SitePerson[];
  invitations: Invitation[];
  me: { id: string; email: string };
}

const ROLE_LABELS: Record<string, string> = {
  developer: 'Developer',
  admin: 'Admin',
  super_admin: 'OpenHouse',
  site_team: 'Site team',
  snagger_external: 'Snag engineer',
};

export function PeopleClient() {
  const [data, setData] = useState<PeopleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'admin'>('developer');
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/developer/people')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setNotice({ kind: 'error', text: 'Couldn\'t load people.' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/developer/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const result = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'error', text: result.error || 'Invite failed.' });
      } else {
        setNotice({ kind: 'ok', text: result.message || 'Invite sent.' });
        setInviteEmail('');
        load();
      }
    } catch {
      setNotice({ kind: 'error', text: 'Network error — try again.' });
    } finally {
      setInviting(false);
    }
  };

  const remove = async (id: string) => {
    if (confirmRemoveId !== id) {
      setConfirmRemoveId(id);
      setTimeout(() => setConfirmRemoveId((c) => (c === id ? null : c)), 3000);
      return;
    }
    setRemovingId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/developer/people?adminId=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'error', text: result.error || 'Could not remove.' });
      } else {
        load();
      }
    } catch {
      setNotice({ kind: 'error', text: 'Network error — try again.' });
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-16">
      <h1 className="text-3xl font-semibold tracking-tight text-grey-900 md:text-4xl">People</h1>
      <p className="mt-2 text-base text-grey-500">
        Everyone with access to your schemes. Invite anyone in seconds.
      </p>

      {notice && (
        <div
          className={`mt-6 rounded-2xl border p-4 text-sm ${
            notice.kind === 'ok'
              ? 'border-gold-200 bg-gold-50 text-gold-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Invite */}
      <form
        onSubmit={invite}
        className="mt-8 flex flex-col gap-3 rounded-2xl border border-grey-200 bg-white p-5 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-400" />
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@yourcompany.ie"
            className="w-full rounded-xl border border-grey-200 bg-white py-3 pl-11 pr-4 text-sm text-grey-900 outline-none placeholder:text-grey-400 focus:border-gold-400"
          />
        </div>
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as 'developer' | 'admin')}
          className="rounded-xl border border-grey-200 bg-white px-3 py-3 text-sm font-medium text-grey-700 outline-none focus:border-gold-400"
        >
          <option value="developer">Developer</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={inviting || !inviteEmail.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-gold-600 disabled:opacity-40"
        >
          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Invite
        </button>
      </form>

      {/* Office team */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gold-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-grey-400">
            Your team
          </h2>
        </div>
        <div className="mt-3 divide-y divide-grey-100 rounded-2xl border border-grey-200 bg-white">
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-grey-100" />
              ))}
            </div>
          ) : (data?.office || []).length === 0 ? (
            <p className="p-5 text-sm text-grey-500">Just you so far.</p>
          ) : (
            (data?.office || []).map((person) => (
              <div key={person.id} className="flex items-center gap-3 px-5 py-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-grey-100 text-xs font-semibold uppercase text-grey-600">
                  {person.email[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-grey-900">
                    {person.email}
                    {person.id === data?.me.id && (
                      <span className="ml-2 text-xs text-grey-400">you</span>
                    )}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full border border-grey-200 bg-grey-50 px-2.5 py-1 text-xs font-medium text-grey-600">
                  {ROLE_LABELS[person.role] || person.role}
                </span>
                {person.id !== data?.me.id && person.role !== 'super_admin' && (
                  <button
                    onClick={() => remove(person.id)}
                    disabled={removingId === person.id}
                    className={`flex-shrink-0 rounded-lg p-2 transition-colors ${
                      confirmRemoveId === person.id
                        ? 'bg-red-50 text-red-600'
                        : 'text-grey-300 hover:text-red-500'
                    }`}
                    title={confirmRemoveId === person.id ? 'Tap again to confirm' : 'Remove access'}
                  >
                    {removingId === person.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Site & snagging */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <HardHat className="h-4 w-4 text-gold-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-grey-400">
            Site &amp; snagging
          </h2>
        </div>
        <div className="mt-3 divide-y divide-grey-100 rounded-2xl border border-grey-200 bg-white">
          {(data?.site || []).length === 0 && (data?.invitations || []).length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-grey-500">
                No site crew or snag engineers yet. Invite them from the snagging team page —
                external engineers get time-limited, scheme-scoped access.
              </p>
            </div>
          ) : (
            <>
              {(data?.site || []).map((person) => (
                <div key={person.id} className="flex items-center gap-3 px-5 py-4">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-gold-500" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-grey-900">
                    {person.email || 'Pending account'}
                  </p>
                  <span className="flex-shrink-0 rounded-full border border-grey-200 bg-grey-50 px-2.5 py-1 text-xs font-medium text-grey-600">
                    {ROLE_LABELS[person.role] || person.role}
                  </span>
                  {person.expires_at && (
                    <span className="hidden flex-shrink-0 items-center gap-1 text-xs text-amber-600 sm:flex">
                      <Clock className="h-3 w-3" />
                      until {new Date(person.expires_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              ))}
              {(data?.invitations || []).map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 px-5 py-4">
                  <Clock className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  <p className="min-w-0 flex-1 truncate text-sm text-grey-600">{invite.email}</p>
                  <span className="flex-shrink-0 text-xs text-grey-400">invited</span>
                </div>
              ))}
            </>
          )}
        </div>
        <Link
          href="/developer/snaggers"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600 hover:text-gold-700"
        >
          Manage snagging team <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <p className="mt-10 text-center text-xs text-grey-400">
        Builders join through the Select portal · Solicitors are tracked on the sales pipeline.
      </p>
    </div>
  );
}
