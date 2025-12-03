interface EnterpriseCardProps {
  children: React.ReactNode;
  className?: string;
}

export function EnterpriseCard({ children, className = '' }: EnterpriseCardProps) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg p-6 ${className}`}>
      {children}
    </div>
  );
}
