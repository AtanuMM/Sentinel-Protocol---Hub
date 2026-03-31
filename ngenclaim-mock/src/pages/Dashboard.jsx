import React, { useState } from 'react';
import StatCard from '../components/cards/StatCard';
import ProcessingTrends from '../components/ui/ProcessingTrends';
import DistributionPie from '../components/ui/DistributionPie';
import ProcessTable from '../components/ui/ProcessTable';

// Standard Lucide Icons - No custom SVGs
import { MessageSquare, AtSign, Database } from 'lucide-react'; 
import { channelStats, fileQueue } from '../data/mockData';

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState('all');

  // Mapping the component references to your data IDs
  const iconMap = {
    whatsapp: MessageSquare,
    email: AtSign,
    ftp: Database
  };

  const filteredFiles = activeFilter === 'all' 
    ? fileQueue 
    : fileQueue.filter(file => file.channel.toLowerCase().includes(activeFilter.toLowerCase()));

  return (
    <div className="space-y-8 p-4">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Data Influx</h2>
          <p className="text-gray-500 text-sm">Real-time processing channels and file extraction status.</p>
        </div>
      </div>

      {/* 3 Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {channelStats.map((stat) => (
          <StatCard 
            key={stat.id}
            {...stat}
            // Pass the component reference from our map
            icon={iconMap[stat.id]} 
            isActive={activeFilter === stat.id}
            onClick={() => setActiveFilter(stat.id)}
          />
        ))}
      </div>

      {/* Middle Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[380px]">
          <ProcessingTrends />
        </div>
        <div className="lg:col-span-1 h-[380px]">
          <DistributionPie data={channelStats} />
        </div>
      </div>
      
      {/* Table */}
      <ProcessTable files={filteredFiles} />
    </div>
  );
}