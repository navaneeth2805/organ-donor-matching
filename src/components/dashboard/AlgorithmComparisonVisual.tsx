import React from 'react';
import { Cpu, Trophy, Scale, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { MatchComparisonSummary } from '../../services/dashboardService';

interface AlgorithmComparisonVisualProps {
  summary: MatchComparisonSummary;
  selectedAlgorithm: 'cardinality' | 'weight' | 'multi-objective';
  onSelectAlgorithm: (algo: 'cardinality' | 'weight' | 'multi-objective') => void;
}

export const AlgorithmComparisonVisual: React.FC<AlgorithmComparisonVisualProps> = ({
  summary,
  selectedAlgorithm,
  onSelectAlgorithm,
}) => {
  const { cardinality, maxWeight, multiObjective } = summary;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-sky-400">
            Algorithmic Benchmark Suite
          </span>
          <h3 className="text-sm font-bold text-slate-100 mt-0.5">
            Matching Algorithm Comparison & Trade-off Engine
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Phase 4 Graph Allocators • Live Execution
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. MAXIMUM CARDINALITY MATCHING */}
        <div
          onClick={() => onSelectAlgorithm('cardinality')}
          className={`cursor-pointer rounded-xl p-4 border transition flex flex-col justify-between ${
            selectedAlgorithm === 'cardinality'
              ? 'bg-slate-800/95 border-sky-500 shadow-md ring-1 ring-sky-500/50'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Cpu className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-100">
                  MAXIMUM CARDINALITY
                </h4>
              </div>
              {selectedAlgorithm === 'cardinality' && (
                <CheckCircle2 className="h-4 w-4 text-sky-400" />
              )}
            </div>

            <p className="text-[10px] text-sky-400 font-mono mt-1">
              Hopcroft-Karp Bipartite Matching
            </p>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Maximizes the absolute number of simultaneous transplants across the network.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Matched Pairs:</span>
              <strong className="text-slate-100 font-bold">{cardinality.totalMatches}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Coverage:</span>
              <strong className="text-emerald-400 font-bold">{cardinality.networkCoveragePercent}%</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Average Score:</span>
              <strong className="text-sky-300">{cardinality.averageWeight}%</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Score:</span>
              <strong className="text-slate-300">{Math.round(cardinality.totalWeight)}</strong>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
              <span>Latency:</span>
              <span>{cardinality.executionTimeMs} ms</span>
            </div>
          </div>
        </div>

        {/* 2. MAXIMUM WEIGHT MATCHING */}
        <div
          onClick={() => onSelectAlgorithm('weight')}
          className={`cursor-pointer rounded-xl p-4 border transition flex flex-col justify-between ${
            selectedAlgorithm === 'weight'
              ? 'bg-slate-800/95 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Trophy className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-100">
                  MAXIMUM WEIGHT
                </h4>
              </div>
              {selectedAlgorithm === 'weight' && (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
            </div>

            <p className="text-[10px] text-emerald-400 font-mono mt-1">
              Maximum Weight Bipartite Matching
            </p>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Maximizes composite clinical compatibility scores to maximize graft survival quality.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Matched Pairs:</span>
              <strong className="text-slate-100 font-bold">{maxWeight.totalMatches}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Coverage:</span>
              <strong className="text-emerald-400 font-bold">{maxWeight.networkCoveragePercent}%</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Average Score:</span>
              <strong className="text-emerald-400 font-bold">{maxWeight.averageWeight}%</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Score:</span>
              <strong className="text-emerald-300 font-bold">{Math.round(maxWeight.totalWeight)}</strong>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
              <span>Latency:</span>
              <span>{maxWeight.executionTimeMs} ms</span>
            </div>
          </div>
        </div>

        {/* 3. MULTI-OBJECTIVE BALANCED (BONUS ADAPTIVE POLICY) */}
        <div
          onClick={() => onSelectAlgorithm('multi-objective')}
          className={`cursor-pointer rounded-xl p-4 border transition flex flex-col justify-between ${
            selectedAlgorithm === 'multi-objective'
              ? 'bg-slate-800/95 border-purple-500 shadow-md ring-1 ring-purple-500/50'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Scale className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-100">
                  MULTI-OBJECTIVE BALANCED
                </h4>
              </div>
              {selectedAlgorithm === 'multi-objective' && (
                <CheckCircle2 className="h-4 w-4 text-purple-400" />
              )}
            </div>

            <p className="text-[10px] text-purple-400 font-mono mt-1">
              Clinical Equity + Volume + Urgency
            </p>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Synthesizes maximum pairing yield with waitlist tenure and critical patient priority bonuses.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Matched Pairs:</span>
              <strong className="text-slate-100 font-bold">{multiObjective.totalMatches}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Coverage:</span>
              <strong className="text-emerald-400 font-bold">{multiObjective.networkCoveragePercent}%</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Average Score:</span>
              <strong className="text-purple-300 font-bold">{multiObjective.averageWeight}%</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Score:</span>
              <strong className="text-purple-200 font-bold">{Math.round(multiObjective.totalWeight)}</strong>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
              <span>Latency:</span>
              <span>{multiObjective.executionTimeMs} ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
