import React, { useState, useMemo } from 'react';
import { Network, Activity, HelpCircle, GitFork, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BipartiteGraph, BipartiteNode, BipartiteEdge } from '../../utils/graphAnalyticsEngine';

interface RadialNetworkConnectivityProps {
  graph: BipartiteGraph;
}

export const RadialNetworkConnectivity: React.FC<RadialNetworkConnectivityProps> = ({ graph }) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Compute degree for each node
  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    graph.nodes.forEach((n) => {
      const neighbors = graph.adj.get(n.id) || [];
      map.set(n.id, neighbors.length);
    });
    return map;
  }, [graph]);

  // Representative sample for circular layout (up to 12 donors and 12 recipients)
  const circularDonors = useMemo(() => graph.donors.slice(0, 12), [graph.donors]);
  const circularRecipients = useMemo(() => graph.recipients.slice(0, 12), [graph.recipients]);

  const cx = 240;
  const cy = 240;
  const radius = 175;

  // Position donors on the left semicircle (from angle 100 to 260 degrees)
  const donorCoords = useMemo(() => {
    const coords = new Map<string, { x: number; y: number; angle: number }>();
    const count = circularDonors.length;
    circularDonors.forEach((d, i) => {
      const startAngle = 100;
      const endAngle = 260;
      const angleDeg = count > 1 ? startAngle + (i / (count - 1)) * (endAngle - startAngle) : 180;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = cx + radius * Math.cos(angleRad);
      const y = cy + radius * Math.sin(angleRad);
      coords.set(d.id, { x, y, angle: angleDeg });
    });
    return coords;
  }, [circularDonors, cx, cy, radius]);

  // Position recipients on the right semicircle (from angle -80 to +80 degrees)
  const recipientCoords = useMemo(() => {
    const coords = new Map<string, { x: number; y: number; angle: number }>();
    const count = circularRecipients.length;
    circularRecipients.forEach((r, i) => {
      const startAngle = -80;
      const endAngle = 80;
      const angleDeg = count > 1 ? startAngle + (i / (count - 1)) * (endAngle - startAngle) : 0;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = cx + radius * Math.cos(angleRad);
      const y = cy + radius * Math.sin(angleRad);
      coords.set(r.id, { x, y, angle: angleDeg });
    });
    return coords;
  }, [circularRecipients, cx, cy, radius]);

  // Edges connecting visible nodes
  const radialEdges = useMemo(() => {
    return graph.edges.filter((e) => {
      return donorCoords.has(e.donorId) && recipientCoords.has(e.recipientId);
    });
  }, [graph.edges, donorCoords, recipientCoords]);

  // Identify hubs & bottlenecks
  const stats = useMemo(() => {
    let maxD = 0;
    let maxNode = '';
    let isolatedCount = 0;
    let bottleneckCount = 0;

    degreeMap.forEach((deg, id) => {
      if (deg > maxD) {
        maxD = deg;
        maxNode = id;
      }
      if (deg === 0) isolatedCount++;
      if (deg === 1) bottleneckCount++;
    });

    return { maxDegree: maxD, topHub: maxNode, isolatedCount, bottleneckCount };
  }, [degreeMap]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold uppercase">
              NETWORK HEALTH
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              NETWORK CONNECTIVITY
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Radial topology overview: Donors (left arc) ↔ Compatibility chords ↔ Patients (right arc)
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Donors
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-400" /> Patients
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Hubs
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-slate-500" /> Isolated
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Radial SVG Visualization (7 cols) */}
        <div className="lg:col-span-7 flex justify-center relative">
          <svg viewBox="0 0 480 480" className="w-full max-w-[420px] h-auto select-none">
            {/* Outer perimeter orbit */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {/* Center Core */}
            <circle
              cx={cx}
              cy={cy}
              r="34"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2"
            />
            <text
              x={cx}
              y={cy - 4}
              fill="#38bdf8"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
              className="font-mono"
            >
              {graph.edges.length}
            </text>
            <text
              x={cx}
              y={cy + 10}
              fill="#64748b"
              fontSize="8.5"
              textAnchor="middle"
              className="font-mono uppercase font-bold"
            >
              CHORDS
            </text>

            {/* Radial Chords */}
            {radialEdges.map((edge) => {
              const dPt = donorCoords.get(edge.donorId);
              const rPt = recipientCoords.get(edge.recipientId);
              if (!dPt || !rPt) return null;

              const isHighlighted =
                hoveredNodeId === edge.donorId || hoveredNodeId === edge.recipientId;

              // Bezier through center
              const pathD = `M ${dPt.x} ${dPt.y} Q ${cx} ${cy} ${rPt.x} ${rPt.y}`;

              return (
                <path
                  key={`${edge.donorId}-${edge.recipientId}`}
                  d={pathD}
                  fill="none"
                  stroke={isHighlighted ? '#38bdf8' : '#334155'}
                  strokeWidth={isHighlighted ? 2.5 : 1}
                  opacity={isHighlighted ? 1 : 0.45}
                  className="transition-all duration-200"
                />
              );
            })}

            {/* Donor Nodes */}
            {circularDonors.map((donor) => {
              const pt = donorCoords.get(donor.id);
              if (!pt) return null;
              const degree = degreeMap.get(donor.id) || 0;
              const isHub = degree >= 3;
              const isIsolated = degree === 0;
              const isHovered = hoveredNodeId === donor.id;

              return (
                <g
                  key={donor.id}
                  onMouseEnter={() => setHoveredNodeId(donor.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  className="cursor-pointer group"
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHub ? 11 : isIsolated ? 7 : 9}
                    fill={isHovered ? '#38bdf8' : isHub ? '#0284c7' : '#0f172a'}
                    stroke={isHovered ? '#f1f5f9' : isHub ? '#38bdf8' : '#334155'}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-all"
                  />
                  <text
                    x={pt.x - 14}
                    y={pt.y + 4}
                    fill="#94a3b8"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="end"
                    className="font-mono pointer-events-none"
                  >
                    {donor.id}
                  </text>
                </g>
              );
            })}

            {/* Recipient Nodes */}
            {circularRecipients.map((recipient) => {
              const pt = recipientCoords.get(recipient.id);
              if (!pt) return null;
              const degree = degreeMap.get(recipient.id) || 0;
              const isHub = degree >= 3;
              const isIsolated = degree === 0;
              const isHovered = hoveredNodeId === recipient.id;

              return (
                <g
                  key={recipient.id}
                  onMouseEnter={() => setHoveredNodeId(recipient.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  className="cursor-pointer group"
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHub ? 11 : isIsolated ? 7 : 9}
                    fill={isHovered ? '#c084fc' : isHub ? '#9333ea' : '#0f172a'}
                    stroke={isHovered ? '#f1f5f9' : isHub ? '#c084fc' : '#334155'}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-all"
                  />
                  <text
                    x={pt.x + 14}
                    y={pt.y + 4}
                    fill="#94a3b8"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="start"
                    className="font-mono pointer-events-none"
                  >
                    {recipient.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Topology Breakdown (5 cols) */}
        <div className="lg:col-span-5 space-y-3 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-sky-400" />
              Structural Network Topography
            </h4>

            <div className="space-y-2 font-mono">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Total Bipartite Nodes:</span>
                <span className="font-bold text-slate-200">{graph.nodes.length} nodes</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Total Compatibility Chords:</span>
                <span className="font-bold text-sky-400">{graph.edges.length} edges</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Peak Degree Hub:</span>
                <span className="font-bold text-amber-400">
                  {stats.topHub || 'D101'} ({stats.maxDegree} links)
                </span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Bottlenecks (Degree = 1):</span>
                <span className="font-bold text-amber-300">{stats.bottleneckCount} nodes</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Isolated Candidates:</span>
                <span className="font-bold text-slate-400">{stats.isolatedCount} nodes</span>
              </div>
            </div>
          </div>

          {/* Neutral disclaimer */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
            <HelpCircle className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-300">Topological Graph Connectivity:</strong> High degree indicates more mathematical compatibility edges in the current active registry. It{' '}
              <span className="text-amber-300">does not indicate medical superiority</span> or higher likelihood of graft survival.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
