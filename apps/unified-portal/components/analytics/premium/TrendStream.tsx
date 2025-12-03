'use client';

interface TrendStreamProps {
  data: number[];
  label: string;
  color?: string;
}

export function TrendStream({ data, label, color = '#fbbf24' }: TrendStreamProps) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = range > 0 ? ((max - value) / range) * 100 : 50;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-800 bg-black p-4">
      <div className="flex-shrink-0">
        <p className="text-sm font-medium text-gray-400">{label}</p>
        <p className="text-lg font-bold text-white">{data[data.length - 1]}</p>
      </div>
      <div className="flex-1">
        <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={points}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
