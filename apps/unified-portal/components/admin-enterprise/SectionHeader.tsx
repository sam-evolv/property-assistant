interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-black">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-black font-medium">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
