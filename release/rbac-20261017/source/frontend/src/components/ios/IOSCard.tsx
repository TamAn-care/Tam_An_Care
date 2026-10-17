import React from 'react';

interface IOSCardProps {
  title: string;
  subtitle?: string;
  icon?: string;
  badge?: string;
  badgeColor?: 'green' | 'red' | 'amber' | 'blue';
  children?: React.ReactNode;
  onClick?: () => void;
  actionButtonText?: string;
  onActionButtonClick?: () => void;
  className?: string;
}

export function IOSCard({
  title,
  subtitle,
  icon,
  badge,
  badgeColor = 'green',
  children,
  onClick,
  actionButtonText,
  onActionButtonClick,
  className = '',
}: IOSCardProps) {
  const getBadgeStyle = () => {
    switch (badgeColor) {
      case 'red':
        return 'bg-red-500 text-white';
      case 'amber':
        return 'bg-amber-400 text-amber-950';
      case 'blue':
        return 'bg-blue-600 text-white';
      case 'green':
      default:
        return 'bg-emerald-600 text-white';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200/90 rounded-[22px] p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all relative flex flex-col justify-between ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Top Badge */}
      {badge && (
        <span
          className={`absolute top-3.5 right-3.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-white shadow-sm ${getBadgeStyle()}`}
        >
          {badge}
        </span>
      )}

      {/* Header */}
      <div className="flex items-start space-x-3 mb-2">
        {icon && (
          <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl shrink-0 shadow-inner">
            {icon}
          </div>
        )}
        <div className="pr-12">
          <h4 className="font-extrabold text-sm text-slate-800 leading-snug">{title}</h4>
          {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
        </div>
      </div>

      {/* Body Content */}
      {children && <div className="mt-2 text-xs text-slate-600 space-y-2">{children}</div>}

      {/* 1-Tap Footer Button */}
      {actionButtonText && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onActionButtonClick?.();
          }}
          className="mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm transition"
        >
          {actionButtonText}
        </button>
      )}
    </div>
  );
}
