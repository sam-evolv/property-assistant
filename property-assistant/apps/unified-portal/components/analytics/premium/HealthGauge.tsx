'use client';

interface HealthGaugeProps {
  value: number;
  label: string;
  max?: number;
}

export function HealthGauge({ value, label, max = 100 }: HealthGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 80) return '#22c55e';
    if (percentage >= 50) return '#fbbf24';
    return '#ef4444';
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-black p-6">
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90 transform">
          <circle
            cx="64"
            cy="64"
            r="40"
            stroke="#1f2937"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="64"
            cy="64"
            r="40"
            stroke={getColor()}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">{Math.round(percentage)}%</span>
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-gray-400 text-center">{label}</p>
    </div>
  );
}
