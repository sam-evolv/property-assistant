import { PurchaserProvider } from '@/contexts/PurchaserContext';

export default function PurchaserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PurchaserProvider>
      {children}
    </PurchaserProvider>
  );
}
