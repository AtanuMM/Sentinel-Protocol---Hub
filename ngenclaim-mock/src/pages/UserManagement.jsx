import React, { useState } from 'react';
import { 
  Users, Shield, Key, Search, Plus, Edit2, Trash2, 
  MoreVertical, Check, ShieldCheck, UserPlus, Filter, Download
} from 'lucide-react';

const UserManagement = () => {
  const [users] = useState([
    { id: 1, name: 'Jordan Sterling', email: 'j.sterling@ngenclaim.io', role: 'SYSTEM ADMIN', status: 'Active', lastActive: '2 mins ago', avatar: 'JS' },
    { id: 2, name: 'Avery Moore', email: 'a.moore@ngenclaim.io', role: 'CLAIMS OFFICER', status: 'Active', lastActive: '1 hour ago', avatar: 'AM' },
    { id: 3, name: 'Thomas Keng', email: 't.keng@ngenclaim.io', role: 'GUEST AUDIT', status: 'Offline', lastActive: '2 days ago', avatar: 'TK' },
  ]);

  const roles = [
    { name: 'System Admin', desc: 'Full Permission Access', count: 2 },
    { name: 'Claims Officer', desc: 'Standard Processing', count: 12 },
    { name: 'Audit Team', desc: 'Read-Only Logs', count: 5 },
  ];

  const permissions = [
    'CLAIMS_CREATE', 'CLAIMS_EDIT', 'DOCUMENT_UPLOAD', 
    'CLAIMS_APPROVE', 'CLIENT_SEARCH', 'SYSTEM_REBOOT'
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight uppercase">Access Control</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
              System Authentication & RBAC Protocols
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-white/10 transition-all">
            <Shield size={14} />
            Create New Role
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all">
            <UserPlus size={14} />
            Add User
          </button>
        </div>
      </div>

      {/* TOP GRID: ROLES & PERMISSIONS */}
      <div className="grid grid-cols-12 gap-6">
        {/* ACTIVE ROLES */}
        <div className="col-span-4 bg-[#0B1224]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Roles</h3>
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">03 TOTAL</span>
          </div>
          <div className="space-y-3">
            {roles.map((role, i) => (
              <div key={i} className="group flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-cyan-500/30 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-1 h-8 bg-cyan-500 rounded-full"></div>
                  <div>
                    <div className="text-sm font-bold text-white uppercase">{role.name}</div>
                    <div className="text-[10px] text-gray-500">{role.desc}</div>
                  </div>
                </div>
                <Edit2 size={14} className="text-gray-600 group-hover:text-cyan-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        {/* PERMISSION MAPPING MATRIX */}
        <div className="col-span-8 bg-[#0B1224]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
          <div className="mb-6">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Matrix Overview</h3>
            <h2 className="text-xl font-bold text-white">Permission Mapping</h2>
          </div>
          
          <div className="flex gap-8">
            {/* ENTITY LIST */}
            <div className="w-1/3 space-y-2 border-r border-white/5 pr-6">
              <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest block mb-4">Entity</span>
              {['Claims Officer', 'Policy Manager', 'Billing Clerk'].map((name, i) => (
                <div key={i} className={`p-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all
                  ${i === 0 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-white'}`}>
                  {name}
                </div>
              ))}
            </div>

            {/* PERMISSIONS GRID */}
            <div className="flex-1">
              <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest block mb-4">Assigned Permissions</span>
              <div className="grid grid-cols-2 gap-3">
                {permissions.map((perm, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-lg group hover:border-white/10">
                    <div className={`w-2 h-2 rounded-full ${i < 4 ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-gray-700'}`}></div>
                    <span className={`text-[10px] font-bold tracking-widest ${i < 4 ? 'text-gray-200' : 'text-gray-600'}`}>{perm}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 p-3 border border-dashed border-white/10 rounded-lg text-[9px] font-bold text-gray-600 uppercase cursor-pointer hover:border-cyan-500/50 hover:text-cyan-400 transition-all">
                  <Plus size={12} /> Add Permission
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: REGISTERED USERS */}
      <div className="bg-[#0B1224]/80 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight uppercase">Registered Users</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Manage system access for individual operators</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input 
                type="text" 
                placeholder="SEARCH USERS..."
                className="bg-black/20 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-[10px] font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-cyan-500/50 w-64 transition-all"
              />
            </div>
            <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
              <Filter size={16} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/5">
                <th className="pb-4 px-4">User Details</th>
                <th className="pb-4 px-4">Primary Role</th>
                <th className="pb-4 px-4">Status</th>
                <th className="pb-4 px-4">Last Active</th>
                <th className="pb-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center text-cyan-400 font-bold text-xs">
                        {user.avatar}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{user.name}</div>
                        <div className="text-[10px] text-gray-500 font-medium">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-gray-600'}`}></span>
                      <span className="text-[10px] font-bold text-gray-300">{user.status}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[10px] font-medium text-gray-500 italic">
                    {user.lastActive}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-gray-600 hover:text-cyan-400 transition-colors cursor-pointer">
                        <Edit2 size={14} />
                      </button>
                      <button className="p-2 text-gray-600 hover:text-red-400 transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* PAGINATION */}
          <div className="mt-8 flex justify-between items-center border-t border-white/5 pt-6">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Showing 3 of 124 users</span>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button key={n} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all
                  ${n === 1 ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;