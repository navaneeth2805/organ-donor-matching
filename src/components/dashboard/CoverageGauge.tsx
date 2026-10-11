import React from 'react';
import { ShieldCheck, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { KpiMetrics } from '../../services/dashboardService';

interface CoverageGaugeProps {
  kpis: KpiMetrics;
  algorithmName?: string;
  onOpenInfo?: () => void;
}

export const CoverageGauge: React.FC<CoverageGaugeProps> = ({
  kpis,
  algorithmName = 'Multi-Objective Balanced Matching',
}) => {
  const percent = Math.min(100, Math.max(0, kpis.matchingCoveragePercent));
  const radius = 64;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const eligibleCandidates = Math.min(kpis.availableDonors, kpis.activePatients);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-sky-400">
            Network Efficiency
          </span>
          <h3 className="text-sm font-bold text-slate-100 mt-0.5">Matching Coverage</h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
          Live Metric
        </span>
      </div>

      {/* Main Gauge Visual */}
      <div className="flex flex-col sm:flex-row items-center justify-around py-4 gap-6">
        <div className="relative flex items-center justify-center">
          <svg className="w-40 h-40 transform -rotate-90">
            {/* Background Track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-slate-800"
              fill="transparent"
            />
            {/* Progress Arc */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-emerald-400 transition-all duration-1000 ease-out"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Centered Percentage readout */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-slate-100 tracking-tight font-mono">
              {percent}%
            </span>
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
              Matched
            </span>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="space-y-3 flex-1 w-full max-w-xs text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Allocated Pairs:
            </span>
            <span className="font-bold font-mono text-slate-100">
              {kpis.currentMatches} matches
            </span>
          </div>

          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
              Eligible Capacity:
            </span>
            <span className="font-bold font-mono text-sky-300">
              {eligibleCandidates} candidates
            </span>
          </div>

          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              Unmatched Patients:
            </span>
            <span className="font-bold font-mono text-amber-300">
              {kpis.unmatchedPatients} waiting
            </span>
          </div>

          {/* Side Progress Bars */}
          <div className="pt-2 space-y-2">
            <div>
              <div className="flex justify-between text-[11px] mb-1 text-slate-400">
                <span>Donor Utilization</span>
                <span className="font-mono text-emerald-400">{kpis.donorCoveragePercent}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, kpis.donorCoveragePercent)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1 text-slate-400">
                <span>Recipient Waitlist Coverage</span>
                <span className="font-mono text-sky-400">{kpis.recipientCoveragePercent}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, kpis.recipientCoveragePercent)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Transparency Disclaimer */}
      <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 flex items-start gap-2">
        <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-300">Algorithmic Allocation Percentage:</strong>{' '}
          Represents graph-level mathematical matching of active donors to waitlisted patients based on{' '}
          <span className="text-sky-300">{algorithmName}</span>. This is an allocation metric, not patient survival rate.
        </p>
      </div>
    </div>
  );
};
