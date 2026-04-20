import React from 'react';

const Footer = () => {
  return (
    <footer className="flex justify-between items-center pt-6 pb-6 px-8 border-t border-white/5 mt-auto">
      <p className="text-[9px] text-gray-600 uppercase tracking-widest">
        Ngenclaim Kinetic • Internal Administration v2.4.0
      </p>
      <div className="flex gap-6">
        <a href="#" className="text-[9px] text-gray-500 hover:text-white uppercase tracking-widest transition-colors">
          Privacy Protocol
        </a>
        <a href="#" className="text-[9px] text-gray-500 hover:text-white uppercase tracking-widest transition-colors">
          Audit Logs
        </a>
        <a href="#" className="text-[9px] text-gray-500 hover:text-white uppercase tracking-widest transition-colors">
          Documentation
        </a>
      </div>
    </footer>
  );
};

export default Footer;