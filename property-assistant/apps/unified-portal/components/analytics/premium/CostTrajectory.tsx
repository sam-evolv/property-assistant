'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CostTrajectoryProps {
  data: {
    date: string;
    actual: number;
    projected: number;
  }[];
}

export function CostTrajectory({ data }: CostTrajectoryProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-black p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Cost Trajectory</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="date" 
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual Cost"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={{ fill: '#fbbf24', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="projected"
            name="Projected Cost"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#9ca3af', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
