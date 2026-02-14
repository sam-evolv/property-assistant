'use client';

import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface LineChartProps {
  data: Array<Record<string, string | number | null | undefined>>;
  dataKey?: string;
  xKey?: string;
  xAxisKey?: string;
  lines?: Array<{
    key: string;
    color?: string;
    name?: string;
    strokeWidth?: number;
  }>;
  height?: number;
  title?: string;
}

export function LineChart({
  data,
  dataKey = 'value',
  xKey,
  xAxisKey,
  lines,
  height = 256,
  title,
}: LineChartProps) {
  const resolvedXAxisKey = xKey ?? xAxisKey ?? 'date';
  const resolvedLines = (lines && lines.length > 0)
    ? lines
    : [{ key: dataKey, color: '#D4AF37', name: dataKey, strokeWidth: 2 }];

  return (
    <div className="w-full" style={{ height }}>
      {title && <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={resolvedXAxisKey} />
          <YAxis />
          <Tooltip />
          {resolvedLines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color ?? '#D4AF37'}
              strokeWidth={line.strokeWidth ?? 2}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
