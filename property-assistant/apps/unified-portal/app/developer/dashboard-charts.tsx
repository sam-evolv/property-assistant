'use client';

import React, { memo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BarChartData {
  date: string;
  chats: number;
  messages?: number;
}

interface PieChartData {
  name: string;
  value: number;
  color: string;
}

const CHART_TOOLTIP_STYLE_LIGHT = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  color: '#111827'
};

const CHART_TOOLTIP_STYLE_DARK = {
  backgroundColor: '#1F2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#FFFFFF'
};

interface BarChartComponentProps {
  data: BarChartData[];
  isDarkMode?: boolean;
  height?: number;
}

export const DashboardBarChart = memo(function DashboardBarChart({ 
  data, 
  isDarkMode = false, 
  height = 250 
}: BarChartComponentProps) {
  const strokeColor = isDarkMode ? '#444' : '#E5E7EB';
  const axisColor = isDarkMode ? '#999' : '#6B7280';
  const tooltipStyle = isDarkMode ? CHART_TOOLTIP_STYLE_DARK : CHART_TOOLTIP_STYLE_LIGHT;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={strokeColor} />
        <XAxis stroke={axisColor} />
        <YAxis stroke={axisColor} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="chats" fill="#D4AF37" />
      </BarChart>
    </ResponsiveContainer>
  );
});

interface PieChartComponentProps {
  data: PieChartData[];
  height?: number;
}

export const DashboardPieChart = memo(function DashboardPieChart({ 
  data, 
  height = 250 
}: PieChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie 
          data={data as unknown as any[]} 
          cx="50%" 
          cy="50%" 
          innerRadius={80} 
          outerRadius={120} 
          paddingAngle={2} 
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
});
