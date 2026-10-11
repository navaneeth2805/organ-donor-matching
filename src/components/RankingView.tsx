import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Filter,
  Download,
  Sliders,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Grid,
  ListFilter,
  Search,
  ArrowUpDown,
  Zap,
} from 'lucide-react';
import { CompatibilityResult, Donor, RankingWeights, Recipient } from '../types';
import {
  evaluateAllPairs,
  DEFAULT_RANKING_WEIGHTS,
  WEIGHT_PRESETS,
} from '../utils/compatibilityEngine';

interface RankingViewProps {
  donors: Donor[];
  recipients: Recipient[];
}

export const RankingView: React.FC<RankingViewProps> = ({ donors, recipients }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');
  const [weights, setWeights] = useState<RankingWeights>(DEFAULT_RANKING_WEIGHTS);
  const [showSliders, setShowSliders] = useState<boolean>(false);
  const [organFilter, setOrganFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('CompatibleOnly');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table');
  const [inspectResult, setInspectResult] = useState<CompatibilityResult | null>(null);

  // Apply preset
  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    if (WEIGHT_PRESETS[presetKey]) {
      setWeights(WEIGHT_PRESETS[presetKey].weights);
    }
  };

  const handleWeightChange = (key: keyof RankingWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
    setSelectedPreset('custom');
  };

  // Run all evaluations across the network
  const allResults = useMemo(() => {
    return evaluateAllPairs(donors, recipients, weights, false);
  }, [donors, recipients, weights]);

  // Filtered results for candidate table
  const filteredResults = useMemo(() => {
    return allResults.filter((item) => {
      // Organ filter
      if (organFilter !== 'All' && item.donor.organ.toLowerCase() !== organFilter.toLowerCase()) {
        return false;
      }
      // Status filter
      if (statusFilter === 'CompatibleOnly' && item.status === 'INCOMPATIBLE') {
        return false;
      }
      if (statusFilter === 'POTENTIAL_CANDIDATE' && item.status !== 'POTENTIAL_CANDIDATE') {
        return false;
      }
      if (statusFilter === 'REQUIRES_REVIEW' && item.status !== 'REQUIRES_REVIEW') {
        return false;
      }
      if (statusFilter === 'INCOMPATIBLE' && item.status !== 'INCOMPATIBLE') {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const dName = item.donor.name.toLowerCase();
        const rName = item.recipient.name.toLowerCase();
        const organ = item.donor.organ.toLowerCase();
        if (!dName.includes(query) && !rName.includes(query) && !organ.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [allResults, organFilter, statusFilter, searchQuery]);

  const uniqueOrgans = Array.from(new Set(donors.map((d) => d.organ))).sort();

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Rank',
      'Donor ID',
      'Donor Name',
      'Donor Blood',
      'Organ',
      'Recipient ID',
      'Recipient Name',
      'Recipient Blood',
      'Recipient Urgency',
      'Status',
      'Overall Score',
      'Blood Score',
      'HLA Score',
      'Urgency Score',
      'Wait Time Score',
      'Geographic Score',
      'Clinical Score',
    ];

    const rows = filteredResults.map((r, idx) => [
      idx + 1,
      r.donorId,
      `"${r.donor.name}"`,
      r.donor.bloodGroup,
      `"${r.donor.organ}"`,
      r.recipientId,
      `"${r.recipient.name}"`,
      r.recipient.bloodGroup,
      r.recipient.urgency,
      r.status,
      r.overallScore.toFixed(1),
      r.bloodScore,
      r.hlaScore,
      r.urgencyScore,
      r.waitingTimeScore,
      r.geographicScore,
      r.clinicalScore,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Candidate_Rankings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wide">
              Phase 3 Multi-Criteria Optimization
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5 mt-1.5">
            <Trophy className="h-6 w-6 text-sky-400" />
            Candidate Ranking & Matching Matrix
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global network ranking engine with configurable clinical weights and full cross-network NxM compatibility heatmap.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'table' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              Rankings Table
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'matrix' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              Heatmap Matrix
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="h-3.5 w-3.5 text-sky-400" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Preset & Weight Configuration Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-200">Allocation Weight Presets</h2>
          </div>
          <button
            onClick={() => setShowSliders(!showSliders)}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
          >
            {showSliders ? 'Hide Fine-Tuning Sliders' : 'Customize Numerical Weights (0-100)'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`text-left p-3 rounded-lg border transition ${
                selectedPreset === key
                  ? 'bg-sky-500/10 border-sky-500 text-sky-300 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100">{preset.name}</span>
                {selectedPreset === key && <Zap className="h-3.5 w-3.5 text-sky-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{preset.description}</p>
            </button>
          ))}
        </div>

        {/* Custom Weight Sliders */}
        {showSliders && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Urgency</span>
                <span className="font-mono text-sky-400 font-bold">{weights.urgency}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.urgency}
                onChange={(e) => handleWeightChange('urgency', Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Wait Time</span>
                <span className="font-mono text-purple-400 font-bold">{weights.waitingTime}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.waitingTime}
                onChange={(e) => handleWeightChange('waitingTime', Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Blood Match</span>
                <span className="font-mono text-emerald-400 font-bold">{weights.bloodScore}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.bloodScore}
                onChange={(e) => handleWeightChange('bloodScore', Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">HLA Match</span>
                <span className="font-mono text-cyan-400 font-bold">{weights.hlaScore}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.hlaScore}
                onChange={(e) => handleWeightChange('hlaScore', Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Logistics</span>
                <span className="font-mono text-teal-400 font-bold">{weights.geographicScore}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.geographicScore}
                onChange={(e) => handleWeightChange('geographicScore', Number(e.target.value))}
                className="w-full accent-teal-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Clinical Parity</span>
                <span className="font-mono text-indigo-400 font-bold">{weights.clinicalViability}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={weights.clinicalViability}
                onChange={(e) => handleWeightChange('clinicalViability', Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search donor, recipient, or organ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <select
            value={organFilter}
            onChange={(e) => setOrganFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 font-medium"
          >
            <option value="All">All Organs</option>
            {uniqueOrgans.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 font-medium"
          >
            <option value="CompatibleOnly">Compatible & Review Only</option>
            <option value="POTENTIAL_CANDIDATE">Potential Candidates Only</option>
            <option value="REQUIRES_REVIEW">Requires Review Only</option>
            <option value="INCOMPATIBLE">Incompatible Pairs Only</option>
            <option value="All">Show All Pairs (Including Incompatible)</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {filteredResults.length} pairings
        </div>
      </div>

      {/* Main Mode: Table View */}
      {viewMode === 'table' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Organ</th>
                  <th className="px-4 py-3">Donor Candidate</th>
                  <th className="px-4 py-3">Recipient Candidate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Score Profile (B / H / U / G)</th>
                  <th className="px-4 py-3 text-right">Composite Score</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No candidate pairs found matching your active filters.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-100">{item.donor.organ}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{item.donor.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          [{item.donor.bloodGroup}] • {item.donor.age}y • {item.donor.location}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{item.recipient.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          [{item.recipient.bloodGroup}] • Tier: {item.recipient.urgency} ({item.recipient.waitingTimeDays}d)
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold ${
                            item.status === 'POTENTIAL_CANDIDATE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'REQUIRES_REVIEW'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {item.status === 'POTENTIAL_CANDIDATE' && <CheckCircle2 className="h-3 w-3" />}
                          {item.status === 'REQUIRES_REVIEW' && <AlertTriangle className="h-3 w-3" />}
                          {item.status === 'INCOMPATIBLE' && <XCircle className="h-3 w-3" />}
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5 font-mono text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400">
                            B:{item.bloodScore}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-sky-400">
                            H:{item.hlaScore}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-400">
                            U:{item.urgencyScore}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-teal-400">
                            G:{item.geographicScore}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-extrabold text-sm text-slate-100">
                        {item.status === 'INCOMPATIBLE' ? (
                          <span className="text-slate-500">0.0</span>
                        ) : (
                          <span className="text-sky-400">{item.overallScore.toFixed(1)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setInspectResult(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Inspect Pair Rationale"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode: Interactive NxM Compatibility Heatmap Matrix */}
      {viewMode === 'matrix' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Grid className="h-4 w-4 text-sky-400" />
              Cross-Network Compatibility Heatmap Matrix
            </h2>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Compatible
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="h-2 w-2 rounded-sm bg-amber-500" /> Requires Review
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="h-2 w-2 rounded-sm bg-rose-500" /> Incompatible
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Click on any cell in the grid to view instant clinical explainability metrics for that donor-recipient pairing.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs text-slate-300 border border-slate-800">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="p-3 text-left font-bold text-sky-400 min-w-[140px]">
                    Donor \ Recipient
                  </th>
                  {recipients.map((r, rIdx) => (
                    <th key={`${r.id}-${rIdx}`} className="p-2 min-w-[90px]">
                      <div className="font-bold text-slate-200 truncate">{r.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.organNeeded} [{r.bloodGroup}]
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {donors.map((d, dIdx) => (
                  <tr key={`${d.id}-${dIdx}`} className="hover:bg-slate-800/30">
                    <td className="p-2.5 text-left bg-slate-950/60 font-semibold text-slate-200">
                      <div>{d.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {d.organ} [{d.bloodGroup}]
                      </div>
                    </td>
                    {recipients.map((r, rIdx) => {
                      const pairRes = allResults.find(
                        (res) => res.donorId === d.id && res.recipientId === r.id
                      );
                      const isCandidate = pairRes?.status === 'POTENTIAL_CANDIDATE';
                      const isReview = pairRes?.status === 'REQUIRES_REVIEW';

                      return (
                        <td
                          key={`${d.id}-${r.id}-${dIdx}-${rIdx}`}
                          onClick={() => pairRes && setInspectResult(pairRes)}
                          className={`p-2 cursor-pointer transition font-mono font-bold text-xs ${
                            isCandidate
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : isReview
                              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                              : 'bg-rose-950/10 text-slate-600 hover:bg-rose-950/20'
                          }`}
                          title={`Click to inspect ${d.name} ➔ ${r.name}`}
                        >
                          {pairRes?.status === 'INCOMPATIBLE' ? (
                            '✕'
                          ) : (
                            <span>{pairRes?.overallScore.toFixed(0)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Pair Modal */}
      {inspectResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-sky-400" />
                Clinical Explainability Narrative
              </h3>
              <button
                onClick={() => setInspectResult(null)}
                className="text-slate-400 hover:text-slate-100 text-xs px-2 py-1 rounded bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Pair Evaluation</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    inspectResult.status === 'POTENTIAL_CANDIDATE'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : inspectResult.status === 'REQUIRES_REVIEW'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {inspectResult.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-100">
                Donor #{inspectResult.donor.id} ({inspectResult.donor.name}) ➔ Recipient #{inspectResult.recipient.id} ({inspectResult.recipient.name})
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {inspectResult.explanations[0]}
              </p>
            </div>

            {/* Score matrix */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Overall Score</span>
                <span className="font-bold text-sm text-sky-400 font-mono">
                  {inspectResult.overallScore.toFixed(1)}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Blood Harmony</span>
                <span className="font-bold text-sm text-emerald-400 font-mono">
                  {inspectResult.bloodScore}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">HLA Match</span>
                <span className="font-bold text-sm text-purple-400 font-mono">
                  {inspectResult.hlaScore}
                </span>
              </div>
            </div>

            {/* Rule List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Evaluated Rules</span>
              {inspectResult.ruleResults.map((r, i) => (
                <div
                  key={i}
                  className="p-2 rounded bg-slate-950/60 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-slate-200">{r.name}:</span>{' '}
                    <span className="text-slate-400">{r.message}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      r.severity === 'PASS'
                        ? 'text-emerald-400'
                        : r.severity === 'WARN'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {r.severity}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 text-right">
              <button
                onClick={() => setInspectResult(null)}
                className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
