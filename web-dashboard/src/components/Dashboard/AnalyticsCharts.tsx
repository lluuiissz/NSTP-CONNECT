'use client'

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';

interface ChartProps {
  logs: any[];
}

export default function AnalyticsCharts({ logs }: ChartProps) {
  // Aggregate data for "Hours by Municipality"
  // Assuming log.activities.municipality exists
  const municipalityDataMap: Record<string, number> = {};
  
  // Aggregate data for "Daily Check-ins" (last 7 days)
  const dailyCheckinsMap: Record<string, number> = {};
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyCheckinsMap[dateStr] = 0;
  }

  logs.forEach((log) => {
    // Bar Chart Logic
    const municipality = log.activities?.municipality || 'Unknown';
    const hours = Number(log.service_hours) || 0;
    if (!municipalityDataMap[municipality]) {
      municipalityDataMap[municipality] = 0;
    }
    municipalityDataMap[municipality] += hours;

    // Line Chart Logic
    const logDate = new Date(log.created_at);
    const logDateStr = logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (dailyCheckinsMap[logDateStr] !== undefined) {
      dailyCheckinsMap[logDateStr] += 1;
    }
  });

  const barChartData = Object.keys(municipalityDataMap).map(key => ({
    name: key,
    hours: Number(municipalityDataMap[key].toFixed(2))
  })).sort((a, b) => b.hours - a.hours); // Sort by highest hours

  const lineChartData = Object.keys(dailyCheckinsMap).map(key => ({
    date: key,
    checkins: dailyCheckinsMap[key]
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-sm border border-slate-200 p-3 rounded-lg shadow-lg">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-blue-600 text-sm font-medium">
            {payload[0].name === 'hours' ? 'Total Hours' : 'Check-ins'}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
      
      {/* Bar Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800">Total Hours by Municipality</h3>
          <p className="text-sm text-slate-500">Accumulated volunteer service hours per region.</p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barChartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar 
                dataKey="hours" 
                fill="#2563eb" 
                radius={[4, 4, 0, 0]}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Line Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800">Check-ins (Last 7 Days)</h3>
          <p className="text-sm text-slate-500">Daily volunteer activity engagement trends.</p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={lineChartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="checkins" 
                stroke="#7c3aed" 
                strokeWidth={3}
                dot={{ fill: '#7c3aed', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
