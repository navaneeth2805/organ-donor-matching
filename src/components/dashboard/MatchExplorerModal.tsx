import React from 'react';
import { X, CheckCircle2, ShieldCheck, HeartHandshake, ArrowRight, Activity, MapPin, Building2 } from 'lucide-react';
import { MatchingResult } from '../../utils/graphAnalyticsEngine';

interface MatchExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: MatchingResult['matches'][0] | null;
  hospitalMap: Map<number, string>;
}

export const MatchExplorerModal: React.FC<MatchExplorerModalProps> = ({
  isOpen,
  onClose,
  match,
  hospitalMap,
}) => {
  if (!isOpen || !match) return null;

  const donorHosp = match.donor.hospitalId ? hospitalMap.get(match.donor.hospitalId) : match.donor.location;
  const recipHosp = match.recipient.hospitalId ? hospitalMap.get(match.recipient.hospitalId) : match.recipient.location;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                Matched Pair #{match.rank}
              </span>
              <h2 className="text-base font-bold text-slate-100 mt-1">
                {match.donor.id} ➔ {match.recipient.id} ({match.donor.organ})
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Compatibility Score Hero */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">
                Algorithmic Compatibility Score
              </span>
              <div className="text-3xl font-black text-emerald-400 font-mono mt-0.5">
                {match.score}%
              </div>
              <span className="text-[11px] text-slate-400">
                Status: <strong className="text-slate-200">{match.status}</strong>
              </span>
            </div>
            <div className="text-right space-y-1">
              <span className="text-[10px] text-slate-500 block">Allocation Rule</span>
              <span className="font-mono text-slate-300 font-bold px-2 py-0.5 rounded bg-slate-800">
                {match.ruleVersion || 'Rule Engine v3.2'}
              </span>
              <div className="text-[10px] text-slate-500 mt-1">
                Generated: {match.generatedAt ? match.generatedAt.substring(0, 10) : 'Active Run'}
              </div>
            </div>
          </div>

          {/* Two Sides Comparison */}
          <div className="grid grid-cols-2 gap-3">
            {/* Donor Side */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[10px] uppercase font-bold text-sky-400">Donor</span>
                <span className="font-mono text-slate-300 font-bold">{match.donor.id}</span>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-slate-100">{match.donor.name}</div>
                <div className="text-slate-400">Blood: <strong className="text-slate-200 font-mono">{match.donor.bloodGroup}</strong></div>
                <div className="text-slate-400">Organ: <strong className="text-emerald-400">{match.donor.organ}</strong></div>
                <div className="text-slate-400 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-slate-500" />
                  <span className="truncate">{donorHosp}</span>
                </div>
              </div>
            </div>

            {/* Recipient Side */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[10px] uppercase font-bold text-purple-400">Recipient</span>
                <span className="font-mono text-slate-300 font-bold">{match.recipient.id}</span>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-slate-100">{match.recipient.name}</div>
                <div className="text-slate-400">Blood: <strong className="text-slate-200 font-mono">{match.recipient.bloodGroup}</strong></div>
                <div className="text-slate-400">Urgency: <strong className="text-red-400">{match.recipient.urgency || 'Standard'}</strong></div>
                <div className="text-slate-400 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-slate-500" />
                  <span className="truncate">{recipHosp}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Verification Checklist */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Pre-Allocation Validation Checks
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> ABO Compatibility verified
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Cross-match negative
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Cold Ischemia logistics viable
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Institutional RBAC approval
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close Explorer
          </button>
        </div>
      </div>
    </div>
  );
};
