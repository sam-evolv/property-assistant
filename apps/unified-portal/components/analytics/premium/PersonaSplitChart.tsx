'use client';

interface PersonaSplitChartProps {
  data: { label: string; value: number; color?: string }[];
  title: string;
}

export function PersonaSplitChart({ data, title }: PersonaSplitChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-lg border border-gray-800 bg-black p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const color = item.color || `hsl(${(index * 60) % 360}, 70%, 50%)`;
          
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">{item.label}</span>
                <span className="text-sm font-medium text-white">{item.value}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${percentage}%`,
                    backgroundColor: color 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
