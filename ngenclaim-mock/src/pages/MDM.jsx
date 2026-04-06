import React from 'react';
import { 
  Database, Server, Globe, History, Activity, 
  Plus, Play, ChevronRight, Search, Zap, Shield
} from 'lucide-react';

const MDM = () => {
  const commonTables = [
    { name: 'Auth_Providers', id: '0XCF42', records: '12,402', type: 'SYSTEM', icon: <Zap size={18} /> },
    { name: 'Policy_Schemas', id: '0XA1B2', records: '854', type: 'CORE', icon: <Shield size={18} /> },
    { name: 'Localization_Ref', id: '0XB8EE', records: '45,109', type: 'GLOBAL', icon: <Globe size={18} /> },
    { name: 'Audit_Trails', id: '0X00FF', records: '1.2M+', type: 'LOGS', icon: <History size={18} /> },
  ];

  const tenantTables = [
    { name: 'AXA_Global_Claims', tenant: 'TX_001', records: '428,103', status: 'ACTIVE' },
    { name: 'Allianz_Member_Vault', tenant: 'TX_772', records: '1,029,442', status: 'ACTIVE' },
    { name: 'Prudential_Ledger', tenant: 'TX_211', records: '88,290', status: 'ACTIVE' },
  ];

  const migrationLogs = [
    { hash: '0x8F21...D8C', source: 'Policy_Schemas', action: 'SCHEMA_UPGRADE', status: 'SUCCESS', duration: '1.42s' },
    { hash: '0x6A11...ED8', source: 'AXA_Global_Claims', action: 'INDEX_REBUILD', status: 'COMPLETE', duration: '12.04s' },
    { hash: '0xCC22...77F', source: 'Audit_Trails', action: 'PARTITION_ROTATION', status: 'SUCCESS', duration: '4.88s' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight uppercase">Master Data Engine</h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
            <Activity size={12} className="text-cyan-400" />
            System Configuration & Schema Management
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-white/10 transition-all">
            <Play size={14} className="text-emerald-400" />
            Run Migration
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all">
            <Plus size={14} />
            Add New Table
          </button>
        </div>
      </div>

      {/* COMMON SYSTEM TABLES */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Common System Tables</h3>
          <div className="h-[1px] flex-1 bg-white/5"></div>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {commonTables.map((table, i) => (
            <div key={i} className="group bg-[#0B1224]/60 border border-white/5 p-5 rounded-2xl hover:border-cyan-500/30 transition-all cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] font-black bg-white/10 px-2 py-1 rounded text-gray-400 uppercase tracking-tighter">
                  {table.type}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                {table.icon}
              </div>
              <h4 className="text-sm font-bold text-white mb-1">{table.name}</h4>
              <p className="text-[9px] text-gray-600 font-mono mb-4 uppercase">Table Identity: {table.id}</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Records</p>
                  <p className="text-lg font-black text-white">{table.records}</p>
                </div>
                <button className="text-[10px] font-black text-cyan-400 uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  View Data <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TENANT-SPECIFIC TABLES */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tenant-Specific Tables</h3>
          <div className="h-[1px] flex-1 bg-white/5"></div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {tenantTables.map((table, i) => (
            <div key={i} className="bg-[#151D30]/40 border border-white/5 p-6 rounded-2xl relative group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Database size={20} />
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-gray-500 uppercase">Tenant ID</p>
                  <p className="text-xs font-mono text-gray-300">@ {table.tenant}</p>
                </div>
              </div>
              <h4 className="text-md font-bold text-white mb-6 tracking-wide">{table.name}</h4>
              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">Status: Active</span>
                  </div>
                  <p className="text-xl font-black text-white tracking-tighter">{table.records}</p>
                  <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Total Entities</p>
                </div>
                <button className="px-4 py-2 bg-white/5 rounded-lg text-[10px] font-black text-cyan-400 uppercase border border-white/5 hover:bg-cyan-500 hover:text-black transition-all">
                  View Data
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MIGRATION LOGS - TERMINAL STYLE */}
      <section className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <History size={18} className="text-gray-500" />
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Migration Intelligence Logs</h3>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-md text-[9px] font-bold text-gray-500 uppercase border border-white/5 hover:text-white transition-colors">
            <Search size={12} /> Filter Logs...
          </button>
        </div>
        <div className="p-0 font-mono">
          <table className="w-full">
            <thead>
              <tr className="text-[9px] text-gray-600 uppercase tracking-widest border-b border-white/5">
                <th className="p-4 font-bold text-left">Event Hash</th>
                <th className="p-4 font-bold text-left">Entity Source</th>
                <th className="p-4 font-bold text-left">Action</th>
                <th className="p-4 font-bold text-left">Status</th>
                <th className="p-4 font-bold text-left text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {migrationLogs.map((log, i) => (
                <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4 text-xs text-cyan-500/70 group-hover:text-cyan-400 transition-colors font-bold">{log.hash}</td>
                  <td className="p-4 text-xs text-gray-400 uppercase font-bold">{log.source}</td>
                  <td className="p-4">
                    <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded text-gray-400 border border-white/10 font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">{log.status}</span>
                    </div>
                  </td>
                  <td className="p-4 text-xs text-gray-600 text-right italic">{log.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="w-full p-3 text-[9px] font-black text-gray-700 uppercase tracking-widest hover:text-gray-400 transition-colors bg-white/[0.01]">
            Load Extended History Archive
          </button>
        </div>
      </section>
    </div>
  );
};

export default MDM;