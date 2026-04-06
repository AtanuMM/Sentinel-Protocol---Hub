// src/components/layout/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Users, Database, Settings, UserCircle, LogOut } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
  { name: 'User Management', path: '/users', icon: Users },
  { name: 'MDM', path: '/mdm', icon: Database },
  { name: 'Settings', path: '/settings', icon: Settings },
  { name: 'Profile', path: '/profile', icon: UserCircle },
];

export default function Sidebar() {
  const user = JSON.parse(localStorage.getItem('ngen_user') || '{}');

  return (
    <aside className="w-64 bg-[#0A0F1E] border-r border-white/5 flex flex-col h-screen sticky top-0">
      {/* Brand Section */}
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[var(--color-ng-primary)] tracking-tight">Ngenclaim</h1>
        <p className="text-[10px] tracking-[0.3em] text-gray-500 uppercase mt-1">Automation Engine</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${isActive 
                ? 'bg-[var(--color-ng-primary)]/10 text-[var(--color-ng-primary)] border border-[var(--color-ng-primary)]/20' 
                : 'text-gray-500 hover:text-white hover:bg-white/5'}
            `}
          >
            <item.icon size={20} />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* User Profile Section at Bottom */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
          <img src={user.avatar} alt="Avatar" className="w-10 h-10 rounded-lg border border-[var(--color-ng-primary)]/30" />
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-white truncate">{user.name || 'Admin User'}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role || 'System Online'}</p>
          </div>
          <button onClick={() => { localStorage.removeItem('ngen_user'); window.location.href = '/'; }} className="text-gray-500 hover:text-red-400">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}