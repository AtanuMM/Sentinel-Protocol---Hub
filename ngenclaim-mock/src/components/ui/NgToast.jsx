import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function NgToast({ message, visible, onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible || !message) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0B1224] border border-emerald-500/30 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
      <span className="text-sm text-gray-200">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-gray-500 hover:text-white transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}
