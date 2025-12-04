'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ContentLifecycleChartProps {
  data: {
    date: string;
    uploaded: number;
    used: number;
    decayed: number;
  }[];
}

export function ContentLifecycleChart({ data }: ContentLifecycleChartProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-black p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Content Lifecycle</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorUploaded" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDecayed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="date" 
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="uploaded"
            name="Uploaded"
            stroke="#22c55e"
            fillOpacity={1}
            fill="url(#colorUploaded)"
          />
          <Area
            type="monotone"
            dataKey="used"
            name="Used"
            stroke="#fbbf24"
            fillOpacity={1}
            fill="url(#colorUsed)"
          />
          <Area
            type="monotone"
            dataKey="decayed"
            name="Decayed"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorDecayed)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
