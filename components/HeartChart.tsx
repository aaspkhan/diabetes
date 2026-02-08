import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  time: string;
  bpm: number;
}

interface HeartChartProps {
  data: DataPoint[];
}

export const HeartChart: React.FC<HeartChartProps> = ({ data }) => {
  return (
    <div className="w-full h-64 min-w-0 relative" style={{ width: '100%', height: '16rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="time" 
            tick={{ fill: '#94a3b8', fontSize: 10 }} 
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis 
            domain={['dataMin - 5', 'dataMax + 5']} 
            tick={{ fill: '#94a3b8', fontSize: 10 }} 
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#ef4444' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Area 
            type="monotone" 
            dataKey="bpm" 
            stroke="#ef4444" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorBpm)" 
            isAnimationActive={true} 
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};