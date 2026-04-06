import React from 'react';
import { motion } from 'framer-motion';

export default function SciFiButton({ onClick, children, icon: Icon, className = "", disabled = false }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      initial="initial"
      whileHover="hover"
      whileTap="tap"
      // Added 'cursor-pointer' to the className string below
      className={`relative w-full py-4 overflow-hidden rounded-xl font-bold text-sm tracking-widest border border-white/10 transition-all duration-300 group cursor-pointer disabled:cursor-not-allowed ${className}`}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
    >
      {/* 1. Neon Gradient Fill */}
      <motion.div
        variants={{
          initial: { x: "-100%" },
          hover: { x: 0 }
        }}
        transition={{ type: "tween", ease: [0.19, 1, 0.22, 1], duration: 1.2 }}
        className="absolute inset-0 bg-gradient-to-r from-[#00D1FF] to-[#2E6BFF] z-10"
      />

      {/* 2. Neon Outer Glow */}
      <motion.div
        variants={{
          initial: { opacity: 0, scale: 0.95 },
          hover: { opacity: 1, scale: 1 }
        }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 z-0 shadow-[0_0_25px_rgba(0,209,255,0.6)] rounded-xl"
      />

      {/* 3. Text/Content Layer */}
      <div className="relative z-30 flex items-center justify-center gap-2.5">
        <motion.span 
          variants={{
            initial: { color: "#ffffff" },
            hover: { color: "#050810" }
          }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex items-center gap-2.5 uppercase"
        >
          {Icon && <Icon size={18} />}
          {children}
        </motion.span>
      </div>

      {/* 4. Leading Edge Streak */}
      <motion.div
        variants={{
          initial: { left: "0%", opacity: 0 },
          hover: { left: "100%", opacity: [0, 1, 0] }
        }}
        transition={{ type: "tween", ease: "linear", duration: 1.2 }}
        className="absolute top-0 bottom-0 w-12 bg-white/50 blur-xl z-20"
      />
    </motion.button>
  );
}