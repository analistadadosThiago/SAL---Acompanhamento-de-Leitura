
import React from 'react';

interface IndicatorCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  suffix?: string;
}

const IndicatorCard: React.FC<IndicatorCardProps> = ({ label, value, icon, color = 'blue', suffix }) => {
  const colorMap: Record<string, { border: string, text: string, bg: string, iconBg: string }> = {
    blue: { 
      border: 'border-blue-600', 
      text: 'text-slate-900', 
      bg: 'bg-white', 
      iconBg: 'bg-blue-50 text-blue-600' 
    },
    red: { 
      border: 'border-red-600', 
      text: 'text-red-700', 
      bg: 'bg-white', 
      iconBg: 'bg-red-50 text-red-600' 
    },
    green: { 
      border: 'border-green-600', 
      text: 'text-green-800', 
      bg: 'bg-white', 
      iconBg: 'bg-green-50 text-green-600' 
    },
    amber: { 
      border: 'border-amber-500', 
      text: 'text-amber-900', 
      bg: 'bg-white', 
      iconBg: 'bg-amber-50 text-amber-600' 
    },
  };

  const currentTheme = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-[28px] border-l-[6px] ${currentTheme.border} ${currentTheme.bg} p-7 shadow-sm border border-slate-200 transition-all hover:shadow-xl hover:-translate-y-1 group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{label}</p>
          <div className="flex items-baseline gap-1">
            <p className={`text-4xl font-black ${currentTheme.text} tracking-tighter leading-none`}>
              {value}
            </p>
            {suffix && <span className="text-lg font-black text-slate-300 uppercase">{suffix}</span>}
          </div>
        </div>
        {icon && (
          <div className={`p-4 rounded-2xl ${currentTheme.iconBg} transition-transform group-hover:scale-110`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default IndicatorCard;
