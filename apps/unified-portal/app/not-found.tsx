import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/10 ring-1 ring-gold-500/30">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-500">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
          Check the link, or head back to somewhere familiar.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gold-500 px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-gold-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Go home
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
