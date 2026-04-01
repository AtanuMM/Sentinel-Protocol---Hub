import React, { useState, useEffect } from 'react';
import { FileText, Database, MessageSquare, MoreVertical, Eye, X, Download, AtSign } from 'lucide-react';

// Mock JSON data to display in the modal
const mockJsonData = {
  batch_id: "HOSP_BATCH_7_XTR",
  status: "PROCESSED",
  timestamp: "2026-04-01T14:15:22Z",
  records_processed: 1450,
  success_rate: 99.8,
  data_preview: [
    { patient_id: "P-1001", claim_amount: 450.00, status: "APPROVED", diag_code: "J01.90" },
    { patient_id: "P-1002", claim_amount: 1200.50, status: "PENDING_REVIEW", diag_code: "M54.5" }
  ],
  metadata: {
    source: "FTP Server",
    encryption: "AES-256-GCM",
    integrity_hash: "a9f8b7c6d5e4f3a2b1c098d7e6f5a4b3"
  }
};

const ProcessTable = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

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
      name: 'MED_RECORD_A12.pdf', 
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
      name: 'HOSP_DATA_BATCH_7.pdf', 
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
      name: 'Patient_ID_Card.pdf', 
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
      case 'email': return <AtSign size={18} className="text-blue-400" />;
      case 'ftp': return <Database size={18} className="text-purple-400" />;
      default: return <FileText size={18} />;
    }
  };

  const handleOpenModal = (file) => {
    setSelectedFile(file);
    setIsModalOpen(true);
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mockJsonData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${selectedFile?.name.split('.')[0] || 'extracted_data'}.json`);
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <>
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
                      {getIcon(file.type)}
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
                        onClick={() => handleOpenModal(file)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all
                          ${file.progress === 100 
                            ? 'bg-purple-500/10 border border-purple-500/40 text-purple-400 hover:bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)] cursor-pointer' 
                            : 'bg-white/5 border border-white/5 text-gray-600 cursor-not-allowed opacity-40'}`}
                      >
                        <Eye size={14} />
                        View JSON
                      </button>
                      <button className="p-2 text-gray-600 hover:text-white cursor-pointer transition-colors">
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

      {/* JSON Viewer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050914]/80 backdrop-blur-sm">
          <div className="bg-[#0B1224] border border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.15)] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-white/10 bg-white/[0.02]">
              <div>
                <h2 className="text-white font-bold text-lg tracking-wide flex items-center gap-3">
                  <Database className="text-purple-400" size={20} />
                  Extracted JSON Payload
                </h2>
                <p className="text-gray-500 text-xs mt-1 font-mono">{selectedFile?.name}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (JSON Display) */}
            <div className="p-6 overflow-y-auto flex-1 bg-[#050914]">
              <pre className="font-mono text-sm text-cyan-300/90 whitespace-pre-wrap leading-relaxed">
                <code>
                  {JSON.stringify(mockJsonData, null, 2)}
                </code>
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-white/10 bg-white/[0.02] flex justify-end gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-widest cursor-pointer"
              >
                Close
              </button>
              <button 
                onClick={handleDownloadJson}
                className="px-5 py-2.5 rounded-lg text-xs font-bold text-purple-100 bg-purple-600 hover:bg-purple-500 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-2 uppercase tracking-widest cursor-pointer"
              >
                <Download size={16} />
                Download JSON
              </button>
            </div>
            
          </div>
        </div>
      )}
    </>
  );
};

export default ProcessTable;