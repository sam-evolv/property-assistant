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

const truncateLabel = (label: string, maxLength: number = 18): string => {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 1) + '…';
};

const cleanTopicLabel = (label: string): string => {
  return label
    .replace(/ \/ /g, ' ')
    .replace(/\//g, ' ')
    .replace(/  +/g, ' ')
    .trim();
};

export const TopQuestionsChart = memo(function TopQuestionsChart({
  data,
  isDarkMode = false,
  height = 280
}: TopQuestionsChartProps) {
  const strokeColor = isDarkMode ? '#444' : '#E5E7EB';
  const axisColor = isDarkMode ? '#999' : '#6B7280';
  const tooltipStyle = isDarkMode ? CHART_TOOLTIP_STYLE_DARK : CHART_TOOLTIP_STYLE_LIGHT;

  const formattedData = data.map((item, index) => ({
    ...item,
    uniqueKey: `${item.topic}_${index}`,
    cleanedLabel: cleanTopicLabel(item.label),
    displayLabel: truncateLabel(cleanTopicLabel(item.label)),
  }));

  const CustomYAxisTick = ({ x, y, payload }: any) => {
    const item = formattedData.find(d => d.uniqueKey === payload.value);
    const fullLabel = item?.cleanedLabel || payload.value;
    const displayLabel = item?.displayLabel || truncateLabel(payload.value);
    
    return (
      <g transform={`translate(${x},${y})`}>
        <title>{fullLabel}</title>
        <text
          x={-6}
          y={0}
          dy={4}
          textAnchor="end"
          fill={axisColor}
          fontSize={12}
          style={{ cursor: fullLabel !== displayLabel ? 'help' : 'default' }}
        >
          {displayLabel}
        </text>
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={formattedData} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={strokeColor} horizontal={false} />
        <XAxis type="number" stroke={axisColor} fontSize={12} />
        <YAxis 
          type="category" 
          dataKey="uniqueKey" 
          stroke={axisColor} 
          fontSize={12}
          width={130}
          tickLine={false}
          tick={<CustomYAxisTick />}
        />
        <Tooltip 
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`${value} questions`, 'Count']}
          labelFormatter={(label) => {
            const item = formattedData.find(d => d.uniqueKey === label);
            return item?.cleanedLabel || label;
          }}
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

const CustomTooltip = ({ active, payload, label, isDarkMode }: any) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0]?.payload;
  const count = payload[0]?.value || 0;
  const fullDate = data?.date 
    ? new Date(data.date).toLocaleDateString('en-GB', { 
        weekday: 'short',
        day: 'numeric', 
        month: 'short',
        year: 'numeric'
      })
    : label;
  
  return (
    <div className={`px-3 py-2 rounded-lg shadow-lg border ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700 text-white' 
        : 'bg-white border-gray-200 text-gray-900'
    }`}>
      <p className="text-xs font-medium opacity-70">{fullDate}</p>
      <p className="text-sm font-semibold mt-1">
        <span className="text-gold-500">{count}</span> chat interactions
      </p>
    </div>
  );
};

export const ChatActivityChart = memo(function ChatActivityChart({
  data,
  isDarkMode = false,
  height = 200
}: ChatActivityChartProps) {
  const strokeColor = isDarkMode ? '#444' : '#E5E7EB';
  const axisColor = isDarkMode ? '#999' : '#6B7280';

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
          content={<CustomTooltip isDarkMode={isDarkMode} />}
          cursor={{ stroke: '#D4AF37', strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area 
          type="monotone" 
          dataKey="count" 
          stroke="#D4AF37" 
          strokeWidth={2}
          fill="url(#goldGradient)"
          activeDot={{ r: 6, fill: '#D4AF37', stroke: isDarkMode ? '#1F2937' : '#FFFFFF', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
