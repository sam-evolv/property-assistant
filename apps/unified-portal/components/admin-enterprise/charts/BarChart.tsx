'use client';

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BarChartProps {
  data: Array<Record<string, string | number | null | undefined>>;
  dataKey?: string;
  xKey?: string;
  xAxisKey?: string;
  bars?: Array<{
    key: string;
    color?: string;
    name?: string;
  }>;
  height?: number;
  title?: string;
}

export function BarChart({
  data,
  dataKey = 'value',
  xKey,
  xAxisKey,
  bars,
  height = 256,
  title,
}: BarChartProps) {
  const resolvedXAxisKey = xKey ?? xAxisKey ?? 'name';
  const resolvedBars = (bars && bars.length > 0)
    ? bars
    : [{ key: dataKey, color: '#D4AF37', name: dataKey }];

  return (
    <div className="w-full" style={{ height }}>
      {title && <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={resolvedXAxisKey} />
          <YAxis />
          <Tooltip />
          {resolvedBars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color ?? '#D4AF37'}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
