import React from 'react';
import { AlertCircle, AlertTriangle, ShieldAlert, ArrowRight, UserX, Stethoscope } from 'lucide-react';
import { AttentionItem } from '../../services/dashboardService';

interface AttentionRequiredSectionProps {
  items: AttentionItem[];
  onActionClick: (item: AttentionItem) => void;
}

export const AttentionRequiredSection: React.FC<AttentionRequiredSectionProps> = ({
  items,
  onActionClick,
}) => {
  if (items.length === 0) {
    return null;
  }

  const getCategoryConfig = (cat: AttentionItem['category']) => {
    switch (cat) {
      case 'urgent':
        return {
          icon: ShieldAlert,
          bg: 'bg-red-500/10 text-red-400 border-red-500/20',
          badge: 'CRITICAL PRIORITY',
          badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
        };
      case 'review':
        return {
          icon: AlertTriangle,
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          badge: 'CLINICAL REVIEW',
          badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        };
      case 'data-quality':
        return {
          icon: Stethoscope,
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          badge: 'DATA QUALITY',
          badgeClass: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
        };
      case 'system':
      default:
        return {
          icon: UserX,
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          badge: 'GRAPH ISOLATION',
          badgeClass: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
        };
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
            <AlertCircle className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            Action Required & Clinical Alerts
            <span className="text-[10px] px-2 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
              {items.length} Pending
            </span>
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">
          Immediate coordinator intervention advised
        </span>
      </div>

      <div className="space-y-2.5">
        {items.slice(0, 4).map((item) => {
          const config = getCategoryConfig(item.category);
          const Icon = config.icon;

          return (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${config.bg}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${config.badgeClass}`}>
                      {config.badge}
                    </span>
                    <span className="text-xs font-bold text-slate-200">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {item.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onActionClick(item)}
                className="shrink-0 self-end sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                {item.actionText}
                <ArrowRight className="h-3 w-3 text-sky-400" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
