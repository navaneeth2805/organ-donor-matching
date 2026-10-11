import React, { useState, useMemo } from 'react';
import {
  GitFork,
  Maximize2,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building2,
  UserCheck,
  Eye,
  Search,
} from 'lucide-react';
import { ActiveTab, Hospital, OrganType, BloodGroup } from '../../types';
import { BipartiteGraph, BipartiteNode, BipartiteEdge, MatchingResult } from '../../utils/graphAnalyticsEngine';

interface InteractiveGraphPanelProps {
  graph: BipartiteGraph;
  activeMatching: MatchingResult;
  hospitals: Hospital[];
  onNavigate: (tab: ActiveTab) => void;
  onRunMatching?: () => void;
  selectedAlgorithm: 'cardinality' | 'weight' | 'multi-objective';
  onSelectAlgorithm: (algo: 'cardinality' | 'weight' | 'multi-objective') => void;
}

export const InteractiveGraphPanel: React.FC<InteractiveGraphPanelProps> = ({
  graph,
  activeMatching,
  hospitals,
  onNavigate,
  onRunMatching,
  selectedAlgorithm,
  onSelectAlgorithm,
}) => {
  // Graph-specific Filter Controls (Requirement 9)
  const [graphOrgan, setGraphOrgan] = useState<string>('All');
  const [graphBlood, setGraphBlood] = useState<string>('All');
  const [graphHospital, setGraphHospital] = useState<string>('All');
  const [graphUrgency, setGraphUrgency] = useState<string>('All');
  const [minScore, setMinScore] = useState<number>(0);
  const [matchStatusFilter, setMatchStatusFilter] = useState<'All' | 'Matched' | 'Unmatched'>('All');
  const [showOnlyMatches, setShowOnlyMatches] = useState<boolean>(false);

  // Highlighting & Selection State (Requirement 11)
  const [selectedNode, setSelectedNode] = useState<BipartiteNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<BipartiteEdge | null>(null);
  const [isolatedMessage, setIsolatedMessage] = useState<string | null>(null);

  // Hospital lookup map
  const hospitalMap = useMemo(() => {
    const map = new Map<number, string>();
    hospitals.forEach((h) => map.set(h.id, h.name));
    return map;
  }, [hospitals]);

  // Set of matched edge keys: "D101-R201"
  const matchedEdgeSet = useMemo(() => {
    const set = new Set<string>();
    activeMatching.matches.forEach((m) => {
      set.add(`${m.donor.id}-${m.recipient.id}`);
    });
    return set;
  }, [activeMatching]);

  const matchedDonorIds = useMemo(() => {
    return new Set<string>(activeMatching.matches.map((m) => m.donor.id));
  }, [activeMatching]);

  const matchedRecipientIds = useMemo(() => {
    return new Set<string>(activeMatching.matches.map((m) => m.recipient.id));
  }, [activeMatching]);

  // Filtered nodes for the compact graph view
  const { visibleDonors, visibleRecipients } = useMemo(() => {
    let donors = graph.donors;
    let recipients = graph.recipients;

    if (graphOrgan !== 'All') {
      donors = donors.filter((d) => d.organ === graphOrgan);
      recipients = recipients.filter((r) => r.organ === graphOrgan);
    }
    if (graphBlood !== 'All') {
      donors = donors.filter((d) => d.bloodGroup === graphBlood);
      recipients = recipients.filter((r) => r.bloodGroup === graphBlood);
    }
    if (graphHospital !== 'All') {
      donors = donors.filter((d) => d.hospitalId?.toString() === graphHospital);
      recipients = recipients.filter((r) => r.hospitalId?.toString() === graphHospital);
    }
    if (graphUrgency !== 'All') {
      recipients = recipients.filter((r) => r.urgency === graphUrgency);
    }
    if (matchStatusFilter === 'Matched') {
      donors = donors.filter((d) => matchedDonorIds.has(d.id));
      recipients = recipients.filter((r) => matchedRecipientIds.has(r.id));
    } else if (matchStatusFilter === 'Unmatched') {
      donors = donors.filter((d) => !matchedDonorIds.has(d.id));
      recipients = recipients.filter((r) => !matchedRecipientIds.has(r.id));
    }

    // Limit to top 7 on each side for compact, high-clarity dashboard view
    return {
      visibleDonors: donors.slice(0, 7),
      visibleRecipients: recipients.slice(0, 7),
    };
  }, [graph, graphOrgan, graphBlood, graphHospital, graphUrgency, matchStatusFilter, matchedDonorIds, matchedRecipientIds]);

  // Node Y positions
  const donorYMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleDonors.forEach((d, idx) => {
      map.set(d.id, 50 + idx * 56);
    });
    return map;
  }, [visibleDonors]);

  const recipientYMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleRecipients.forEach((r, idx) => {
      map.set(r.id, 50 + idx * 56);
    });
    return map;
  }, [visibleRecipients]);

  // Filtered Edges to render
  const visibleEdges = useMemo(() => {
    return graph.edges.filter((e) => {
      const dY = donorYMap.get(e.donorId);
      const rY = recipientYMap.get(e.recipientId);
      if (dY === undefined || rY === undefined) return false;
      if (e.compatibilityScore < minScore) return false;

      const isMatched = matchedEdgeSet.has(`${e.donorId}-${e.recipientId}`);
      if (showOnlyMatches && !isMatched) return false;

      return true;
    });
  }, [graph.edges, donorYMap, recipientYMap, minScore, showOnlyMatches, matchedEdgeSet]);

  // Highlighting set of nodes & edges
  const highlightedRecipientIds = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'donor') return new Set<string>();
    const neighbors = graph.adj.get(selectedNode.id) || [];
    return new Set(neighbors.map((n) => n.neighborId));
  }, [selectedNode, graph.adj]);

  const highlightedDonorIds = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'recipient') return new Set<string>();
    const neighbors = graph.adj.get(selectedNode.id) || [];
    return new Set(neighbors.map((n) => n.neighborId));
  }, [selectedNode, graph.adj]);

  // Node click handler (Requirement 11)
  const handleNodeClick = (node: BipartiteNode) => {
    setSelectedEdge(null);
    setSelectedNode(node);

    const neighbors = graph.adj.get(node.id) || [];
    if (neighbors.length === 0) {
      setIsolatedMessage(
        `NO CURRENT COMPATIBLE CONNECTIONS for ${node.id} (${node.organ}, ${node.bloodGroup}). Candidate remains in registry and will automatically evaluate upon new arrivals.`
      );
    } else {
      setIsolatedMessage(null);
    }
  };

  const handleResetView = () => {
    setGraphOrgan('All');
    setGraphBlood('All');
    setGraphHospital('All');
    setGraphUrgency('All');
    setMinScore(0);
    setMatchStatusFilter('All');
    setShowOnlyMatches(false);
    setSelectedNode(null);
    setSelectedEdge(null);
    setIsolatedMessage(null);
  };

  const svgHeight = Math.max(440, Math.max(visibleDonors.length, visibleRecipients.length) * 56 + 60);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* 1. Header with Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <GitFork className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Bipartite Matching Network Preview
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                {activeMatching.totalMatches} Matches Active
              </span>
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Phase 4 NetworkX Bipartite Graph: Donors (supply) ➔ Compatibility Edges ➔ Recipients (demand)
          </p>
        </div>

        {/* 5 Actions (Requirement 10) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => onNavigate('graph-analytics')}
            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            OPEN FULL GRAPH
          </button>

          <button
            onClick={onRunMatching}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            <Play className="h-3.5 w-3.5" />
            RUN MATCHING
          </button>

          <button
            onClick={() => onNavigate('analytics')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
          >
            GRAPH ANALYTICS
          </button>

          <button
            onClick={() => setShowOnlyMatches(!showOnlyMatches)}
            className={`px-2.5 py-1.5 rounded-xl border font-medium transition flex items-center gap-1 ${
              showOnlyMatches
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Eye className="h-3 w-3" />
            VIEW MATCHES
          </button>

          <button
            onClick={handleResetView}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            RESET VIEW
          </button>
        </div>
      </div>

      {/* 2. Graph Filter Controls (Requirement 9) */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Organ</label>
          <select
            value={graphOrgan}
            onChange={(e) => setGraphOrgan(e.target.value)}
            className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs"
          >
            <option value="All">All Organs</option>
            {['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Cornea', 'Bone Marrow'].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Blood Group</label>
          <select
            value={graphBlood}
            onChange={(e) => setGraphBlood(e.target.value)}
            className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs"
          >
            <option value="All">All Blood Types</option>
            {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Hospital</label>
          <select
            value={graphHospital}
            onChange={(e) => setGraphHospital(e.target.value)}
            className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs truncate"
          >
            <option value="All">All Centers</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id.toString()}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Urgency</label>
          <select
            value={graphUrgency}
            onChange={(e) => setGraphUrgency(e.target.value)}
            className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs"
          >
            <option value="All">All Urgency</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Status</label>
          <select
            value={matchStatusFilter}
            onChange={(e) => setMatchStatusFilter(e.target.value as any)}
            className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs"
          >
            <option value="All">All Statuses</option>
            <option value="Matched">Matched Only</option>
            <option value="Unmatched">Unmatched Only</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
            <span>Min Score</span>
            <span className="text-sky-400 font-bold">{minScore}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="95"
            step="5"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Isolated Node Alert if triggered */}
      {isolatedMessage && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            <span>{isolatedMessage}</span>
          </div>
          <button
            onClick={() => setIsolatedMessage(null)}
            className="text-[11px] underline ml-2 font-mono hover:text-amber-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Main SVG Bipartite Visualization */}
      <div className="relative bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 overflow-hidden">
        <svg viewBox={`0 0 740 ${svgHeight}`} className="w-full h-auto select-none">
          {/* Column Header Titles */}
          <text x="100" y="24" fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">
            DONOR NODES ({visibleDonors.length})
          </text>
          <text x="370" y="24" fill="#64748b" fontSize="11" fontWeight="bold" textAnchor="middle">
            COMPATIBILITY EDGES ({visibleEdges.length})
          </text>
          <text x="640" y="24" fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">
            RECIPIENT NODES ({visibleRecipients.length})
          </text>

          {/* Spline Compatibility Edges */}
          {visibleEdges.map((edge) => {
            const y1 = donorYMap.get(edge.donorId) || 0;
            const y2 = recipientYMap.get(edge.recipientId) || 0;
            const isMatched = matchedEdgeSet.has(`${edge.donorId}-${edge.recipientId}`);

            const isSelected =
              selectedEdge?.donorId === edge.donorId && selectedEdge?.recipientId === edge.recipientId;

            const isHighlighted =
              (selectedNode?.type === 'donor' && selectedNode.id === edge.donorId) ||
              (selectedNode?.type === 'recipient' && selectedNode.id === edge.recipientId);

            const strokeColor = isMatched
              ? '#10b981' // Green for matched
              : isSelected
              ? '#f59e0b'
              : isHighlighted
              ? '#38bdf8'
              : '#334155';

            const strokeWidth = isMatched ? 3 : isSelected || isHighlighted ? 2.5 : 1.2;
            const opacity = isSelected || isHighlighted ? 1 : isMatched ? 0.85 : 0.45;

            // Bezier curve from donor port (x=190) to recipient port (x=550)
            const pathD = `M 190 ${y1} C 370 ${y1}, 370 ${y2}, 550 ${y2}`;

            return (
              <g
                key={`${edge.donorId}-${edge.recipientId}`}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedEdge(edge);
                  setSelectedNode(null);
                  setIsolatedMessage(null);
                }}
              >
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={isMatched ? 'none' : '4 3'}
                  opacity={opacity}
                  className="transition-all duration-200 hover:opacity-100"
                />
                {/* Midpoint Score Pill */}
                <rect
                  x="350"
                  y={(y1 + y2) / 2 - 9}
                  width="40"
                  height="18"
                  rx="4"
                  fill="#0f172a"
                  stroke={strokeColor}
                  strokeWidth="1.2"
                />
                <text
                  x="370"
                  y={(y1 + y2) / 2 + 3}
                  fill={isMatched ? '#10b981' : '#cbd5e1'}
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="font-mono pointer-events-none"
                >
                  {edge.compatibilityScore}%
                </text>
              </g>
            );
          })}

          {/* DONOR NODES (Left Column) */}
          {visibleDonors.map((donor) => {
            const y = donorYMap.get(donor.id) || 0;
            const isMatched = matchedDonorIds.has(donor.id);
            const isSelected = selectedNode?.id === donor.id;
            const isConnectedToSelected = highlightedDonorIds.has(donor.id);
            const hospitalName = hospitalMap.get(donor.hospitalId || 1) || donor.location;

            return (
              <g
                key={donor.id}
                onClick={() => handleNodeClick(donor)}
                className="cursor-pointer group"
              >
                {/* Node Box (Protected attributes: ID, Blood, Organ, Hospital) */}
                <rect
                  x="10"
                  y={y - 22}
                  width="180"
                  height="44"
                  rx="10"
                  fill={isSelected ? '#1e293b' : isConnectedToSelected ? '#1e293b' : '#0f172a'}
                  stroke={isSelected ? '#38bdf8' : isMatched ? '#10b981' : '#334155'}
                  strokeWidth={isSelected ? 2.5 : isMatched ? 1.8 : 1.2}
                  className="transition-colors"
                />
                {/* Status Dot */}
                <circle
                  cx="24"
                  cy={y}
                  r="5"
                  fill={isMatched ? '#10b981' : '#38bdf8'}
                />
                {/* Node Text: ID, Organ, Blood, Hospital */}
                <text x="36" y={y - 4} fill="#f1f5f9" fontSize="11" fontWeight="bold">
                  {donor.id} • {donor.bloodGroup}
                </text>
                <text x="36" y={y + 12} fill="#94a3b8" fontSize="9">
                  {donor.organ} | {hospitalName.slice(0, 16)}
                </text>
                {/* Connect port */}
                <circle
                  cx="190"
                  cy={y}
                  r="5"
                  fill={isMatched ? '#10b981' : '#64748b'}
                  stroke="#0f172a"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* RECIPIENT NODES (Right Column) */}
          {visibleRecipients.map((recipient) => {
            const y = recipientYMap.get(recipient.id) || 0;
            const isMatched = matchedRecipientIds.has(recipient.id);
            const isSelected = selectedNode?.id === recipient.id;
            const isConnectedToSelected = highlightedRecipientIds.has(recipient.id);
            const hospitalName = hospitalMap.get(recipient.hospitalId || 1) || recipient.location;

            return (
              <g
                key={recipient.id}
                onClick={() => handleNodeClick(recipient)}
                className="cursor-pointer group"
              >
                {/* Connect port */}
                <circle
                  cx="550"
                  cy={y}
                  r="5"
                  fill={isMatched ? '#10b981' : '#64748b'}
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                {/* Node Box */}
                <rect
                  x="550"
                  y={y - 22}
                  width="180"
                  height="44"
                  rx="10"
                  fill={isSelected ? '#1e293b' : isConnectedToSelected ? '#1e293b' : '#0f172a'}
                  stroke={isSelected ? '#c084fc' : isMatched ? '#10b981' : '#334155'}
                  strokeWidth={isSelected ? 2.5 : isMatched ? 1.8 : 1.2}
                  className="transition-colors"
                />
                {/* Status Dot */}
                <circle
                  cx="566"
                  cy={y}
                  r="5"
                  fill={
                    recipient.urgency === 'Critical'
                      ? '#ef4444'
                      : isMatched
                      ? '#10b981'
                      : '#c084fc'
                  }
                />
                {/* Node Text: ID, Organ, Blood, Urgency, Hospital */}
                <text x="578" y={y - 4} fill="#f1f5f9" fontSize="11" fontWeight="bold">
                  {recipient.id} • {recipient.bloodGroup} [{recipient.urgency || 'Med'}]
                </text>
                <text x="578" y={y + 12} fill="#94a3b8" fontSize="9">
                  {recipient.organ} | {hospitalName.slice(0, 16)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Informational Callout when a Node or Edge is clicked */}
        {selectedNode && (
          <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-sky-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-200">
                  {selectedNode.type.toUpperCase()}: {selectedNode.id}
                </span>{' '}
                <span className="text-slate-400">
                  ({selectedNode.organ}, Blood {selectedNode.bloodGroup}
                  {selectedNode.urgency ? `, Urgency: ${selectedNode.urgency}` : ''})
                </span>
                <span className="text-slate-500 ml-2">
                  Hospital: {hospitalMap.get(selectedNode.hospitalId || 1) || selectedNode.location}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-emerald-400">
              Connected candidates highlighted • No PII exposed
            </div>
          </div>
        )}

        {selectedEdge && (
          <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-emerald-500/40 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-200">
                  EDGE: {selectedEdge.donorId} ➔ {selectedEdge.recipientId}
                </span>{' '}
                <span className="text-emerald-400 font-bold">
                  Compatibility Score: {selectedEdge.compatibilityScore}%
                </span>
                <span className="text-slate-400 ml-2">
                  Status: {selectedEdge.status} | Rule Engine: {selectedEdge.ruleVersion || 'v3.2'}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              Deterministic Phase 3 evaluation
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
