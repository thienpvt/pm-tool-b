'use client';
import React from 'react';

export function DateCell({ value, onChange, onBlur, warn, extraClass = '' }: {
  value: string; onChange: (v: string) => void; onBlur: () => void; warn: string | null; extraClass?: string;
}) {
  return (
    <div className="relative">
      <input
        type="date"
        className={`h-7 w-full text-xs border rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-blue-400
          ${warn ? 'border-orange-400 bg-orange-50/60' : 'border-slate-200 bg-white'} ${extraClass}`}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {warn && (
        <div title={warn} className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center cursor-help shadow">
          <span className="text-white font-bold leading-none" style={{ fontSize: 9 }}>!</span>
        </div>
      )}
    </div>
  );
}
