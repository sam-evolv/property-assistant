import { PurchaserProvider } from '@/contexts/PurchaserContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function PurchaserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <PurchaserProvider>
        {children}
      </PurchaserProvider>
    </ErrorBoundary>
  );
}
