import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function DistributionPie({ data }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="bg-[#0B1224] p-6 rounded-2xl border border-white/5 h-full flex flex-col relative shadow-2xl">
      <div>
        <h3 className="text-xl font-bold text-white tracking-tight uppercase">Channel Distribution</h3>
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mt-1">Data Source Split</p>
      </div>

      <div className="flex-1 relative mt-4 min-h-[180px]">
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-white leading-none">{total}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-[0.2em] mt-1">Total Files</span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={data} 
              cx="50%" 
              cy="50%" 
              innerRadius={65} 
              outerRadius={85} 
              paddingAngle={5} 
              dataKey="count" 
              stroke="none"
              // Adding an animation for smoother data transitions
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.hex} // Correctly using the hex code
                  style={{ filter: `drop-shadow(0 0 8px ${entry.hex}66)` }} // Optional: Adds a subtle neon glow
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Legend */}
      <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
        {data.map(item => {
          const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.id} className="text-center">
              <span className={`text-sm font-black ${item.colorClass}`}>{percent}%</span>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">{item.title.split(' ')[0]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}