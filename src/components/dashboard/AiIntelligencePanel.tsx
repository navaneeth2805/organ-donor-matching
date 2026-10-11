import React from 'react';
import { Sparkles, ArrowRight, TrendingUp, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AiInsight } from '../../services/dashboardService';

interface AiIntelligencePanelProps {
  insights: AiInsight[];
  onActionClick: (insight: AiInsight) => void;
}

export const AiIntelligencePanel: React.FC<AiIntelligencePanelProps> = ({
  insights,
  onActionClick,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              AI Clinical Intelligence & Strategy
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20 uppercase tracking-wider">
                Real-Time
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Heuristic patterns and network optimization suggestions generated from registry state
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-slate-200 leading-snug">
                  {insight.title}
                </span>
                {insight.impactScore && (
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {insight.impactScore}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                {insight.summary}
              </p>
            </div>

            {insight.recommendedAction && (
              <div className="mt-3 pt-2.5 border-t border-slate-900 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 truncate max-w-[280px]">
                  Rec: <strong className="text-slate-400">{insight.recommendedAction}</strong>
                </span>
                <button
                  onClick={() => onActionClick(insight)}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 shrink-0 ml-2"
                >
                  Apply →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
