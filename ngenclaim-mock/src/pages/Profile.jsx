import React from 'react';
// import { 
//   User, MapPin, Mail, Edit3, Shield,
//   Cloud, CheckCircle2, Activity, Clock
// } from 'lucide-react';

const Profile = () => {
  // LOGIC CHECK: This array provides the data for the timeline
  const pulseEvents = [
    {
      title: 'Security Policy Update',
      desc: 'Updated multi-factor authentication requirements for the Claims Adjuster tier.',
      time: '24m ago',
      node: 'Node-UK-WEST-1',
      status: 'APPLIED',
      statusColor: 'text-emerald-400 bg-emerald-400/10',
    //   icon: <Shield size={16} />
    },
    {
      title: 'Bulk Claim Validation',
      desc: 'Triggered heuristic validation on 1,402 pending claims for the Q3 audit trail.',
      time: '2h ago',
      progress: 75,
      status: 'PROCESSING',
      statusColor: 'text-blue-400 bg-blue-400/10',
    //   icon: <Activity size={16} />
    },
    {
      title: 'New User Onboarding',
      desc: 'Provisioned 12 new users from the Munich Regional Office.',
      time: 'Yesterday, 14:05',
      status: 'COMPLETE',
      statusColor: 'text-gray-400 bg-white/5',
    //   icon: <User size={16} />
    }
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER CARD */}
      <div className="bg-[#0B1224]/80 border border-white/5 rounded-[32px] p-8 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl bg-white/5">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop" 
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <button className="absolute -bottom-2 -right-2 p-2 bg-cyan-500 text-black rounded-lg shadow-lg">
              {/* <Edit3 size={14} /> */}
            </button>
          </div>
          
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-white tracking-tight">Alex Sterling</h1>
              <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                Tenant Admin
              </span>
            </div>
            <div className="flex items-center gap-6 mt-3 text-gray-500">
              <div className="flex items-center gap-2 text-xs font-medium">
                {/* <MapPin size={14} /> London HQ */}
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                {/* <Mail size={14} /> a.sterling@ngenclaim.digital */}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:bg-white/10">
            Edit Profile
          </button>
          <button className="px-6 py-3 bg-cyan-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            Action Center
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* DETAILS COLUMN */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-[#0B1224]/80 border border-white/5 rounded-3xl p-6">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6">Personal Details</h3>
            <div className="space-y-5">
              <div>
                <label className="text-[9px] font-black text-gray-600 uppercase block mb-2">Full Name</label>
                <div className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-300">Alexander Sterling</div>
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-600 uppercase block mb-2">Corporate Role</label>
                <div className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-gray-300">Senior Administrator</div>
              </div>
            </div>
          </div>

          <div className="bg-[#0B1224]/80 border border-white/5 rounded-3xl p-6">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6">Connected Accounts</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="flex items-center gap-3">
                  {/* <Cloud size={16} className="text-gray-400" /> */}
                  <span className="text-xs font-bold text-gray-300">Azure Directory</span>
                </div>
                {/* <CheckCircle2 size={16} className="text-emerald-500" /> */}
              </div>
            </div>
          </div>
        </div>

        {/* TIMELINE COLUMN */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-[#0B1224]/80 border border-white/5 rounded-[32px] p-8 h-full">
            <h3 className="text-xl font-bold text-white mb-10">System Pulse</h3>
            <div className="space-y-8 relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-[1px] bg-white/5"></div>
              {pulseEvents.map((event, i) => (
                <div key={i} className="relative flex gap-6 pl-12 group">
                  <div className="absolute left-0 w-10 h-10 rounded-xl bg-[#151D30] border border-white/10 flex items-center justify-center text-gray-400 z-10">
                    {event.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">{event.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${event.statusColor}`}>{event.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{event.desc}</p>
                    {event.progress && (
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" style={{ width: `${event.progress}%` }}></div>
                      </div>
                    )}
                    {/* <div className="text-[10px] text-gray-600 flex items-center gap-2"><Clock size={12} /> {event.time}</div> */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;