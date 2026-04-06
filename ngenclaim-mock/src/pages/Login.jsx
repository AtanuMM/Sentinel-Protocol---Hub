import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
// Add Eye and EyeOff icons
import { User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'; 
import SciFiButton from '../components/ui/SciFiButton';
import { dummyUsers } from '../data/mockData';

export default function Login({ setAuth }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // New state to manage password visibility
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate network delay
    setTimeout(() => {
      const user = dummyUsers.find(u => u.email === email && u.password === password);

      if (user) {
        // Store user info in localStorage for the demo to persist "session"
        localStorage.setItem('ngen_user', JSON.stringify(user));
        setAuth(true);
        navigate('/dashboard');
      } else {
        setError('Invalid credentials. Try admin@ngenclaim.ai / password123');
        setLoading(false);
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[var(--color-ng-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Background Ambient Glow (Same as Gateway page for consistency) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-ng-secondary)] opacity-10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Animated Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center relative z-10"
      >
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-ng-primary)] drop-shadow-[0_0_15px_rgba(0,209,255,0.4)]">
          Ngenclaim
        </h1>
        <div className="flex items-center gap-3 mt-1 justify-center">
          <div className="h-[1px] w-6 bg-white/20"></div>
          <p className="text-[10px] tracking-[0.4em] text-gray-500 uppercase font-medium">Automation Engine</p>
          <div className="h-[1px] w-6 bg-white/20"></div>
        </div>
      </motion.div>

      {/* Sign In Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative z-10 w-full max-w-[440px] bg-[var(--color-ng-surface)] border border-white/5 rounded-2xl p-10 shadow-2xl"
      >
        <h2 className="text-2xl font-semibold mb-2 text-white">Sign In</h2>
        <p className="text-gray-400 text-sm mb-10">Access your claims automation dashboard.</p>

        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Username Field */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Username or Email</label>
            <div className="relative group flex items-center">
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@ngenclaim.ai"
                // FIX: Increased height (py-4) and aligned icon vertically
                className="w-full bg-[#0F172A] border border-white/10 rounded-xl py-4 pr-12 pl-4 text-sm text-white focus:outline-none focus:border-[var(--color-ng-primary)] focus:ring-1 focus:ring-[var(--color-ng-primary)]/30 transition-all placeholder:text-gray-600"
                required
              />
              <User 
                className="absolute right-4 text-gray-600 group-focus-within:text-[var(--color-ng-primary)] transition-colors pointer-events-none" 
                size={18} 
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-baseline">
              <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Password</label>
              <a href="#" className="text-[10px] font-bold text-[var(--color-ng-primary)] tracking-widest uppercase hover:text-[var(--color-ng-primary)]/80 transition-colors">Forgot?</a>
            </div>
            <div className="relative group flex items-center">
              <input 
                // Toggle between password and text type
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                // FIX: Increased height (py-4). Increased padding-right (pr-20) to fit two icons on the right.
                className="w-full bg-[#0F172A] border border-white/10 rounded-xl py-4 pr-20 pl-4 text-sm text-white focus:outline-none focus:border-[var(--color-ng-primary)] focus:ring-1 focus:ring-[var(--color-ng-primary)]/30 transition-all placeholder:text-gray-600"
                required
              />
              
              {/* SEE PASSWORD FEATURE (Right side group of icons) */}
              <div className="absolute right-4 flex items-center gap-2.5">
                {/* Visibility Toggle Button */}
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-600 hover:text-white transition-colors p-1 -m-1 focus:outline-none focus:text-[var(--color-ng-primary)]"
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                
                {/* Small vertical divider */}
                <div className="h-4 w-[1px] bg-white/10"></div>
                
                {/* Lock Icon */}
                <Lock 
                  className="text-gray-600 group-focus-within:text-[var(--color-ng-primary)] transition-colors pointer-events-none" 
                  size={18} 
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && <motion.p animate={{ opacity: [0, 1] }} className="text-red-500 text-xs mt-2 text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</motion.p>}

          {/* Submit Button */}
          <SciFiButton 
              disabled={loading}
              icon={loading ? null : ArrowRight}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "SIGN IN"
              )}
            </SciFiButton>
          {/* <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={loading}
            className="w-full mt-8 py-4 bg-[var(--color-ng-primary)] text-[#0A0F1E] font-bold rounded-xl text-sm flex items-center justify-center gap-2.5 shadow-[0_4px_15px_rgba(0,209,255,0.2)] hover:shadow-[0_6px_25px_rgba(0,209,255,0.4)] disabled:opacity-60 transition-all"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#0A0F1E]/30 border-t-[#0A0F1E] rounded-full animate-spin"></div>
            ) : (
              <>SIGN IN <ArrowRight size={18} /></>
            )}
          </motion.button> */}
        </form>
      </motion.div>

      {/* Footer Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 flex flex-col items-center gap-6 relative z-10"
      >
        <div className="flex gap-8 text-[10px] font-bold text-gray-500 tracking-[0.2em]">
          {['PRIVACY', 'SECURITY', 'HELP'].map(item => (
            <span key={item} className="cursor-pointer hover:text-white transition-colors">{item}</span>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 tracking-widest">
          POWERED BY <span className="text-gray-400 font-bold">Keycloak</span>
        </p>
      </motion.div>

      {/* Optional: Add a subtle overall background tint from screen4.jpg (the Gateway page gradient footer hint) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-ng-primary)] via-[var(--color-ng-secondary)] to-[var(--color-ng-primary)] opacity-50 blur-sm"></div>
    </div>
  );
}