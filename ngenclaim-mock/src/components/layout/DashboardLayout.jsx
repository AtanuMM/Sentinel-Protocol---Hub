// src/components/layout/DashboardLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';

export default function DashboardLayout() {
    return (
      <div className="flex min-h-screen bg-[#050810]">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopNavbar />
          <main className="flex-1 p-8">
            {/* THIS IS WHERE THE PAGES RENDER */}
            <Outlet /> 
          </main>
          {/* Your footer components will go here later as separate units */}
        </div>
      </div>
    );
  }