import React from 'react';
import { Activity, GitFork, Cpu, Stethoscope, Clock } from 'lucide-react';
import { KpiMetrics } from '../../services/dashboardService';

interface StatusRingsBarProps {
  kpis: KpiMetrics;
  nodeCount: number;
  edgeCount: number;
  lastUpdated?: string;
}

export const StatusRingsBar: React.FC<StatusRingsBarProps> = ({
  kpis,
  nodeCount,
  edgeCount,
  lastUpdated = 'Active',
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. System Status */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 flex items-center gap-3">
        <div className="relative flex items-center justify-center h-9 w-9 rounded-full bg-slate-950 border border-slate-800 shrink-0">
          <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="94.2"
              strokeDashoffset="18"
              className="opacity-70"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
            System Status
          </div>
          <div className="text-xs font-black font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <Activity className="h-3 w-3" /> ONLINE
          </div>
        </div>
      </div>

      {/* 2. Graph Status */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 flex items-center gap-3">
        <div className="relative flex items-center justify-center h-9 w-9 rounded-full bg-slate-950 border border-slate-800 shrink-0">
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400" />
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="94.2"
              strokeDashoffset="10"
              className="opacity-80"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
            Graph Status
          </div>
          <div className="text-xs font-black font-mono text-sky-400 flex items-center gap-1.5 mt-0.5">
            <GitFork className="h-3 w-3" /> ACTIVE ({nodeCount}N / {edgeCount}E)
          </div>
        </div>
      </div>

      {/* 3. Matching Engine */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 flex items-center gap-3">
        <div className="relative flex items-center justify-center h-9 w-9 rounded-full bg-slate-950 border border-slate-800 shrink-0">
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-400" />
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
              strokeDasharray="94.2"
              strokeDashoffset="0"
              className="opacity-80"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
            Matching Engine
          </div>
          <div className="text-xs font-black font-mono text-purple-400 flex items-center gap-1.5 mt-0.5">
            <Cpu className="h-3 w-3" /> READY (H-K & MaxW)
          </div>
        </div>
      </div>

      {/* 4. Data Quality */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 flex items-center gap-3">
        <div className="relative flex items-center justify-center h-9 w-9 rounded-full bg-slate-950 border border-slate-800 shrink-0">
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-400" />
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#818cf8"
              strokeWidth="2"
              strokeDasharray="94.2"
              strokeDashoffset={94.2 * (1 - (kpis.averageDataQuality || 90) / 100)}
              className="opacity-80"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
            Data Quality
          </div>
          <div className="text-xs font-black font-mono text-indigo-400 flex items-center gap-1.5 mt-0.5">
            <Stethoscope className="h-3 w-3" /> {kpis.averageDataQuality}% ACCREDITED
          </div>
        </div>
      </div>

      {/* 5. Last Graph Update */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 flex items-center gap-3 col-span-2 sm:col-span-3 lg:col-span-1">
        <div className="relative flex items-center justify-center h-9 w-9 rounded-full bg-slate-950 border border-slate-800 shrink-0">
          <Clock className="h-4 w-4 text-amber-400" />
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.5"
              strokeDasharray="94.2"
              strokeDashoffset="30"
              className="opacity-60"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
            Last Graph Sync
          </div>
          <div className="text-xs font-mono text-amber-300 font-medium truncate mt-0.5">
            {lastUpdated}
          </div>
        </div>
      </div>
    </div>
  );
};
