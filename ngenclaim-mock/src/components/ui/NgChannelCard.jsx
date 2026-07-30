import React from 'react';

const ACTION_BTN =
  'w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all';

const PRIMARY_VARIANTS = {
  cyan: 'bg-[var(--color-ng-primary)] text-[#050810] hover:shadow-[0_0_15px_rgba(0,209,255,0.3)]',
  blue: 'bg-[var(--color-ng-secondary)] text-white hover:shadow-[0_0_15px_rgba(46,107,255,0.3)]',
};

/**
 * Branded channel/setup card — compact, aligned slots for icon / badge / copy / actions.
 */
export default function NgChannelCard({
  icon,
  iconBgClass,
  title,
  description,
  badge,
  highlighted = false,
  primaryLabel,
  onPrimaryClick,
  primaryVariant = 'cyan',
  secondaryLabel,
  onSecondaryClick,
  secondaryDisabled = false,
}) {
  return (
    <div
      className={`flex flex-col rounded-xl bg-[#0B1224] border p-6 transition-all ${
        highlighted ? 'border-[var(--color-ng-primary)]/50' : 'border-white/10'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconBgClass}`}
        >
          {icon}
        </div>

        <div className="min-h-[22px] mb-2 flex items-center justify-center">
          {badge ? (
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-2.5 py-0.5 bg-white/[0.03] border border-white/5 rounded-full">
              {badge}
            </span>
          ) : null}
        </div>

        <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>

        <p className="mt-2 min-h-[2.5rem] text-xs text-gray-500 leading-relaxed max-w-[220px]">
          {description ?? '\u00A0'}
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <button
          type="button"
          onClick={onPrimaryClick}
          className={`${ACTION_BTN} ${PRIMARY_VARIANTS[primaryVariant]}`}
        >
          {primaryLabel}
        </button>
        {secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondaryClick}
            disabled={secondaryDisabled}
            className={`${ACTION_BTN} bg-white/[0.03] border border-white/10 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 hover:text-gray-400`}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
