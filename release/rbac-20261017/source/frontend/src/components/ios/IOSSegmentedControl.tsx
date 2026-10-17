import React from 'react';

interface SegmentOption {
  id: string;
  label: string;
  icon?: string;
}

interface IOSSegmentedControlProps {
  options: SegmentOption[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function IOSSegmentedControl({
  options,
  selectedId,
  onChange,
  className = '',
}: IOSSegmentedControlProps) {
  return (
    <div
      className={`bg-slate-200/80 p-1 rounded-2xl flex items-center shadow-inner relative text-xs font-bold select-none ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.id === selectedId;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex-1 py-2 px-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              isSelected
                ? 'bg-white text-emerald-800 shadow-md scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            {opt.icon && <span>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
