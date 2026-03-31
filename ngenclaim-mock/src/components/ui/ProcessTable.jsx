import React, { useState, useEffect } from 'react';
import { FileText, Mail, Database, MessageSquare, MoreVertical, Eye } from 'lucide-react';

const ProcessTable = () => {
  const [queue, setQueue] = useState([
    { 
      id: 'F-882', 
      name: 'CLAIM_NYC_882.pdf', 
      size: '2.4 MB', 
      time: '14:22:01', 
      channel: 'WhatsApp', 
      type: 'whatsapp', 
      progress: 85, 
      status: 'EXTRACTION', 
      next: 'VALIDATION',
      color: 'bg-emerald-400' 
    },
    { 
      id: 'F-A12', 
      name: 'MED_RECORD_A12.zip', 
      size: '12.8 MB', 
      time: '14:19:45', 
      channel: 'Email Gateway', 
      type: 'email', 
      progress: 40, 
      status: 'VALIDATION', 
      next: 'PROCESSING',
      color: 'bg-blue-400' 
    },
    { 
      id: 'F-B07', 
      name: 'HOSP_DATA_BATCH_7.csv', 
      size: '45.2 MB', 
      time: '14:15:22', 
      channel: 'FTP Server', 
      type: 'ftp', 
      progress: 100, 
      status: 'COMPLETE', 
      next: 'EXPORTED',
      color: 'bg-purple-500' 
    },
    { 
      id: 'F-I04', 
      name: 'Patient_ID_Card.jpg', 
      size: '1.1 MB', 
      time: '14:25:10', 
      channel: 'WhatsApp', 
      type: 'whatsapp', 
      progress: 12, 
      status: 'UPLOADING', 
      next: 'EXTRACTION',
      color: 'bg-emerald-400' 
    }
  ]);

  // Logic: Increase 1% every 2 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setQueue(prevQueue => prevQueue.map(file => {
        // Cap at 99% for non-complete files to keep the "View JSON" locked
        if (file.progress < 99 && file.status !== 'COMPLETE') {
          return { ...file, progress: file.progress + 1 };
        }
        return file;
      }));
    }, 2000); // 2-second interval

    return () => clearInterval(timer);
  }, []);

  const getIcon = (type) => {
    switch(type) {
      case 'whatsapp': return <MessageSquare size={18} className="text-emerald-400" />;
      case 'email': return <AtSign size={18} className="text-blue-400" />; // Note: Ensure AtSign is imported if using
      case 'ftp': return <Database size={18} className="text-purple-400" />;
      default: return <FileText size={18} />;
    }
  };

  return (
    <div className="bg-[#0B1224]/80 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Table Header */}
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-lg font-bold text-white uppercase tracking-widest">Queue Management</h3>
        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"></span>
          Live Sync Active
        </div>
      </div>

      <div className="p-6 overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-3">
          <thead>
            <tr className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
              <th className="pb-4 px-4">File Identity</th>
              <th className="pb-4 px-4">Source</th>
              <th className="pb-4 px-4 w-1/3">Processing Pipeline</th>
              <th className="pb-4 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((file) => (
              <tr key={file.id} className="bg-white/[0.02] hover:bg-white/[0.05] transition-colors group">
                {/* File Info */}
                <td className="py-4 px-4 rounded-l-xl border-y border-l border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/5 rounded-lg text-gray-400 group-hover:text-white transition-colors">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{file.name}</div>
                      <div className="text-[10px] text-gray-500">{file.size} • {file.time}</div>
                    </div>
                  </div>
                </td>

                {/* Source */}
                <td className="py-4 px-4 border-y border-white/5">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                    {file.channel}
                  </div>
                </td>

                {/* Progress Bar Container */}
                <td className="py-4 px-4 border-y border-white/5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${file.progress === 100 ? 'text-purple-400' : 'text-emerald-400'}`}>
                      {file.status} {file.progress}%
                    </span>
                    <span className="text-[9px] font-bold text-gray-600 uppercase italic">Next: {file.next}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                    <div 
                      className={`h-full ${file.color} rounded-full transition-all duration-1000 ease-linear shadow-[0_0_12px_currentColor]`}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </td>

                {/* View JSON Button */}
                <td className="py-4 px-4 rounded-r-xl border-y border-r border-white/5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      disabled={file.progress < 100}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all
                        ${file.progress === 100 
                          ? 'bg-purple-500/10 border border-purple-500/40 text-purple-400 hover:bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                          : 'bg-white/5 border border-white/5 text-gray-600 cursor-not-allowed opacity-40'}`}
                    >
                      <Eye size={14} />
                      View JSON
                    </button>
                    <button className="p-2 text-gray-600 hover:text-white">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProcessTable;