import React from 'react';
import { Cpu, Zap, Trophy, ShieldCheck, Scale, CheckCircle2 } from 'lucide-react';
import { MatchComparisonSummary } from '../../services/dashboardService';

interface MatchingComparisonCardProps {
  summary: MatchComparisonSummary;
  selectedAlgorithm: 'cardinality' | 'weight' | 'multi-objective';
  onSelectAlgorithm: (algo: 'cardinality' | 'weight' | 'multi-objective') => void;
}

export const MatchingComparisonCard: React.FC<MatchingComparisonCardProps> = ({
  summary,
  selectedAlgorithm,
  onSelectAlgorithm,
}) => {
  const algos = [
    {
      key: 'cardinality' as const,
      name: 'Hopcroft-Karp Cardinality',
      icon: Cpu,
      badge: 'Maximizes Volume',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      data: summary.cardinality,
      description: 'Maximizes total simultaneous transplants without weighting.',
    },
    {
      key: 'weight' as const,
      name: 'Maximum Weight Greedy',
      icon: Trophy,
      badge: 'Maximizes Quality',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      data: summary.maxWeight,
      description: 'Prioritizes maximum composite clinical compatibility scores.',
    },
    {
      key: 'multi-objective' as const,
      name: 'Multi-Objective Balanced',
      icon: Scale,
      badge: 'Recommended Policy',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      data: summary.multiObjective,
      description: 'Balances HLA/ABO score, urgency tier, and waitlist tenure.',
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-sky-400">
            Algorithmic Benchmark Suite
          </span>
          <h3 className="text-sm font-bold text-slate-100 mt-0.5">Matching Strategy Comparison</h3>
        </div>
        <span className="text-[11px] text-slate-400">
          Click any card to apply algorithm across dashboard
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {algos.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedAlgorithm === item.key;

          return (
            <div
              key={item.key}
              onClick={() => onSelectAlgorithm(item.key)}
              className={`cursor-pointer rounded-xl p-4 border transition flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800/90 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-100">{item.name}</span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-sky-400" />
                  )}
                </div>

                <div className="mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Allocated Pairs:</span>
                  <span className="font-bold text-slate-200">{item.data.totalMatches} matches</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coverage Yield:</span>
                  <span className="font-bold text-emerald-400">{item.data.networkCoveragePercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Avg Compatibility:</span>
                  <span className="font-bold text-sky-400">{item.data.averageWeight}%</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Execution Latency:</span>
                  <span className="text-slate-400">{item.data.executionTimeMs} ms</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
        <strong className="text-slate-300">Algorithmic Trade-off Analysis:</strong>{' '}
        Hopcroft-Karp provides the strict upper-bound on match count (maximum lives saved immediately). Maximum Weight guarantees highest graft compatibility scores (maximizing post-transplant survival years). Multi-Objective synthesizes both by adding clinical urgency bonuses so critical patients are not deprioritized for small HLA variance.
      </div>
    </div>
  );
};
