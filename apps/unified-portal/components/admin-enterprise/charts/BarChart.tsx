'use client';

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BarChartProps {
  data: Array<{ name: string; value: number }>;
  dataKey?: string;
  xAxisKey?: string;
  title?: string;
}

export function BarChart({ data, dataKey = 'value', xAxisKey = 'name', title }: BarChartProps) {
  return (
    <div className="w-full h-64">
      {title && <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={dataKey} fill="#D4AF37" />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
