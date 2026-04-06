import React, { useState, useEffect } from 'react';
// Added AlertTriangle, ShieldCheck, and AlertCircle for the risk indicators
import { FileText, Database, MessageSquare, MoreVertical, Eye, X, Download, AtSign, FileJson, AlertTriangle, ShieldCheck, AlertCircle } from 'lucide-react';

// Mock JSON data to display in the modal
const mockJsonData = {
  "extraction_summary": {
    "file_name": "Sample filled Claim Form.pdf",
    "tpa_name": "PARAMOUNT HEALTH SERVICES & INSURANCE TPA PRIVATE LIMITED",
    "status": "PROCESSED",
    "extraction_timestamp": "2026-04-01T19:29:00Z"
  },
  "primary_insured_details": {
    "policy_no": "12345678",
    "tpa_id_no": "LMN1234",
    "name": "XYZ",
    "address": "ADDRESS",
    "city": "MAHARASHTRA",
    "pin_code": "4000",
    "email_id": "xyz@gmail.com",
    "pan": "ABCDEF5555"
  },
  "patient_hospitalized_details": {
    "name": "FIRST NAME SURNAME E NAME",
    "gender": "Female",
    "relationship_to_primary_insured": "Spouse",
    "occupation": "Service",
    "hospital_name": "HOSP N"
  },
  "hospitalization_info": {
    "room_category": "Day care",
    "hospitalization_due_to": "Injury",
    "injury_cause": "Self inflicted",
    "date_of_admission": "DD/MM/YY",
    "time_of_admission": "HH:MM",
    "date_of_discharge": "DD/MM/YY",
    "time_of_discharge": "HH:MM"
  },
  "claim_expenses_summary": {
    "pre_hospitalization": 7000,
    "hospitalization": 0,
    "post_hospitalization": 5,
    "total_claimed_amount": 19500,
    "pre_hospitalization_period_days": "07"
  },
  "bank_details": {
    "bank_name": "ABCDEFG",
    "account_number": "XXXXXXXXXXXX",
    "ifsc_code": "ABCD0123456"
  },
  "submitted_documents_checklist": {
    "claim_form_signed": "Y",
    "hospital_main_bill": "Y",
    "hospital_breakup_bill": "Y",
    "hospital_discharge_summary": "Y",
    "pharmacy_bill": "Y"
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

  useEffect(() => {
    const timer = setInterval(() => {
      setQueue(prevQueue => prevQueue.map(file => {
        if (file.progress < 99 && file.status !== 'COMPLETE') {
          return { ...file, progress: file.progress + 1 };
        }
        return file;
      }));
    }, 2000);
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
                  <td className="py-4 px-4 border-y border-white/5">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                      {getIcon(file.type)}
                      {file.channel}
                    </div>
                  </td>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative bg-[#0B1224] border border-white/10 w-full max-w-7xl h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* --- MODAL HEADER --- */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-3 w-1/3">
                <Database className="text-purple-400" size={20} />
                <div>
                  <h2 className="text-white font-bold tracking-tight">Data Extraction Verification</h2>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{selectedFile?.name}</p>
                </div>
              </div>

              {/* --- RISK SCORE INDICATORS (Comment/Uncomment to switch states) --- */}
              <div className="flex-1 flex justify-center">
                
                {/* 1. RED: High Risk (Currently Active) */}
                <div className="flex items-center gap-2 px-5 py-2 bg-red-500/10 border border-red-500/40 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse">
                  <AlertTriangle size={18} className="text-red-400" />
                  <span className="text-[11px] font-black text-red-400 uppercase tracking-[0.15em]">High Fraud Risk: 92%</span>
                </div>

                {/* 2. YELLOW: Medium Risk */}
                
                {/* <div className="flex items-center gap-2 px-5 py-2 bg-yellow-500/10 border border-yellow-500/40 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                  <AlertCircle size={18} className="text-yellow-400" />
                  <span className="text-[11px] font-black text-yellow-400 uppercase tracking-[0.15em]">Moderate Risk: 45%</span>
                </div> */}
               

                {/* 3. GREEN: Low Risk */}
                {/*
                <div className="flex items-center gap-2 px-5 py-2 bg-emerald-500/10 border border-emerald-500/40 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.15em]">Clear • Low Risk: 4%</span>
                </div>
                */}

              </div>

              <div className="flex justify-end w-1/3">
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* LEFT PANEL: NATIVE PDF VIEW */}
              <div className="w-1/2 border-r border-white/5 bg-[#1a1d23] flex flex-col">
                <div className="p-3 bg-white/5 flex items-center gap-2 border-b border-white/5">
                  <FileText size={14} className="text-gray-400" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Source Document</span>
                </div>
                <div className="flex-1 bg-[#1a1d23]">
                  <embed
                    src="/Sample_filled_Claim_Form.pdf#navpanes=0&toolbar=0&view=FitH"
                    type="application/pdf"
                    className="w-full h-full border-none"
                  />
                </div>
              </div>

              {/* RIGHT PANEL: JSON OUTPUT */}
              <div className="w-1/2 flex flex-col bg-[#050914]">
                <div className="p-3 bg-white/5 border-b border-white/5 flex items-center gap-2">
                  <FileJson size={14} className="text-purple-400" />
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Extracted Payload</span>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  <pre className="text-cyan-400 font-mono text-xs leading-relaxed">
                    {JSON.stringify(mockJsonData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white uppercase">Close</button>
              <button onClick={handleDownloadJson} className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest">
                <Download size={14} /> Download JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProcessTable;