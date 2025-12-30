'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

function AccessPendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'your email';

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-gray-900" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-800/50 shadow-2xl p-8 md:p-10">
          <div className="flex justify-center mb-8">
            <Image
              src="/branding/openhouse-ai-logo.png"
              alt="OpenHouse AI"
              width={200}
              height={50}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              Access Not Configured
            </h1>
            <p className="text-gray-400 text-sm">
              Your account has been created, but access has not been linked to a developer account yet.
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-300 mb-1">Signed in as:</p>
            <p className="text-gold-400 font-medium break-all">{email}</p>
          </div>

          <div className="space-y-4">
            <p className="text-gray-400 text-sm text-center">
              Please contact support to complete your account setup:
            </p>

            <a
              href={`mailto:sam@openhouseai.ie?subject=Developer%20Portal%20Access%20Request&body=Hi%20OpenHouse%20AI%20Team%2C%0A%0AI%20have%20created%20an%20account%20with%20the%20email%20${encodeURIComponent(email)}%20and%20would%20like%20to%20request%20access%20to%20the%20Developer%20Portal.%0A%0APlease%20let%20me%20know%20what%20information%20you%20need%20to%20complete%20my%20setup.%0A%0AThank%20you!`}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-black font-semibold rounded-xl shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Support
            </a>

            <Link
              href="/login"
              className="w-full py-3 px-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Back to Login
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-800/50">
            <p className="text-center text-xs text-gray-500">
              Need help? Email us at{' '}
              <a href="mailto:sam@openhouseai.ie" className="text-gold-400/80 hover:text-gold-400 transition-colors">
                sam@openhouseai.ie
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          OpenHouse AI Property Intelligence Platform
        </p>
      </div>
    </div>
  );
}

export default function AccessPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <AccessPendingContent />
    </Suspense>
  );
}
