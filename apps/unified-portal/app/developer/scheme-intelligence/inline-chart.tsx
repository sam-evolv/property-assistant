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

const CHART_COLORS = ['#D4AF37', '#B8934C', '#F5D874', '#E5BC4E', '#8B6428', '#A67C3A'];

interface ChartData {
  type: 'bar' | 'donut' | 'line';
  labels: string[];
  values: number[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-slate-700 capitalize">{label}</p>
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
              <p className="text-lg font-bold text-slate-800">{total.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">Total</p>
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
            tick={{ fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" fill="#D4AF37" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
