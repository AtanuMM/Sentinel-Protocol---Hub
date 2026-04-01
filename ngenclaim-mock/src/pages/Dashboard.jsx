import React, { useState, useMemo, useEffect } from 'react';
import StatCard from '../components/cards/StatCard';
import ProcessingTrends from '../components/ui/ProcessingTrends';
import DistributionPie from '../components/ui/DistributionPie';
import ProcessTable from '../components/ui/ProcessTable';
import { MessageSquare, AtSign, Database, ChevronDown, Filter, Activity, Rocket } from 'lucide-react'; 

const FILTER_OPTIONS = {
  insurance: ["All Insurance", "AIG", "MetLife", "BlueCross", "Prudential"],
  tpa: ["All TPA Offices", "NY Central Hub", "Chicago Branch", "West Coast"],
  hospital: ["All Hospitals", "City Medical", "Mayo Clinic", "St. Jude"],
  status: ["All Statuses", "Processing", "Validation", "Complete"]
};

export default function Dashboard() {
  // 1. Dual State: One for the UI dropdowns, one for the actual Data Engine
  const [tempFilters, setTempFilters] = useState({
    insurance: "All Insurance",
    tpa: "All TPA Offices",
    hospital: "All Hospitals",
    status: "All Statuses"
  });

  const [activeFilters, setActiveFilters] = useState({ ...tempFilters });
  const [isSyncing, setIsSyncing] = useState(false);

  // 2. The Data Engine only watches 'activeFilters'
  const reactiveData = useMemo(() => {
    const getWeight = (category, value) => FILTER_OPTIONS[category].indexOf(value) + 1;
    
    // Higher multipliers to make the "jump" from 30 to 150+ very obvious
    const weight = 
      getWeight('insurance', activeFilters.insurance) * 15 + 
      getWeight('tpa', activeFilters.tpa) * 25 + 
      getWeight('hospital', activeFilters.hospital) * 40;

    return {
      stats: [
        { id: 'whatsapp', title: 'WhatsApp', count: Math.floor(weight * 0.8 + 15), colorClass: 'text-emerald-400', bgClass: 'bg-emerald-400', hex: '#34d399' },
        { id: 'email', title: 'Email Gateway', count: Math.floor(weight * 2.5 + 40), colorClass: 'text-blue-400', bgClass: 'bg-blue-400', hex: '#60a5fa' },
        { id: 'ftp', title: 'FTP Server', count: Math.floor(weight * 8.2 + 120), colorClass: 'text-purple-400', bgClass: 'bg-purple-400', hex: '#c084fc' }
      ],
      graph: Array.from({ length: 6 }, (_, i) => ({
        time: `${(i * 4).toString().padStart(2, '0')}:00`,
        volume: Math.floor(((weight * (i + 1)) % 150) + 30) 
      }))
    };
  }, [activeFilters]);

  // 3. Trigger the "Jump"
  const handleShowData = () => {
    setIsSyncing(true);
    // Artificial delay to make the "Processing" feel real
    setTimeout(() => {
      setActiveFilters({ ...tempFilters });
      setIsSyncing(false);
    }, 800);
  };

  const iconMap = { whatsapp: MessageSquare, email: AtSign, ftp: Database };

  return (
    <div className="space-y-8 p-6 bg-[#050914] min-h-screen">
      
      {/* --- GLOBAL FILTER BAR --- */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-[#0B1224] border border-white/5 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Animated background glow when syncing */}
        {isSyncing && <div className="absolute inset-0 bg-purple-500/5 animate-pulse" />}

        <div className="flex items-center gap-3 pr-6 border-r border-white/10">
          <Filter size={18} className="text-purple-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Query Panel</span>
        </div>

        {Object.keys(FILTER_OPTIONS).map((key) => (
          <div key={key} className="relative group min-w-[160px]">
            <select 
              value={tempFilters[key]}
              onChange={(e) => setTempFilters(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[11px] font-bold text-gray-300 hover:bg-white/10 transition-all cursor-pointer outline-none focus:border-purple-500/50 uppercase"
            >
              {FILTER_OPTIONS[key].map(opt => <option key={opt} value={opt} className="bg-[#0B1224]">{opt}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none group-hover:text-white transition-colors" size={14} />
          </div>
        ))}

        {/* --- THE ACTION BUTTON --- */}
        <button 
          onClick={handleShowData}
          disabled={isSyncing}
          className={`ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all
            ${isSyncing 
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] active:scale-95'
            }`}
        >
          {isSyncing ? <Activity size={16} className="animate-spin" /> : <Rocket size={16} />}
          {isSyncing ? 'Processing...' : 'Show Data'}
        </button>
      </div>

      {/* --- STAT CARDS --- */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-500 ${isSyncing ? 'opacity-50 grayscale' : 'opacity-100 grayscale-0'}`}>
        {reactiveData.stats.map((stat) => (
          <StatCard key={stat.id} {...stat} icon={iconMap[stat.id]} />
        ))}
      </div>

      {/* --- CHARTS --- */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-700 ${isSyncing ? 'blur-sm scale-[0.99]' : 'blur-0 scale-100'}`}>
        <div className="lg:col-span-2 h-[400px]">
          <ProcessingTrends chartData={reactiveData.graph} />
        </div>
        <div className="lg:col-span-1 h-[400px]">
          <DistributionPie data={reactiveData.stats} />
        </div>
      </div>
      
      <ProcessTable />
    </div>
  );
}