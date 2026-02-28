'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = ['#D4AF37', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

interface ChartData {
  type: 'bar' | 'donut' | 'line';
  labels: string[];
  values: number[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#161a22] border border-[#1e2531] rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-[#9ca8bc] capitalize">{label}</p>
      <p className="text-[#D4AF37] font-semibold">{payload[0].value?.toLocaleString()}</p>
    </div>
  );
}

export default function InlineChartRenderer({ chartData }: { chartData: ChartData }) {
  const data = chartData.labels.map((label, i) => ({
    name: label,
    value: chartData.values[i],
  }));

  if (chartData.type === 'donut') {
    const total = chartData.values.reduce((sum, v) => sum + v, 0);

    return (
      <div className="mt-3 flex justify-center">
        <div style={{ width: 240, height: 200 }} className="relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                stroke="#0f1115"
                fontSize={12}
                fill="#eef2f8"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label with primary value */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-lg font-bold text-[#eef2f8]">{total.toLocaleString()}</p>
              <p className="text-[10px] text-[#9ca8bc]">Total</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3" style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ bottom: 10 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#9ca8bc' }}
            angle={-35}
            textAnchor="end"
            height={60}
            axisLine={{ stroke: '#1e2531' }}
            tickLine={{ stroke: '#1e2531' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca8bc' }}
            axisLine={{ stroke: '#1e2531' }}
            tickLine={{ stroke: '#1e2531' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" fill="#D4AF37" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
