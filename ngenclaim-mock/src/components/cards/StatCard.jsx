import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ 
  title, 
  count, 
  description, 
  status, 
  icon: Icon, // Destructure as a component
  colorClass, 
  bgClass, 
  isActive, 
  onClick 
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -5 }}
      className={`relative p-6 rounded-2xl bg-[#0B1224] border transition-all duration-300 cursor-pointer h-full flex flex-col justify-between
        ${isActive ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-white/5'}`}
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          {/* Icon Box */}
          <div className={`relative p-3 rounded-xl ${bgClass} bg-opacity-10 flex items-center justify-center border border-white/5`}>
            {/* Render the Lucide Component here */}
            {Icon && <Icon size={24} strokeWidth={2.5} />}
            
            {/* The status dot tucked in the corner */}
            <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${bgClass} shadow-[0_0_8px_currentColor]`}></div>
          </div>

          <h3 className={`text-4xl font-bold tracking-tighter ${colorClass}`}>{count}</h3>
        </div>

        <h4 className="text-lg font-bold text-white mb-1 uppercase tracking-tight">{title}</h4>
        <p className="text-xs text-gray-500 leading-relaxed font-medium">{description}</p>
      </div>
      
      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/5">
        <div className={`w-1.5 h-1.5 rounded-full ${bgClass} shadow-[0_0_10px_currentColor] animate-pulse`}></div>
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em]">
          System Status: <span className={colorClass}>{status}</span>
        </span>
      </div>
    </motion.div>
  );
}