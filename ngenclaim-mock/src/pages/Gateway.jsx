import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, LayoutGrid, Lock } from 'lucide-react';
import SciFiButton from '../components/ui/SciFiButton';

export default function Gateway() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-ng-bg)] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-ng-secondary)] opacity-10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Header / Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute top-16 flex flex-col items-center"
      >
        <h1 className="text-5xl font-bold tracking-tight text-[var(--color-ng-primary)] drop-shadow-[0_0_15px_rgba(0,209,255,0.5)]">
          Ngenclaim
        </h1>
        <div className="flex items-center gap-4 mt-2">
          <div className="h-[1px] w-12 bg-white/20"></div>
          <p className="text-xs tracking-[0.3em] text-gray-400 font-medium uppercase">
            Automation Engine
          </p>
          <div className="h-[1px] w-12 bg-white/20"></div>
        </div>
      </motion.div>

      {/* Main Gateway Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 w-full max-w-[480px] bg-[var(--color-ng-surface)] rounded-3xl p-10 shadow-2xl border border-white/5"
      >
        {/* Top Right Grid Icon */}
        <div className="absolute top-6 right-6 text-gray-500 opacity-50">
          <LayoutGrid size={24} />
        </div>

        {/* Shield Icon Badge */}
        <div className="flex justify-center mb-8">
          <div className="bg-[#1C263D] p-4 rounded-2xl shadow-inner border border-white/5">
            <ShieldCheck size={32} className="text-[var(--color-ng-primary)]" />
          </div>
        </div>

        {/* Typography */}
        <div className="text-center space-y-3 mb-10">
          <p className="text-[10px] tracking-[0.2em] text-gray-400 font-semibold">
            ENCRYPTED PORTAL ACCESS
          </p>
          <h2 className="text-3xl font-semibold text-white">
            Secure Gateway
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed px-4">
            Access the next generation of automated insurance workflows and multi-tenant authentication.
          </p>
        </div>

        {/* Login Button */}
        <SciFiButton 
          onClick={() => navigate('/login')}
          icon={Lock}
        >
          LOGIN WITH KEYCLOAK
        </SciFiButton>
        {/* <motion.button
          whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(0, 209, 255, 0.4)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login')}
          className="w-full relative group overflow-hidden rounded-xl font-medium tracking-wide text-sm"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-ng-primary)] to-[var(--color-ng-secondary)] opacity-90 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10 flex items-center justify-center gap-2 py-4 text-white">
            <Lock size={16} />
            LOGIN WITH KEYCLOAK
          </div>
        </motion.button> */}


        {/* Security Footer inside card */}
        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-gray-600 font-medium tracking-widest">
          <div className="h-[1px] w-6 bg-gray-700"></div>
          ENTERPRISE GRADE SECURITY
          <div className="h-[1px] w-6 bg-gray-700"></div>
        </div>
      </motion.div>
    </div>
  );
}