import React from 'react';
import { ArrowRight, Database, Filter, Stethoscope, GitFork, Cpu, Award } from 'lucide-react';
import { BipartiteGraph, MatchingResult } from '../../utils/graphAnalyticsEngine';
import { Donor, Recipient } from '../../types';

interface MatchingFlowVisualProps {
  totalDonorsCount: number;
  filteredDonorsCount: number;
  totalRecipientsCount: number;
  filteredRecipientsCount: number;
  graph: BipartiteGraph;
  activeMatching: MatchingResult;
}

export const MatchingFlowVisual: React.FC<MatchingFlowVisualProps> = ({
  totalDonorsCount,
  filteredDonorsCount,
  totalRecipientsCount,
  filteredRecipientsCount,
  graph,
  activeMatching,
}) => {
  const eligibleCapacity = Math.min(filteredDonorsCount, filteredRecipientsCount);
  const matchedPairs = activeMatching.totalMatches;
  const coveragePercent = eligibleCapacity > 0 ? Math.min(100, Math.round((matchedPairs / eligibleCapacity) * 1000) / 10) : 0;

  const stages = [
    {
      step: '01',
      title: 'DONORS',
      subtitle: 'Registered Base',
      count: `${totalDonorsCount}`,
      meta: `${totalRecipientsCount} Patients`,
      icon: Database,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/30',
    },
    {
      step: '02',
      title: 'FILTERING',
      subtitle: 'Active Criteria',
      count: `${filteredDonorsCount}`,
      meta: `${filteredRecipientsCount} Eligible R`,
      icon: Filter,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/30',
    },
    {
      step: '03',
      title: 'COMPATIBILITY',
      subtitle: 'Phase 3 Rules',
      count: `${graph.edges.length}`,
      meta: 'Candidate Edges',
      icon: Stethoscope,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/30',
    },
    {
      step: '04',
      title: 'CANDIDATE GRAPH',
      subtitle: 'Bipartite Network',
      count: `${graph.nodes.length}`,
      meta: `${graph.donors.length}D ↔ ${graph.recipients.length}R`,
      icon: GitFork,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/30',
    },
    {
      step: '05',
      title: 'OPTIMIZATION',
      subtitle: activeMatching.algorithm.split(' ')[0],
      count: `${activeMatching.executionTimeMs}ms`,
      meta: 'Run Latency',
      icon: Cpu,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
    },
    {
      step: '06',
      title: 'MATCHED PAIRS',
      subtitle: 'Optimal Allocation',
      count: `${matchedPairs}`,
      meta: `${coveragePercent}% Coverage`,
      icon: Award,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
            Pipeline Analytics
          </span>
          <h3 className="text-sm font-bold text-slate-100">
            End-to-End Organ Allocation & Matching Flow
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Deterministic Pipeline • Real Network Counts
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isLast = idx === stages.length - 1;

          return (
            <div
              key={stage.step}
              className={`relative flex flex-col justify-between p-3 rounded-xl border ${stage.bg} transition hover:bg-slate-800/60`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold tracking-widest text-slate-400">
                    STAGE {stage.step}
                  </span>
                  <Icon className={`h-3.5 w-3.5 ${stage.color}`} />
                </div>
                <div className="text-[11px] font-bold text-slate-200 mt-1 uppercase tracking-tight">
                  {stage.title}
                </div>
                <div className="text-[10px] text-slate-400">
                  {stage.subtitle}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/60">
                <div className={`text-xl font-black font-mono ${stage.color}`}>
                  {stage.count}
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  {stage.meta}
                </div>
              </div>

              {!isLast && (
                <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-full bg-slate-950 border border-slate-700 text-slate-400">
                  <ArrowRight className="h-2.5 w-2.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
