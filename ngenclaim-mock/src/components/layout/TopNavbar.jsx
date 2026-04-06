// src/components/layout/TopNavbar.jsx
import React from 'react';
import { ChevronDown, Search, Bell, HelpCircle } from 'lucide-react';

const FilterDropdown = ({ label }) => (
  <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
    {label}
    <ChevronDown size={14} />
  </button>
);

export default function TopNavbar() {
  return (
    <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0A0F1E]/50 backdrop-blur-md sticky top-0 z-40">
      {/* Tenant Filters - As seen in Screen 1 */}
      <div className="flex items-center gap-3">
        {/* <FilterDropdown label="Insurance Company" />
        <FilterDropdown label="TPA Office" />
        <FilterDropdown label="Hospital" />
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-ng-primary)]/10 border border-[var(--color-ng-primary)]/30 rounded-lg text-xs text-[var(--color-ng-primary)] font-bold">
          Processing Status
          <ChevronDown size={14} />
        </button> */}
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-6 text-gray-500">
        <button className="hover:text-white transition-colors"><Search size={20} /></button>
        <button className="hover:text-white transition-colors relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0A0F1E]"></span>
        </button>
        <button className="hover:text-white transition-colors"><HelpCircle size={20} /></button>
      </div>
    </header>
  );
}