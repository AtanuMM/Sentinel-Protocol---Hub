import React from 'react';

const inputClassName =
  'w-full bg-[#0F172A] border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-[var(--color-ng-primary)] focus:ring-1 focus:ring-[var(--color-ng-primary)]/30 transition-all placeholder:text-gray-600';

export default function NgFormField({
  label,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  align = 'left',
}) {
  const isLeft = align === 'left';

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className={`text-[10px] font-bold text-gray-500 tracking-widest uppercase block ${
          isLeft ? 'text-left' : 'text-center'
        }`}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${inputClassName} ${isLeft ? 'text-left' : 'text-center'}`}
      />
    </div>
  );
}
