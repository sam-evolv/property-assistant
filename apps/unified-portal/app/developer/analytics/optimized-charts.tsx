'use client';

import React, { memo, useMemo } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartData {
  date: string;
  chats?: number;
  messages?: number;
  avgTime?: number;
  maxTime?: number;
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#161a22',
  border: '1px solid #1e2531',
  borderRadius: '8px',
  color: '#eef2f8'
};

const GRADIENT_DEF = (
  <defs>
    <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
    </linearGradient>
  </defs>
);

interface ActivityChartProps {
  data: ChartData[];
  height?: number;
}

export const ActivityChart = memo(function ActivityChart({ data, height = 280 }: ActivityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        {GRADIENT_DEF}
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2531" />
        <XAxis stroke="#1e2531" tick={{ fill: "#9ca8bc", fontSize: 12 }} />
        <YAxis stroke="#1e2531" tick={{ fill: "#9ca8bc", fontSize: 12 }} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="chats" stroke="#D4AF37" fillOpacity={1} fill="url(#colorChats)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
});

interface ResponseTimeChartProps {
  data: ChartData[];
  height?: number;
}

export const ResponseTimeChart = memo(function ResponseTimeChart({ data, height = 200 }: ResponseTimeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2531" />
        <XAxis stroke="#1e2531" tick={{ fill: "#9ca8bc", fontSize: 12 }} />
        <YAxis stroke="#1e2531" tick={{ fill: "#9ca8bc", fontSize: 12 }} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Line type="monotone" dataKey="avgTime" stroke="#D4AF37" dot={{ fill: '#D4AF37', r: 5 }} strokeWidth={2} name="Avg Response" />
        <Line type="monotone" dataKey="maxTime" stroke="#93C5FD" dot={{ fill: '#93C5FD', r: 4 }} strokeWidth={2} name="Max Response" />
      </LineChart>
    </ResponsiveContainer>
  );
});
