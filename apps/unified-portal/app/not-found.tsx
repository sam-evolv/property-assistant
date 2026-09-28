import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#FAFAFA] px-5 py-8">
      <div className="w-full max-w-sm text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          404
        </p>
        <h1 className="mb-2 text-[17px] font-semibold text-gray-900">
          We couldn&apos;t find that page.
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          The link may be out of date, or the page may have moved.
        </p>
        <Link
          href="/"
          className="inline-block w-full rounded-xl bg-gold-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gold-600"
        >
          Go to OpenHouse
        </Link>
      </div>
    </div>
  );
}
