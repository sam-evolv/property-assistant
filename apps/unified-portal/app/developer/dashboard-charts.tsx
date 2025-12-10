'use client';

import React, { memo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, LineChart, Line, Area, AreaChart } from 'recharts';

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

interface TopicData {
  topic: string;
  label: string;
  count: number;
}

interface FunnelData {
  stage: string;
  count: number;
  colour: string;
}

interface ActivityData {
  date: string;
  count: number;
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

interface TopQuestionsChartProps {
  data: TopicData[];
  isDarkMode?: boolean;
  height?: number;
}

export const TopQuestionsChart = memo(function TopQuestionsChart({
  data,
  isDarkMode = false,
  height = 280
}: TopQuestionsChartProps) {
  const strokeColor = isDarkMode ? '#444' : '#E5E7EB';
  const axisColor = isDarkMode ? '#999' : '#6B7280';
  const tooltipStyle = isDarkMode ? CHART_TOOLTIP_STYLE_DARK : CHART_TOOLTIP_STYLE_LIGHT;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={strokeColor} horizontal={false} />
        <XAxis type="number" stroke={axisColor} fontSize={12} />
        <YAxis 
          type="category" 
          dataKey="label" 
          stroke={axisColor} 
          fontSize={12}
          width={120}
          tickLine={false}
        />
        <Tooltip 
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`${value} questions`, 'Count']}
        />
        <Bar dataKey="count" fill="#D4AF37" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

interface OnboardingFunnelProps {
  data: FunnelData[];
  isDarkMode?: boolean;
  height?: number;
}

export const OnboardingFunnelChart = memo(function OnboardingFunnelChart({
  data,
  isDarkMode = false,
  height = 200
}: OnboardingFunnelProps) {
  const textColor = isDarkMode ? '#FFF' : '#111827';

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const maxCount = data[0]?.count || 1;
        const percentage = Math.round((item.count / maxCount) * 100);
        const widthPercent = Math.max(percentage, 20);
        
        return (
          <div key={item.stage} className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {item.stage}
              </span>
              <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {item.count.toLocaleString()}
              </span>
            </div>
            <div className={`h-8 rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div 
                className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                style={{ 
                  width: `${widthPercent}%`, 
                  backgroundColor: item.colour,
                }}
              >
                {percentage > 30 && (
                  <span className="text-xs font-medium text-white drop-shadow-sm">
                    {percentage}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

interface ChatActivityChartProps {
  data: ActivityData[];
  isDarkMode?: boolean;
  height?: number;
}

export const ChatActivityChart = memo(function ChatActivityChart({
  data,
  isDarkMode = false,
  height = 200
}: ChatActivityChartProps) {
  const strokeColor = isDarkMode ? '#444' : '#E5E7EB';
  const axisColor = isDarkMode ? '#999' : '#6B7280';
  const tooltipStyle = isDarkMode ? CHART_TOOLTIP_STYLE_DARK : CHART_TOOLTIP_STYLE_LIGHT;

  const formattedData = data.map(item => ({
    ...item,
    displayDate: new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formattedData} margin={{ left: 0, right: 0 }}>
        <defs>
          <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={strokeColor} vertical={false} />
        <XAxis 
          dataKey="displayDate" 
          stroke={axisColor} 
          fontSize={11}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip 
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`${value} messages`, 'Activity']}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Area 
          type="monotone" 
          dataKey="count" 
          stroke="#D4AF37" 
          strokeWidth={2}
          fill="url(#goldGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
