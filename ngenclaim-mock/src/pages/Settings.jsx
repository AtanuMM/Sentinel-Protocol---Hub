import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, Sun, Moon, Monitor, 
  Mail, Bell, MessageSquare, Key, RefreshCw, 
  Shield, Smartphone, Laptop, Upload, Plus, ShieldCheck, Copy
} from 'lucide-react';

const Settings = () => {
  // Local state for UI toggles to make the demo interactive
  const [theme, setTheme] = useState('dark');
  const [toggles, setToggles] = useState({ email: true, push: false, banners: true });

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER */}
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-gray-400 text-sm mt-2 max-w-2xl">
          Configure your digital ecosystem and manage technical infrastructure for the insurance pipeline.
        </p>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (Wider) */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          
          {/* SYSTEM PREFERENCES CARD */}
          <div className="bg-[#0B1224]/80 border border-white/5 rounded-3xl p-8 backdrop-blur-md">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">System Preferences</h3>
                <p className="text-[10px] text-gray-500 uppercase mt-1">Global interface and alert behavior</p>
              </div>
              <SettingsIcon size={18} className="text-gray-600" />
            </div>

            <div className="grid grid-cols-2 gap-12">
              {/* Visual Mode */}
              <div>
                <h4 className="text-[10px] font-black text-white uppercase mb-4">Visual Mode</h4>
                <div className="flex gap-3">
                  {[
                    { id: 'light', icon: <Sun size={18} />, label: 'Light' },
                    { id: 'dark', icon: <Moon size={18} />, label: 'Dark' },
                    { id: 'system', icon: <Monitor size={18} />, label: 'System' }
                  ].map((mode) => (
                    <button 
                      key={mode.id}
                      onClick={() => setTheme(mode.id)}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                        theme === mode.id 
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {mode.icon}
                      <span className="text-[9px] font-bold uppercase mt-2">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification Channels */}
              <div>
                <h4 className="text-[10px] font-black text-white uppercase mb-4">Notification Channels</h4>
                <div className="space-y-3">
                  {[
                    { id: 'email', icon: <Mail size={14} />, label: 'Email Alerts' },
                    { id: 'push', icon: <Bell size={14} />, label: 'Desktop Push' },
                    { id: 'banners', icon: <MessageSquare size={14} />, label: 'In-app Banners' }
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{item.icon}</span>
                        <span className="text-xs font-medium text-gray-300">{item.label}</span>
                      </div>
                      {/* Custom Toggle Switch */}
                      <button 
                        onClick={() => setToggles({ ...toggles, [item.id]: !toggles[item.id] })}
                        className={`w-10 h-5 rounded-full relative transition-colors ${toggles[item.id] ? 'bg-cyan-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${toggles[item.id] ? 'left-6' : 'left-1'}`}></div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECURITY & AUTHENTICATION CARD */}
          <div className="bg-[#0B1224]/80 border border-white/5 rounded-3xl p-8 backdrop-blur-md">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Security & Authentication</h3>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Secure Connection</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Key size={14} />
                  </div>
                  <h4 className="text-sm font-bold text-white">Password Update</h4>
                </div>
                <p className="text-[10px] text-gray-500 mb-4">Strongly recommended to rotate every 90 days.</p>
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest group-hover:underline">Change Now ›</span>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-300">
                      <ShieldCheck size={14} />
                    </div>
                    <h4 className="text-sm font-bold text-white">2FA Status</h4>
                  </div>
                  <span className="text-[8px] font-black text-black bg-white px-2 py-0.5 rounded uppercase tracking-widest">Enabled</span>
                </div>
                <p className="text-[10px] text-gray-500 mb-4">Multi-factor authentication via Authenticator App.</p>
                <span className="text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-widest cursor-pointer transition-colors">Manage Methods</span>
              </div>
            </div>

            {/* Recent Login Activity */}
            <div>
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Recent Login Activity</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <Laptop size={16} className="text-gray-500" />
                    <div>
                      <p className="text-xs font-bold text-white">Chrome on MacOS (London, UK)</p>
                      <p className="text-[10px] text-emerald-500 mt-0.5">Current Session • 192.168.1.45</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Smartphone size={16} className="text-gray-500" />
                    <div>
                      <p className="text-xs font-bold text-white">iPhone 14 Pro (Paris, FR)</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">5 hours ago • 82.14.21.102</p>
                    </div>
                  </div>
                  <button className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest transition-colors">Revoke</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Narrower) */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          
          {/* API INTEGRATION CARD */}
          <div className="bg-[#0B1224]/80 border border-white/5 rounded-3xl p-8 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#FEB127]/10 flex items-center justify-center text-[#FEB127]">
                <Shield size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">API Integration</h3>
                <p className="text-[10px] text-gray-500 uppercase">Secure gateway keys</p>
              </div>
            </div>

            <div className="bg-[#151D30]/60 border border-white/5 rounded-2xl p-5 mb-4">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Active Production Key</p>
              <div className="flex justify-between items-center bg-black/40 px-4 py-3 rounded-xl border border-white/5">
                <code className="text-xs text-cyan-400 font-mono">ng_live_sdf8x...92kd</code>
                <Copy size={14} className="text-gray-500 hover:text-white cursor-pointer transition-colors" />
              </div>
              <p className="text-[9px] text-[#FEB127] mt-3 flex items-center gap-1.5 font-medium">
                <span className="w-1 h-1 rounded-full bg-[#FEB127]"></span> Rotated 14 days ago
              </p>
            </div>

            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5 transition-colors">
              <RefreshCw size={14} /> Rotate API Secret
            </button>
            <p className="text-[9px] text-gray-600 mt-4 text-center">Connected to: Guidewire, Duck Creek, Salesforce</p>
          </div>

          {/* TENANT BRANDING CARD */}
          <div className="bg-[#0B1224]/80 border border-white/5 rounded-3xl p-8 backdrop-blur-md">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Tenant Branding</h3>
            
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Portal Personality</p>
            <div className="flex gap-4 mb-8">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-cyan-400 mb-2 ring-2 ring-offset-2 ring-offset-[#0B1224] ring-cyan-500/50"></div>
                <span className="text-[9px] font-black text-gray-400 uppercase">Primary</span>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#a78bfa] mb-2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"></div>
                <span className="text-[9px] font-black text-gray-600 uppercase">Accent</span>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl border border-dashed border-white/20 flex items-center justify-center mb-2 hover:border-white/50 hover:bg-white/5 transition-all cursor-pointer">
                  <Plus size={16} className="text-gray-500" />
                </div>
                <span className="text-[9px] font-black text-gray-600 uppercase">Custom</span>
              </div>
            </div>

            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Portal Assets</p>
            <div className="h-40 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center mb-6 group hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-30 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all">
                 {/* Mock Logo placeholder matching the design */}
                <div className="text-center">
                  <h1 className="text-2xl font-black text-white tracking-tighter">TEAM</h1>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">safe work</p>
                </div>
              </div>
              <div className="absolute bottom-4 flex items-center gap-2 text-[9px] font-black text-cyan-400 uppercase opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                <Upload size={12} /> Update Custom Logo
              </div>
            </div>

            <button className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 text-black text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all">
              Save Portal Configuration
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;