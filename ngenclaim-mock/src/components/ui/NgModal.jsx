import React from 'react';
import { X } from 'lucide-react';

/**
 * Branded modal shell for Ngenclaim — use for all dialog overlays in this app.
 */
export default function NgModal({
  open,
  onClose,
  title,
  subtitle,
  subtitleMono = false,
  children,
  primaryLabel = 'Close',
  onPrimaryClick,
  showCloseIcon = false,
  centered = true,
  bodyAlign,
  maxWidth = 'max-w-md',
  contentClassName = '',
  footerClassName = '',
  footer,
}) {
  if (!open) return null;

  const handlePrimary = onPrimaryClick ?? onClose;
  const resolvedBodyAlign = bodyAlign ?? (centered ? 'center' : 'left');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`relative bg-[#0B1224] border border-white/10 w-full ${maxWidth} rounded-2xl overflow-hidden shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ng-modal-title"
      >
        <div className={`px-10 pt-10 pb-2 ${centered ? 'text-center' : 'text-left'}`}>
          <div className={`flex ${showCloseIcon ? 'items-start justify-between gap-4' : centered ? 'justify-center' : ''}`}>
            <div className={centered && !showCloseIcon ? '' : 'flex-1'}>
              <h2
                id="ng-modal-title"
                className="text-xl font-bold text-white tracking-tight"
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  className={`text-[10px] text-gray-500 uppercase tracking-widest mt-3 ${
                    subtitleMono ? 'font-mono normal-case tracking-normal text-gray-400' : ''
                  }`}
                >
                  {subtitle}
                </p>
              )}
            </div>
            {showCloseIcon && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors shrink-0"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {children && (
            <div
              className={`mt-8 mb-6 text-sm text-gray-400 ${
                resolvedBodyAlign === 'left' ? 'text-left' : 'text-center'
              } ${contentClassName}`}
            >
              {children}
            </div>
          )}
        </div>

        {footer ?? (
          <div className={`border-t border-white/5 px-10 py-8 ${footerClassName}`}>
            <button
              type="button"
              onClick={handlePrimary}
              className="w-full py-3.5 rounded-xl bg-[var(--color-ng-primary)] text-[#050810] text-[11px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,209,255,0.4)] transition-all"
            >
              {primaryLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
