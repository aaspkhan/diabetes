import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  colorClass: string;
  trend?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  unit, 
  icon: Icon, 
  colorClass, 
  trend,
  onClick,
  isLoading = false
}) => {
  return (
    <div 
      onClick={!isLoading && onClick ? onClick : undefined}
      className={`bg-surface rounded-xl p-6 shadow-lg border border-slate-700 flex flex-col justify-between transition-all relative overflow-hidden ${
        onClick ? 'cursor-pointer hover:border-slate-500 hover:bg-slate-800/80 active:scale-98' : ''
      }`}
    >
      {isLoading && (
         <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10 backdrop-blur-sm">
             <Loader2 className="w-8 h-8 text-primary animate-spin" />
         </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
          <div className="flex items-baseline mt-2">
            <span className={`text-3xl font-bold text-white`}>{value}</span>
            <span className="ml-1 text-slate-400 text-sm">{unit}</span>
          </div>
        </div>
        <div className={`p-3 rounded-full bg-opacity-20 ${colorClass.replace('text-', 'bg-')}`}>
          <Icon className={`w-6 h-6 ${colorClass}`} />
        </div>
      </div>
      {trend && (
        <div className="text-sm text-slate-400">
          {trend}
        </div>
      )}
      
      {onClick && (
        <div className="absolute bottom-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-slate-500 uppercase">Tap to Measure</span>
        </div>
      )}
    </div>
  );
};