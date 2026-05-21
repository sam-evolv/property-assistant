/**
 * No-access screen for /snag. Shown when the signed-in user has no
 * active site_team_members membership, or only memberships that have
 * expired.
 *
 * No em dashes. Calm, direct copy.
 */

import { ShieldOff } from 'lucide-react';

interface SnagNoAccessProps {
  code: 'unauthenticated' | 'forbidden' | 'expired';
}

const COPY: Record<SnagNoAccessProps['code'], { title: string; body: string }> = {
  unauthenticated: {
    title: 'Sign in to log snags',
    body: 'You need to sign in with the email your admin invited.',
  },
  forbidden: {
    title: 'No snag access yet',
    body: 'Ask your admin to invite you. Once accepted, this page lets you log snags from your phone.',
  },
  expired: {
    title: 'Your access has ended',
    body: 'Your snagger invitation has expired. Ask your admin for a new invite if you still need to log snags.',
  },
};

export function SnagNoAccess({ code }: SnagNoAccessProps) {
  const copy = COPY[code];
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white border border-neutral-200 rounded-2xl p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <ShieldOff className="w-6 h-6 text-neutral-500" />
        </div>
        <h1 className="text-heading-sm text-neutral-900 mb-2">{copy.title}</h1>
        <p className="text-body-sm text-neutral-600">{copy.body}</p>
      </div>
    </div>
  );
}
