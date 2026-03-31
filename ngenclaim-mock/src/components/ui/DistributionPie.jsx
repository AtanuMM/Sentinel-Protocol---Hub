// src/components/ui/DistributionPie.jsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function DistributionPie({ data }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="bg-[#111827]/80 p-6 rounded-2xl border border-white/5 h-full flex flex-col relative">
      <div>
        <h3 className="text-lg font-bold text-white">Channel Distribution</h3>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Data Source Split</p>
      </div>

      <div className="flex-1 relative mt-4 min-h-[180px]">
        {/* Center Text absolute positioned over the donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-white">{total}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-widest">Total Files</span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={60} outerRadius={80} paddingAngle={0} dataKey="count" stroke="none">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.hexColor} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Legend */}
      <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
        {data.map(item => {
          const percent = Math.round((item.count / total) * 100);
          return (
            <div key={item.id} className="text-center">
              <span className={`text-sm font-bold ${item.colorClass}`}>{percent}%</span>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">{item.title}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}