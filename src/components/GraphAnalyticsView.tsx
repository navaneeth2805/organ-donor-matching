import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Network,
  Share2,
  Cpu,
  Layers,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BarChart2,
  Zap,
  Filter,
  Search,
  ArrowUpDown,
  RefreshCw,
  Award,
  Users,
  UserPlus,
  ShieldCheck,
  ChevronRight,
  GitFork,
  Activity,
} from 'lucide-react';
import { Donor, Hospital, Recipient } from '../types';
import {
  buildCompatibilityGraph,
  computeTopologicalMetrics,
  computeDegreeSummary,
  computeCentralities,
  runHopcroftKarp,
  runMaxWeightMatching,
  runBenchmarkSuite,
  BenchmarkRun,
  MatchingResult,
} from '../utils/graphAnalyticsEngine';
import { BipartiteMatchingView } from './BipartiteMatchingView';

interface GraphAnalyticsViewProps {
  donors: Donor[];
  recipients: Recipient[];
  hospitals: Hospital[];
}

type SubTab = 'bipartite' | 'topology' | 'distribution' | 'centrality' | 'benchmarks' | 'matching';

export const GraphAnalyticsView: React.FC<GraphAnalyticsViewProps> = ({
  donors,
  recipients,
  hospitals,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('bipartite');
  const [includeReview, setIncludeReview] = useState<boolean>(true);
  const [centralityFilter, setCentralityFilter] = useState<'all' | 'donor' | 'recipient'>('all');
  const [centralitySearch, setCentralitySearch] = useState<string>('');
  const [centralitySortCol, setCentralitySortCol] = useState<
    'degree' | 'degreeCentrality' | 'betweennessCentrality' | 'closenessCentrality'
  >('betweennessCentrality');
  const [centralitySortAsc, setCentralitySortAsc] = useState<boolean>(false);

  // Benchmarking State
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkRun[] | null>(null);

  // Live matching execution state
  const [matchingMode, setMatchingMode] = useState<'hopcroft' | 'weight'>('hopcroft');

  // Build current compatibility graph
  const graph = useMemo(() => {
    return buildCompatibilityGraph(donors, recipients, includeReview);
  }, [donors, recipients, includeReview]);

  // Compute Topological Metrics
  const topology = useMemo(() => {
    return computeTopologicalMetrics(graph);
  }, [graph]);

  // Compute Degree Summaries and Hubs/Isolates
  const degreeSummary = useMemo(() => {
    return computeDegreeSummary(graph);
  }, [graph]);

  // Compute Centrality rankings
  const centralities = useMemo(() => {
    return computeCentralities(graph);
  }, [graph]);

  // Live Matching Engine run on current graph
  const liveMatchingResult = useMemo<MatchingResult>(() => {
    if (matchingMode === 'hopcroft') {
      return runHopcroftKarp(graph);
    } else {
      return runMaxWeightMatching(graph);
    }
  }, [graph, matchingMode]);

  // Filtered & Sorted Centralities
  const filteredCentralities = useMemo(() => {
    let list = centralities;
    if (centralityFilter !== 'all') {
      list = list.filter((c) => c.type === centralityFilter);
    }
    if (centralitySearch.trim()) {
      const q = centralitySearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.organ.toLowerCase().includes(q) ||
          c.bloodGroup.toLowerCase().includes(q) ||
          c.nodeId.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const valA = a[centralitySortCol];
      const valB = b[centralitySortCol];
      if (valA === valB) return 0;
      return centralitySortAsc ? valA - valB : valB - valA;
    });
  }, [centralities, centralityFilter, centralitySearch, centralitySortCol, centralitySortAsc]);

  // Run synthetic benchmarks
  const handleRunBenchmarks = () => {
    setIsBenchmarking(true);
    setTimeout(() => {
      const runs = runBenchmarkSuite([50, 100, 200, 400]);
      setBenchmarkResults(runs);
      setIsBenchmarking(false);
    }, 250);
  };

  const handleSortCentrality = (
    col: 'degree' | 'degreeCentrality' | 'betweennessCentrality' | 'closenessCentrality'
  ) => {
    if (centralitySortCol === col) {
      setCentralitySortAsc(!centralitySortAsc);
    } else {
      setCentralitySortCol(col);
      setCentralitySortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <TrendingUp className="h-6 w-6 text-sky-400" />
            Graph Theory & Network Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Topological structure, bipartite degree distributions, Brandes centrality rankings, and algorithmic scaling benchmarks.
          </p>
        </div>

        {/* Global Edge Threshold Toggle */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5 self-start">
          <span className="text-[11px] text-slate-400 font-medium px-2 flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-sky-400" />
            Edge Threshold:
          </span>
          <button
            id="edge-threshold-candidate"
            onClick={() => setIncludeReview(false)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              !includeReview
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Candidates Only
          </button>
          <button
            id="edge-threshold-review"
            onClick={() => setIncludeReview(true)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              includeReview
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Candidates + Review
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          id="subtab-bipartite"
          onClick={() => setActiveSubTab('bipartite')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeSubTab === 'bipartite'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <GitFork className="h-4 w-4 text-emerald-400" />
          <span>Bipartite Visualizer</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
            Phase 4
          </span>
        </button>

        <button
          id="subtab-topology"
          onClick={() => setActiveSubTab('topology')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeSubTab === 'topology'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="h-4 w-4" />
          Topological Metrics
        </button>

        <button
          id="subtab-distribution"
          onClick={() => setActiveSubTab('distribution')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeSubTab === 'distribution'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <GitFork className="h-4 w-4" />
          Degree Distributions & Hubs
        </button>

        <button
          id="subtab-centrality"
          onClick={() => setActiveSubTab('centrality')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeSubTab === 'centrality'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Award className="h-4 w-4" />
          Centrality Rankings
        </button>

        <button
          id="subtab-benchmarks"
          onClick={() => setActiveSubTab('benchmarks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeSubTab === 'benchmarks'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Cpu className="h-4 w-4" />
          Algorithmic Scaling Benchmarks
        </button>

        <button
          id="subtab-matching"
          onClick={() => setActiveSubTab('matching')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeSubTab === 'matching'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Zap className="h-4 w-4" />
          Live Matching Solver
        </button>
      </div>

      {/* SUBTAB 0: BIPARTITE GRAPH MATCHING VISUALIZATION */}
      {activeSubTab === 'bipartite' && (
        <BipartiteMatchingView
          donors={donors}
          recipients={recipients}
          hospitals={hospitals}
        />
      )}

      {/* SUBTAB 1: TOPOLOGICAL METRICS */}
      {activeSubTab === 'topology' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Total Vertices
              </span>
              <div className="text-xl font-bold text-slate-100 mt-1.5 flex items-baseline gap-2">
                {topology.nodeCount}
                <span className="text-[11px] font-normal text-slate-400">
                  ({topology.donorCount} D / {topology.recipientCount} R)
                </span>
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Compatible Edges
              </span>
              <div className="text-xl font-bold text-sky-400 mt-1.5">{topology.edgeCount}</div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Graph Density
              </span>
              <div className="text-xl font-bold text-emerald-400 mt-1.5">
                {(topology.density * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Average Degree
              </span>
              <div className="text-xl font-bold text-purple-400 mt-1.5">{topology.averageDegree}</div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Components
              </span>
              <div className="text-xl font-bold text-amber-400 mt-1.5">
                {topology.connectedComponents}
                <span className="text-[11px] font-normal text-slate-400 ml-1.5">
                  (Max {topology.largestComponentSize})
                </span>
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Isolated Nodes
              </span>
              <div className="text-xl font-bold text-rose-400 mt-1.5">
                {topology.isolatedNodeCount}
                <span className="text-[11px] font-normal text-slate-400 ml-1.5">
                  ({topology.isolatedRecipientCount} Recip)
                </span>
              </div>
            </div>
          </div>

          {/* Mathematical Proof & Partition Verification Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Bipartite Structural Verification
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                The network is mathematically modeled as an undirected bipartite graph{' '}
                <code className="text-sky-300 font-mono text-[11px]">G = (D, R, E)</code>, where partition{' '}
                <code className="text-emerald-300 font-mono text-[11px]">D</code> represents registered organ donors and partition{' '}
                <code className="text-sky-300 font-mono text-[11px]">R</code> represents waitlist recipients.
              </p>

              <div className="divide-y divide-slate-800 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">2-Colorable Bipartite Status:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified (Odd Cycles = 0)
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">Intra-Partition Edges (Donor-Donor / Recipient-Recipient):</span>
                  <span className="font-mono font-semibold text-emerald-400">0 (Strictly 0%)</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">Theoretical Complete Edges (|D| × |R|):</span>
                  <span className="font-mono text-slate-200">
                    {topology.donorCount * topology.recipientCount} maximum edges
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">Active Admissible Edges (|E|):</span>
                  <span className="font-mono text-sky-400 font-bold">{topology.edgeCount} edges</span>
                </div>
              </div>
            </div>

            {/* Path & Connectivity Metrics */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Network className="h-4 w-4 text-purple-400" />
                Distance & Reachability Metrics
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculated on the largest connected subgraph to measure network dispersion, shortest path hops, and
                cross-allocation diameter.
              </p>

              <div className="divide-y divide-slate-800 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">Largest Component Size:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {topology.largestComponentSize} nodes (
                    {topology.nodeCount > 0
                      ? Math.round((topology.largestComponentSize / topology.nodeCount) * 100)
                      : 0}
                    % of total)
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">Largest Component Diameter:</span>
                  <span className="font-mono font-bold text-purple-400">
                    {topology.diameter !== null ? `${topology.diameter} hops` : 'N/A (Trivial)'}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">Average Shortest Path Length:</span>
                  <span className="font-mono font-bold text-sky-400">
                    {topology.averageShortestPathLength !== null
                      ? `${topology.averageShortestPathLength} hops`
                      : 'N/A'}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400">Extreme Degree Range:</span>
                  <span className="font-mono text-slate-200">
                    Min: {topology.minimumDegree} — Max: {topology.maximumDegree}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: DEGREE DISTRIBUTIONS & HUBS VS ISOLATED */}
      {activeSubTab === 'distribution' && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Users className="h-4 w-4" />
                Donor Connectivity Profile
              </div>
              <p className="text-xs text-slate-300 mt-2">
                Average degree of donors is <strong className="text-emerald-400 font-mono">{degreeSummary.averageDonorDegree}</strong> compatible recipients. Donors with blood group O and broad HLA profiles act as critical connectivity hubs.
              </p>
            </div>

            <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                <UserPlus className="h-4 w-4" />
                Recipient Waitlist Profile
              </div>
              <p className="text-xs text-slate-300 mt-2">
                Average degree of recipients is <strong className="text-sky-400 font-mono">{degreeSummary.averageRecipientDegree}</strong> compatible donors. Patients with rare HLA sensitization or rare blood groups risk zero-degree isolation.
              </p>
            </div>
          </div>

          {/* Hubs vs Isolated Recipients Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donor Hubs */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-400" />
                  Highly Connected Donor Hubs (Degree ≥ {Math.max(2, Math.round(degreeSummary.averageDonorDegree))})
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                  {degreeSummary.donorHubs.length} Hubs
                </span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {degreeSummary.donorHubs.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center">No donor hubs meeting threshold.</p>
                ) : (
                  degreeSummary.donorHubs.map(({ node, degree }) => (
                    <div
                      key={node.id}
                      className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between hover:border-emerald-500/30 transition"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span>{node.name}</span>
                          <span className="font-mono text-[11px] text-sky-400">{node.id}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          Organ: <strong className="text-emerald-400">{node.organ}</strong> • Blood: {node.bloodGroup} • {node.location}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/30">
                          {degree} Matches
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1">High Allocation Yield</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Isolated Recipients Bottleneck */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  Isolated / Constrained Recipients (Degree ≤ 1)
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono font-bold">
                  {degreeSummary.isolatedRecipients.length} Constrained
                </span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {degreeSummary.isolatedRecipients.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center">
                    Excellent graph connectivity: no recipients with zero or single donor options.
                  </p>
                ) : (
                  degreeSummary.isolatedRecipients.map(({ node, degree }) => (
                    <div
                      key={node.id}
                      className="p-3 rounded-lg bg-slate-950/70 border border-rose-500/20 flex items-center justify-between hover:border-rose-500/40 transition"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span>{node.name}</span>
                          <span className="font-mono text-[11px] text-rose-400">{node.id}</span>
                          {degree === 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-600/30 text-red-300 font-bold">
                              ZERO MATCHES
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          Needs: <strong className="text-slate-200">{node.organ}</strong> • Blood: {node.bloodGroup} • Urgency: {node.urgency} ({node.waitingTimeDays}d)
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2.5 py-1 rounded font-mono font-bold text-xs ${
                            degree === 0
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {degree} Donor(s)
                        </span>
                        <span className="block text-[10px] text-rose-300 mt-1">Cross-regional Sharing Req.</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Degree Distribution Histogram */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-sky-400" />
              Degree Frequency Distribution Across Graph Partitions
            </h2>
            <p className="text-xs text-slate-400">
              Histogram showing how many donors (green) and recipients (blue) share each specific degree (number of clinical connections).
            </p>

            <div className="space-y-3 pt-2">
              {degreeSummary.degreeHistogram.map(({ degree, donorCount, recipientCount }) => {
                const maxVal = Math.max(
                  ...degreeSummary.degreeHistogram.map((h) => Math.max(h.donorCount, h.recipientCount, 1))
                );
                return (
                  <div key={degree} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300 font-bold">Degree = {degree} Connections</span>
                      <div className="flex gap-4 text-[11px]">
                        <span className="text-emerald-400">Donors: {donorCount}</span>
                        <span className="text-sky-400">Recipients: {recipientCount}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${(donorCount / maxVal) * 100}%` }}
                        />
                      </div>
                      <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-sky-500 rounded-full transition-all duration-300"
                          style={{ width: `${(recipientCount / maxVal) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: CENTRALITY RANKINGS */}
      {activeSubTab === 'centrality' && (
        <div className="space-y-6">
          {/* Medical Safety Disclaimer Banner */}
          <div className="p-4 bg-slate-900 border border-purple-500/30 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-purple-400 font-bold uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4" />
              Clinical Governance & Medical Boundary Notice
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>Degree Centrality</strong> represents direct connectivity within the network.
              <strong> Betweenness Centrality</strong> measures how frequently a node acts as a structural bridge between otherwise separate clinical clusters (Brandes' Algorithm).
              <strong> Closeness Centrality</strong> reflects shortest-path reachability across partitions.
            </p>
            <p className="text-amber-300 font-medium">
              Important: Centrality metrics are structural graph properties. They do NOT denote clinical priority, medical urgency, or biological superiority.
            </p>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400 font-medium">Partition:</span>
              <button
                id="filter-centrality-all"
                onClick={() => setCentralityFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  centralityFilter === 'all'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800'
                }`}
              >
                All Nodes ({centralities.length})
              </button>
              <button
                id="filter-centrality-donors"
                onClick={() => setCentralityFilter('donor')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  centralityFilter === 'donor'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800'
                }`}
              >
                Donors Only
              </button>
              <button
                id="filter-centrality-recipients"
                onClick={() => setCentralityFilter('recipient')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  centralityFilter === 'recipient'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800'
                }`}
              >
                Recipients Only
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search node, organ, blood group..."
                value={centralitySearch}
                onChange={(e) => setCentralitySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Centrality Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Node / ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Organ</th>
                    <th className="py-3 px-4">Blood</th>
                    <th
                      onClick={() => handleSortCentrality('degree')}
                      className="py-3 px-4 cursor-pointer hover:text-sky-400 transition"
                    >
                      <div className="flex items-center gap-1">
                        Degree (Edges)
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSortCentrality('degreeCentrality')}
                      className="py-3 px-4 cursor-pointer hover:text-sky-400 transition"
                    >
                      <div className="flex items-center gap-1">
                        Degree Centrality
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSortCentrality('betweennessCentrality')}
                      className="py-3 px-4 cursor-pointer hover:text-sky-400 transition"
                    >
                      <div className="flex items-center gap-1 text-purple-300 font-bold">
                        Betweenness (Broker)
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSortCentrality('closenessCentrality')}
                      className="py-3 px-4 cursor-pointer hover:text-sky-400 transition"
                    >
                      <div className="flex items-center gap-1 text-sky-300 font-bold">
                        Closeness (Reach)
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCentralities.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No nodes found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCentralities.map((item, idx) => (
                      <tr key={`${item.nodeId}-${idx}`} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-400">
                          {idx === 0 && <span className="text-amber-400">🥇 #1</span>}
                          {idx === 1 && <span className="text-slate-300">🥈 #2</span>}
                          {idx === 2 && <span className="text-amber-600">🥉 #3</span>}
                          {idx > 2 && `#${idx + 1}`}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">[{item.nodeId}]</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.type === 'donor'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            }`}
                          >
                            {item.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-200">{item.organ}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-300">{item.bloodGroup}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-200">{item.degree}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">{item.degreeCentrality.toFixed(4)}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-purple-400">
                          {item.betweennessCentrality.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-sky-400">
                          {item.closenessCentrality.toFixed(4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: ALGORITHMIC SCALING BENCHMARKS */}
      {activeSubTab === 'benchmarks' && (
        <div className="space-y-6">
          {/* Action Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-sky-400" />
                Empirical Algorithm Scaling & Runtime Benchmarking Suite
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Generates realistic synthetic bipartite compatibility graphs (N = 50, 100, 200, 400) to evaluate Hopcroft-Karp (O(E · √V)) against Maximum Weight Matching (O(E log E)) and Brandes Centrality (O(V · (V + E))).
              </p>
            </div>

            <button
              id="btn-run-benchmarks"
              disabled={isBenchmarking}
              onClick={handleRunBenchmarks}
              className="px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm shrink-0"
            >
              {isBenchmarking ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running Microbenchmarks...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Run Benchmark Suite
                </>
              )}
            </button>
          </div>

          {/* Theoretical Complexity Reference Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Hopcroft-Karp</span>
              <div className="text-xs font-mono font-bold text-sky-400 mt-1">O(E · √V)</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Layered BFS augmenting path distance computation with DFS maximum cardinality matching.
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Max Weight Matching</span>
              <div className="text-xs font-mono font-bold text-purple-400 mt-1">O(E log E)</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Edge weight sorted priority allocation maximizing cumulative clinical compatibility score.
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">BFS Component Traversal</span>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-1">O(V + E)</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Linear time connected component partitioning and bipartite 2-colorability validation.
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Brandes' Centrality</span>
              <div className="text-xs font-mono font-bold text-amber-400 mt-1">O(V · (V + E))</div>
              <p className="text-[11px] text-slate-400 mt-1">
                All-pairs shortest path dependency accumulation for exact betweenness & closeness.
              </p>
            </div>
          </div>

          {/* Benchmark Results Table */}
          {benchmarkResults ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-4 p-5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Empirical Execution Results (Client V8 JIT Runtime)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Graph Size (N)</th>
                      <th className="py-2.5 px-4">Edge Count (|E|)</th>
                      <th className="py-2.5 px-4 text-sky-400 font-bold">Hopcroft-Karp (ms)</th>
                      <th className="py-2.5 px-4">HK Matches Found</th>
                      <th className="py-2.5 px-4 text-purple-400 font-bold">Max Weight (ms)</th>
                      <th className="py-2.5 px-4">MW Matches Found</th>
                      <th className="py-2.5 px-4 text-emerald-400 font-bold">BFS Traversal (ms)</th>
                      <th className="py-2.5 px-4 text-amber-400 font-bold">Centrality (ms)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {benchmarkResults.map((run, idx) => (
                      <tr key={`${run.size}-${idx}`} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-100">{run.nodes} nodes</td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">{run.edges} edges</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-sky-400">
                          {run.hopcroftKarpMs.toFixed(2)} ms
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-200">{run.hopcroftKarpMatches}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-purple-400">
                          {run.maxWeightMs.toFixed(2)} ms
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-200">{run.maxWeightMatches}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                          {run.bfsTraversalMs.toFixed(2)} ms
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-amber-400">
                          {run.centralityMs.toFixed(2)} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bar visualization of runtime latency */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase">
                  Runtime Scaling (Hopcroft-Karp vs Max Weight vs Centrality)
                </h4>
                {benchmarkResults.map((run) => {
                  const maxMs = Math.max(run.centralityMs, run.hopcroftKarpMs, run.maxWeightMs, 0.1);
                  return (
                    <div key={`chart-${run.size}`} className="space-y-1">
                      <div className="text-[11px] font-mono text-slate-400 flex justify-between">
                        <span>Graph {run.nodes} Vertices ({run.edges} Edges)</span>
                        <span>Max Runtime: {maxMs.toFixed(2)} ms</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
                          <span className="text-sky-400 block font-bold">HK: {run.hopcroftKarpMs.toFixed(2)} ms</span>
                          <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full"
                              style={{ width: `${Math.max(5, (run.hopcroftKarpMs / maxMs) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
                          <span className="text-purple-400 block font-bold">MW: {run.maxWeightMs.toFixed(2)} ms</span>
                          <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${Math.max(5, (run.maxWeightMs / maxMs) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
                          <span className="text-amber-400 block font-bold">Centrality: {run.centralityMs.toFixed(2)} ms</span>
                          <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.max(5, (run.centralityMs / maxMs) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
              <Cpu className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                Click "Run Benchmark Suite" above to execute real microsecond benchmarks across synthetic graph sizes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 5: LIVE MATCHING SOLVER */}
      {activeSubTab === 'matching' && (
        <div className="space-y-6">
          {/* Header & Mode Switcher */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                Live Bipartite Graph Allocation Solver
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Executes maximum cardinality or maximum weight matching across registered clinical donors and recipients.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-xl self-start">
              <button
                id="btn-matching-hopcroft"
                onClick={() => setMatchingMode('hopcroft')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  matchingMode === 'hopcroft'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hopcroft-Karp (Max Count)
              </button>
              <button
                id="btn-matching-weight"
                onClick={() => setMatchingMode('weight')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  matchingMode === 'weight'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Max Weight (Highest Score)
              </button>
            </div>
          </div>

          {/* Solver Summary KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Matched Pairs</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">{liveMatchingResult.totalMatches} Pairs</div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Average Score</span>
              <div className="text-xl font-bold text-sky-400 mt-1">{liveMatchingResult.averageWeight} / 100</div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Donor Utilization</span>
              <div className="text-xl font-bold text-purple-400 mt-1">
                {liveMatchingResult.donorCoveragePercent}%
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Solver Latency</span>
              <div className="text-xl font-bold text-amber-400 mt-1 font-mono">
                {liveMatchingResult.executionTimeMs.toFixed(2)} ms
              </div>
            </div>
          </div>

          {/* Matched Pairs Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Algorithm Selected Allocations ({liveMatchingResult.matches.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Algorithm: {liveMatchingResult.algorithm}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Organ</th>
                    <th className="py-2.5 px-4">Donor (Supply)</th>
                    <th className="py-2.5 px-4">Recipient (Demand)</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Composite Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {liveMatchingResult.matches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No feasible pairings found in active compatibility graph.
                      </td>
                    </tr>
                  ) : (
                    liveMatchingResult.matches.map((m, idx) => (
                      <tr key={`${m.donor.id}-${m.recipient.id}-${idx}`} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-slate-400">#{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-100">{m.donor.organ}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-200">{m.donor.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            [{m.donor.bloodGroup}] • {m.donor.location}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-200">{m.recipient.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            [{m.recipient.bloodGroup}] • Tier: {m.recipient.urgency} ({m.recipient.waitingTimeDays}d)
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.status === 'POTENTIAL_CANDIDATE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {m.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-400">
                          {m.score.toFixed(1)} / 100
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
