import React, { useState, useMemo } from 'react';
import { GitFork, Maximize2, Zap, ArrowRight, Eye, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { BipartiteGraph, MatchingResult } from '../../utils/graphAnalyticsEngine';

interface LiveBipartitePreviewProps {
  graph: BipartiteGraph;
  activeMatching: MatchingResult;
  onOpenFullGraph: () => void;
  selectedAlgorithm: 'cardinality' | 'weight' | 'multi-objective';
  onSelectAlgorithm: (algo: 'cardinality' | 'weight' | 'multi-objective') => void;
}

export const LiveBipartitePreview: React.FC<LiveBipartitePreviewProps> = ({
  graph,
  activeMatching,
  onOpenFullGraph,
  selectedAlgorithm,
  onSelectAlgorithm,
}) => {
  const [showMatchesOnly, setShowMatchesOnly] = useState(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Set of matched edge keys: "D101-R201"
  const matchedEdgeSet = useMemo(() => {
    const set = new Set<string>();
    activeMatching.matches.forEach((m) => {
      set.add(`${m.donor.id}-${m.recipient.id}`);
    });
    return set;
  }, [activeMatching]);

  // Display limited subset for compact dashboard view (top 6 donors and recipients)
  const displayDonors = graph.donors.slice(0, 6);
  const displayRecipients = graph.recipients.slice(0, 6);

  const donorYMap = useMemo(() => {
    const map = new Map<string, number>();
    displayDonors.forEach((d, idx) => {
      map.set(d.id, 40 + idx * 48);
    });
    return map;
  }, [displayDonors]);

  const recipientYMap = useMemo(() => {
    const map = new Map<string, number>();
    displayRecipients.forEach((r, idx) => {
      map.set(r.id, 40 + idx * 48);
    });
    return map;
  }, [displayRecipients]);

  // Edges to render in SVG
  const previewEdges = useMemo(() => {
    return graph.edges.filter((e) => {
      const dY = donorYMap.get(e.donorId);
      const rY = recipientYMap.get(e.recipientId);
      if (dY === undefined || rY === undefined) return false;
      const isMatched = matchedEdgeSet.has(`${e.donorId}-${e.recipientId}`);
      if (showMatchesOnly && !isMatched) return false;
      return true;
    });
  }, [graph.edges, donorYMap, recipientYMap, matchedEdgeSet, showMatchesOnly]);

  const svgHeight = Math.max(340, Math.max(displayDonors.length, displayRecipients.length) * 48 + 50);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <GitFork className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Live Bipartite Graph Preview
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                {activeMatching.totalMatches} Matches Active
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Interactive allocation network: Donors (left) ➔ Recipients (right)
            </p>
          </div>
        </div>

        {/* Algorithm Tabs & View Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              onClick={() => onSelectAlgorithm('cardinality')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                selectedAlgorithm === 'cardinality'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cardinality
            </button>
            <button
              onClick={() => onSelectAlgorithm('weight')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                selectedAlgorithm === 'weight'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Max Weight
            </button>
            <button
              onClick={() => onSelectAlgorithm('multi-objective')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                selectedAlgorithm === 'multi-objective'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Multi-Objective
            </button>
          </div>

          <button
            onClick={() => setShowMatchesOnly(!showMatchesOnly)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition flex items-center gap-1.5 ${
              showMatchesOnly
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Eye className="h-3 w-3" />
            {showMatchesOnly ? 'Matches Only' : 'All Edges'}
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-hidden py-3">
        <svg
          viewBox={`0 0 600 ${svgHeight}`}
          className="w-full h-auto max-h-[380px] select-none"
        >
          {/* Column labels */}
          <text x="70" y="20" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">
            DONORS (SUPPLY)
          </text>
          <text x="530" y="20" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">
            RECIPIENTS (DEMAND)
          </text>

          {/* Spline Edges */}
          {previewEdges.map((edge) => {
            const y1 = donorYMap.get(edge.donorId) || 0;
            const y2 = recipientYMap.get(edge.recipientId) || 0;
            const isMatched = matchedEdgeSet.has(`${edge.donorId}-${edge.recipientId}`);
            const isHighlighted =
              hoveredNodeId === edge.donorId || hoveredNodeId === edge.recipientId;

            const pathD = `M 140 ${y1} C 300 ${y1}, 300 ${y2}, 460 ${y2}`;

            return (
              <g key={`${edge.donorId}-${edge.recipientId}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    isMatched
                      ? '#10b981'
                      : isHighlighted
                      ? '#38bdf8'
                      : '#334155'
                  }
                  strokeWidth={isMatched ? (isHighlighted ? 4 : 2.5) : isHighlighted ? 2 : 1}
                  strokeDasharray={isMatched ? 'none' : '4 3'}
                  opacity={isMatched ? (hoveredNodeId && !isHighlighted ? 0.3 : 0.9) : isHighlighted ? 0.9 : 0.4}
                  className="transition-all duration-300"
                />
                {isMatched && (
                  <circle
                    cx="300"
                    cy={(y1 + y2) / 2}
                    r="9"
                    fill="#0f172a"
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                )}
                {isMatched && (
                  <text
                    x="300"
                    y={(y1 + y2) / 2 + 3}
                    fill="#10b981"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="font-mono pointer-events-none"
                  >
                    {edge.weight}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Donor Nodes */}
          {displayDonors.map((donor) => {
            const y = donorYMap.get(donor.id) || 0;
            const isHovered = hoveredNodeId === donor.id;
            const isMatched = Array.from(matchedEdgeSet).some((k: string) => k.startsWith(`${donor.id}-`));

            return (
              <g
                key={donor.id}
                onMouseEnter={() => setHoveredNodeId(donor.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className="cursor-pointer group"
              >
                {/* Node bubble */}
                <rect
                  x="10"
                  y={y - 18}
                  width="130"
                  height="36"
                  rx="10"
                  fill={isHovered ? '#1e293b' : '#0f172a'}
                  stroke={isMatched ? '#10b981' : '#334155'}
                  strokeWidth={isHovered ? 2 : 1.2}
                  className="transition-colors"
                />
                {/* Status dot */}
                <circle
                  cx="24"
                  cy={y}
                  r="4.5"
                  fill={isMatched ? '#10b981' : '#38bdf8'}
                />
                {/* Text labels */}
                <text x="36" y={y - 2} fill="#f1f5f9" fontSize="11" fontWeight="bold">
                  {donor.id}
                </text>
                <text x="36" y={y + 11} fill="#94a3b8" fontSize="9">
                  {donor.organ} • {donor.bloodGroup}
                </text>
                {/* Link node */}
                <circle
                  cx="140"
                  cy={y}
                  r="5"
                  fill={isMatched ? '#10b981' : '#64748b'}
                  stroke="#0f172a"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* Recipient Nodes */}
          {displayRecipients.map((recipient) => {
            const y = recipientYMap.get(recipient.id) || 0;
            const isHovered = hoveredNodeId === recipient.id;
            const isMatched = Array.from(matchedEdgeSet).some((k: string) => k.endsWith(`-${recipient.id}`));
            const isCritical = recipient.urgency === 'Critical';

            return (
              <g
                key={recipient.id}
                onMouseEnter={() => setHoveredNodeId(recipient.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className="cursor-pointer group"
              >
                {/* Link node */}
                <circle
                  cx="460"
                  cy={y}
                  r="5"
                  fill={isMatched ? '#10b981' : isCritical ? '#ef4444' : '#64748b'}
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                {/* Node bubble */}
                <rect
                  x="460"
                  y={y - 18}
                  width="130"
                  height="36"
                  rx="10"
                  fill={isHovered ? '#1e293b' : '#0f172a'}
                  stroke={isMatched ? '#10b981' : isCritical ? '#ef4444' : '#334155'}
                  strokeWidth={isHovered ? 2 : 1.2}
                  className="transition-colors"
                />
                {/* Text labels */}
                <text x="475" y={y - 2} fill="#f1f5f9" fontSize="11" fontWeight="bold">
                  {recipient.id}
                </text>
                <text x="475" y={y + 11} fill="#94a3b8" fontSize="9">
                  {recipient.organ} • {recipient.bloodGroup} • {recipient.urgency}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer Navigation CTA */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Matched Pair
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-600" />
            Eligible Candidate
          </span>
        </div>

        <button
          onClick={onOpenFullGraph}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition group"
        >
          Open Interactive Graph Studio
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
