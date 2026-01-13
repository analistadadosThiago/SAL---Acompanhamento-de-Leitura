
import React from 'react';

interface IndicatorCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  suffix?: string;
}

const IndicatorCard: React.FC<IndicatorCardProps> = ({ label, value, icon, color = 'blue', suffix }) => {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500 text-blue-700 bg-blue-50',
    red: 'border-red-500 text-red-700 bg-red-50',
    green: 'border-green-500 text-green-700 bg-green-50',
    amber: 'border-amber-500 text-amber-700 bg-amber-50',
  };

  return (
    <div className={`rounded-xl border-l-4 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {value}
            {suffix && <span className="ml-1 text-lg font-semibold text-slate-500">{suffix}</span>}
          </p>
        </div>
        {icon && <div className="text-slate-300">{icon}</div>}
      </div>
    </div>
  );
};

export default IndicatorCard;
