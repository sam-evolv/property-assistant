'use client';

import React from 'react';
import { PremiumCard } from '@openhouse/ui/components/PremiumCard';
import { PremiumButton } from '@openhouse/ui/components/PremiumButton';

function generateErrorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = this.state.errorId || generateErrorId();
    console.error(`[APP CRITICAL] React error boundary caught error errorId=${errorId}`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
    
    this.setState({ error, errorInfo, errorId });

    if (typeof window !== 'undefined') {
      fetch('/api/admin/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch((err) => console.error('[Error Boundary] Failed to log error:', err));
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <PremiumCard className="max-w-2xl w-full">
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 mb-6">
                An unexpected error occurred. Our team has been notified.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left bg-gray-100 p-4 rounded-lg mb-6">
                  <summary className="cursor-pointer font-semibold text-sm text-gray-700 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <pre className="text-xs text-red-600 overflow-auto">
                    {this.state.error.toString()}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              <div className="flex gap-4 justify-center">
                <PremiumButton
                  variant="primary"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </PremiumButton>
                <PremiumButton
                  variant="secondary"
                  onClick={() => window.location.href = '/'}
                >
                  Go Home
                </PremiumButton>
              </div>
              
              {this.state.errorId && (
                <p className="mt-4 text-xs text-gray-400">
                  Error ID: {this.state.errorId}
                </p>
              )}
            </div>
          </PremiumCard>
        </div>
      );
    }

    return this.props.children;
  }
}
