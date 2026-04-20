import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import DashboardLayout from './components/layout/DashboardLayout';

// Pages
import Gateway from './pages/Gateway';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import MDM from './pages/MDM';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

// Placeholders
// const Dashboard = () => <div className="text-white text-2xl font-bold">Data Influx Dashboard</div>;
// const MDM = () => <div className="text-white text-2xl font-bold">MDM Engine Orchestration</div>;
// const UserMgmt = () => <div className="text-white text-2xl font-bold">User Access Control</div>;
// const Settings = () => <div className="text-white text-2xl font-bold">Settings</div>;


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('ngen_user') !== null;
  });

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Gateway />} />
        <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />
        <Route element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="mdm" element={<MDM />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          {/* Redirect /dashboard by default if they hit the layout root */}
          <Route path="app" element={<Navigate to="/dashboard" />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;