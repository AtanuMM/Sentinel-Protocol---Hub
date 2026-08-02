import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const baseInput =
  'w-full bg-[#0F172A] border rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-1 transition-all placeholder:text-gray-600';

export function NgIngressField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  hint,
}) {
  const borderClass = error
    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
    : 'border-white/10 focus:border-[var(--color-ng-primary)] focus:ring-[var(--color-ng-primary)]/30';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-gray-400 block">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${baseInput} ${borderClass} disabled:opacity-60 disabled:cursor-not-allowed`}
      />
      {hint && !error && <p className="text-xs text-gray-600">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function NgIngressPasswordField({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
}) {
  const [visible, setVisible] = useState(false);
  const borderClass = error
    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
    : 'border-white/10 focus:border-[var(--color-ng-primary)] focus:ring-[var(--color-ng-primary)]/30';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-gray-400 block">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${baseInput} pr-10 ${borderClass}`}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function NgIngressTextArea({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
  rows = 5,
}) {
  const borderClass = error
    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
    : 'border-white/10 focus:border-[var(--color-ng-primary)] focus:ring-[var(--color-ng-primary)]/30';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-gray-400 block">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`${baseInput} resize-y min-h-[120px] ${borderClass}`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
