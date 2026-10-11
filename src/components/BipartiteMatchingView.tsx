import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  GitFork,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Download,
  Filter,
  Search,
  Zap,
  Award,
  Layers,
  Info,
  Maximize2,
  Minimize2,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Move,
  Hand,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Donor, Hospital, Recipient } from '../types';
import {
  BipartiteEdge,
  BipartiteGraph,
  BipartiteNode,
  MatchingResult,
  buildCompatibilityGraph,
  generateMatchingCsv,
  runHopcroftKarp,
  runMaxWeightMatching,
  runMultiObjectiveMatching,
} from '../utils/graphAnalyticsEngine';

interface BipartiteMatchingViewProps {
  donors: Donor[];
  recipients: Recipient[];
  hospitals: Hospital[];
}

type AlgorithmType = 'cardinality' | 'weight' | 'multi-objective';
type ViewMode = 'all-candidates' | 'selected-matches' | 'candidates-and-selected';

export const BipartiteMatchingView: React.FC<BipartiteMatchingViewProps> = ({
  donors,
  recipients,
  hospitals,
}) => {
  // Algorithm selection
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>('weight');

  // Visualization mode (Mode C is default as requested)
  const [viewMode, setViewMode] = useState<ViewMode>('candidates-and-selected');

  // Edge labels toggle (compatibility score on edges)
  const [showEdgeLabels, setShowEdgeLabels] = useState<boolean>(true);

  // Academic Mode toggle
  const [showAcademicMode, setShowAcademicMode] = useState<boolean>(false);

  // Filter States
  const [selectedOrgan, setSelectedOrgan] = useState<string>('all');
  const [selectedOrganSize, setSelectedOrganSize] = useState<string>('all');
  const [selectedDonorBlood, setSelectedDonorBlood] = useState<string>('all');
  const [selectedRecipientBlood, setSelectedRecipientBlood] = useState<string>('all');
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [availableOnly, setAvailableOnly] = useState<boolean>(true);
  const [includeReview, setIncludeReview] = useState<boolean>(true);

  // Interactive inspection states
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<BipartiteNode | null>(null);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [selectedEdgeDetails, setSelectedEdgeDetails] = useState<{
    edge: BipartiteEdge;
    donor: BipartiteNode;
    recipient: BipartiteNode;
    isSelectedMatch: boolean;
    algorithmName: string;
    rank?: number;
  } | null>(null);

  // Search filter for highlighting nodes
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Zoom & Pan state for interactive canvas
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 20 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef<boolean>(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const isTouchDraggingRef = useRef<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number; dist?: number }>({ x: 0, y: 0 });

  // Check if any filters are currently active (determining full vs filtered scope)
  const isFiltered = useMemo(() => {
    return (
      selectedOrgan !== 'all' ||
      selectedOrganSize !== 'all' ||
      selectedDonorBlood !== 'all' ||
      selectedRecipientBlood !== 'all' ||
      selectedHospitalId !== 'all' ||
      minScore > 0 ||
      selectedUrgency !== 'all' ||
      !availableOnly ||
      !includeReview
    );
  }, [
    selectedOrgan,
    selectedOrganSize,
    selectedDonorBlood,
    selectedRecipientBlood,
    selectedHospitalId,
    minScore,
    selectedUrgency,
    availableOnly,
    includeReview,
  ]);

  // Filter donors & recipients according to active filters
  const filteredDonors = useMemo(() => {
    return donors.filter((d) => {
      if (availableOnly && d.availability !== 'Available') return false;
      if (selectedOrgan !== 'all' && d.organ.toLowerCase() !== selectedOrgan.toLowerCase()) return false;
      if (selectedOrganSize !== 'all' && d.organSize !== selectedOrganSize) return false;
      if (selectedDonorBlood !== 'all' && d.bloodGroup !== selectedDonorBlood) return false;
      if (selectedHospitalId !== 'all' && String(d.hospitalId) !== selectedHospitalId) return false;
      return true;
    });
  }, [donors, availableOnly, selectedOrgan, selectedOrganSize, selectedDonorBlood, selectedHospitalId]);

  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      if (selectedOrgan !== 'all' && r.organNeeded.toLowerCase() !== selectedOrgan.toLowerCase()) return false;
      if (selectedOrganSize !== 'all' && r.organSize !== selectedOrganSize) return false;
      if (selectedRecipientBlood !== 'all' && r.bloodGroup !== selectedRecipientBlood) return false;
      if (selectedHospitalId !== 'all' && String(r.hospitalId) !== selectedHospitalId) return false;
      if (selectedUrgency !== 'all' && r.urgency !== selectedUrgency) return false;
      return true;
    });
  }, [recipients, selectedOrgan, selectedOrganSize, selectedRecipientBlood, selectedHospitalId, selectedUrgency]);

  // Build the active bipartite graph using Phase 3 compatibility logic
  const activeGraph = useMemo<BipartiteGraph>(() => {
    const rawGraph = buildCompatibilityGraph(filteredDonors, filteredRecipients, includeReview);

    // Further prune edges by minScore if filter applied
    if (minScore > 0) {
      const filteredEdges = rawGraph.edges.filter((e) => e.weight >= minScore);
      const newAdj = new Map<string, Array<{ neighborId: string; weight: number; edge: BipartiteEdge }>>();
      rawGraph.nodes.forEach((n) => newAdj.set(n.id, []));

      filteredEdges.forEach((e) => {
        newAdj.get(e.donorId)?.push({ neighborId: e.recipientId, weight: e.weight, edge: e });
        newAdj.get(e.recipientId)?.push({ neighborId: e.donorId, weight: e.weight, edge: e });
      });

      return {
        ...rawGraph,
        edges: filteredEdges,
        adj: newAdj,
      };
    }

    return rawGraph;
  }, [filteredDonors, filteredRecipients, includeReview, minScore]);

  // Full network graph for comparative reference
  const fullNetworkGraph = useMemo<BipartiteGraph>(() => {
    return buildCompatibilityGraph(donors, recipients, true);
  }, [donors, recipients]);

  // Run all 3 matching algorithms dynamically across the active graph for comparison
  const cardinalityResult = useMemo<MatchingResult>(() => {
    return runHopcroftKarp(activeGraph);
  }, [activeGraph]);

  const weightResult = useMemo<MatchingResult>(() => {
    return runMaxWeightMatching(activeGraph);
  }, [activeGraph]);

  const multiObjectiveResult = useMemo<MatchingResult>(() => {
    return runMultiObjectiveMatching(activeGraph);
  }, [activeGraph]);

  // Currently active algorithm result
  const activeMatchingResult = useMemo<MatchingResult>(() => {
    switch (selectedAlgorithm) {
      case 'cardinality':
        return cardinalityResult;
      case 'weight':
        return weightResult;
      case 'multi-objective':
        return multiObjectiveResult;
    }
  }, [selectedAlgorithm, cardinalityResult, weightResult, multiObjectiveResult]);

  // Map of selected match pairs: "donorId-recipientId" -> MatchObject
  const selectedMatchMap = useMemo(() => {
    const map = new Map<string, (typeof activeMatchingResult.matches)[0]>();
    for (const match of activeMatchingResult.matches) {
      map.set(`${match.donor.id}-${match.recipient.id}`, match);
    }
    return map;
  }, [activeMatchingResult]);

  // Quick lookup for node matched counterpart
  const matchedDonorLookup = useMemo(() => {
    const map = new Map<string, BipartiteNode>();
    for (const m of activeMatchingResult.matches) {
      map.set(m.donor.id, m.recipient);
    }
    return map;
  }, [activeMatchingResult]);

  const matchedRecipientLookup = useMemo(() => {
    const map = new Map<string, BipartiteNode>();
    for (const m of activeMatchingResult.matches) {
      map.set(m.recipient.id, m.donor);
    }
    return map;
  }, [activeMatchingResult]);

  // Coverage & Density calculations
  const eligibleDonorsCount = activeGraph.donors.length;
  const eligibleRecipientsCount = activeGraph.recipients.length;
  const candidateEdgesCount = activeGraph.edges.length;
  const selectedMatchesCount = activeMatchingResult.matches.length;
  const unmatchedDonorsCount = activeMatchingResult.unmatchedDonors.length;
  const unmatchedRecipientsCount = activeMatchingResult.unmatchedRecipients.length;

  const donorMatchingCoverage =
    eligibleDonorsCount > 0
      ? Number(((selectedMatchesCount / eligibleDonorsCount) * 100).toFixed(1))
      : 0;

  const recipientMatchingCoverage =
    eligibleRecipientsCount > 0
      ? Number(((selectedMatchesCount / eligibleRecipientsCount) * 100).toFixed(1))
      : 0;

  const matchingCapacity = Math.min(eligibleDonorsCount, eligibleRecipientsCount);
  const networkMatchingCoverage =
    matchingCapacity > 0
      ? Number(((selectedMatchesCount / matchingCapacity) * 100).toFixed(1))
      : 0;

  const bipartiteGraphDensity =
    eligibleDonorsCount > 0 && eligibleRecipientsCount > 0
      ? Number(((candidateEdgesCount / (eligibleDonorsCount * eligibleRecipientsCount)) * 100).toFixed(1))
      : 0;

  // Layout positions for Bipartite SVG rendering
  const nodeHeight = 52;
  const topPadding = 60;
  const bottomPadding = 40;
  const maxEntities = Math.max(eligibleDonorsCount, eligibleRecipientsCount, 1);
  const svgHeight = Math.max(480, maxEntities * nodeHeight + topPadding + bottomPadding);
  const svgWidth = 800;
  const donorColX = 140;
  const recipientColX = 660;

  // Calculate coordinates for donor and recipient nodes
  const donorCoords = useMemo(() => {
    const coords = new Map<string, { x: number; y: number }>();
    activeGraph.donors.forEach((d, idx) => {
      // Space evenly across available height
      const step = (svgHeight - topPadding - bottomPadding) / Math.max(eligibleDonorsCount, 1);
      const y = topPadding + idx * step + step / 2;
      coords.set(d.id, { x: donorColX, y });
    });
    return coords;
  }, [activeGraph.donors, eligibleDonorsCount, svgHeight, donorColX]);

  const recipientCoords = useMemo(() => {
    const coords = new Map<string, { x: number; y: number }>();
    activeGraph.recipients.forEach((r, idx) => {
      const step = (svgHeight - topPadding - bottomPadding) / Math.max(eligibleRecipientsCount, 1);
      const y = topPadding + idx * step + step / 2;
      coords.set(r.id, { x: recipientColX, y });
    });
    return coords;
  }, [activeGraph.recipients, eligibleRecipientsCount, svgHeight, recipientColX]);

  // Quick lookup of nodes by ID
  const nodeMap = useMemo(() => {
    const map = new Map<string, BipartiteNode>();
    activeGraph.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [activeGraph.nodes]);

  // Highlighted set based on hovered node
  const activeHighlightedEdges = useMemo(() => {
    if (!hoveredNodeId) return null;
    const set = new Set<string>();
    const neighbors = activeGraph.adj.get(hoveredNodeId) || [];
    for (const item of neighbors) {
      if (hoveredNodeId.startsWith('D')) {
        set.add(`${hoveredNodeId}-${item.neighborId}`);
      } else {
        set.add(`${item.neighborId}-${hoveredNodeId}`);
      }
    }
    return set;
  }, [hoveredNodeId, activeGraph.adj]);

  // Export CSV handler
  const handleExportCSV = () => {
    const csvContent = generateMatchingCsv(activeMatchingResult, {
      organ: selectedOrgan !== 'all' ? selectedOrgan : undefined,
      donorBlood: selectedDonorBlood !== 'all' ? selectedDonorBlood : undefined,
      recipientBlood: selectedRecipientBlood !== 'all' ? selectedRecipientBlood : undefined,
      hospital: selectedHospitalId !== 'all' ? selectedHospitalId : undefined,
      minScore: minScore > 0 ? minScore : undefined,
      urgency: selectedUrgency !== 'all' ? selectedUrgency : undefined,
      includeReview,
      isFiltered,
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `matching_results_${selectedAlgorithm}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Zoom In / Zoom Out / Reset / Fit handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(0.25, Number((z - 0.15).toFixed(2))));
  }, []);

  const handleResetZoomAndPan = useCallback(() => {
    setZoomLevel(1);
    if (svgContainerRef.current) {
      const cw = svgContainerRef.current.clientWidth;
      const initialX = Math.max(10, (cw - svgWidth) / 2);
      setPanOffset({ x: initialX, y: 20 });
    } else {
      setPanOffset({ x: 0, y: 20 });
    }
  }, [svgWidth]);

  const handleFitToView = useCallback(() => {
    if (!svgContainerRef.current) return;
    const cw = svgContainerRef.current.clientWidth || 900;
    const ch = 640;
    const scaleX = (cw - 40) / svgWidth;
    const scaleY = (ch - 40) / svgHeight;
    const fitScale = Math.max(0.25, Math.min(1.2, Math.min(scaleX, scaleY)));
    setZoomLevel(Number(fitScale.toFixed(2)));
    const fittedWidth = svgWidth * fitScale;
    const fittedHeight = svgHeight * fitScale;
    setPanOffset({
      x: Math.max(10, (cw - fittedWidth) / 2),
      y: Math.max(10, (ch - fittedHeight) / 2),
    });
  }, [svgWidth, svgHeight]);

  const handlePanNudge = useCallback((dx: number, dy: number) => {
    setPanOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  // Initial horizontal centering of canvas
  useEffect(() => {
    if (svgContainerRef.current) {
      const cw = svgContainerRef.current.clientWidth;
      if (cw > 0) {
        const initialX = Math.max(10, (cw - svgWidth) / 2);
        setPanOffset({ x: initialX, y: 20 });
      }
    }
  }, [svgWidth]);

  // Non-passive wheel event listener for smooth cursor-focused zooming
  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;

      setZoomLevel((prevZoom) => {
        const nextZoom = Math.min(3.0, Math.max(0.25, Number((prevZoom * zoomFactor).toFixed(2))));
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setPanOffset((prevPan) => {
          const ratio = nextZoom / prevZoom;
          return {
            x: cursorX - (cursorX - prevPan.x) * ratio,
            y: cursorY - (cursorY - prevPan.y) * ratio,
          };
        });

        return nextZoom;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Mouse pan event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...panOffset };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasDraggedRef.current = true;
    }
    setPanOffset({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile/tablet drag and pinch
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      isTouchDraggingRef.current = true;
      hasDraggedRef.current = false;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      initialPanRef.current = { ...panOffset };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        dist: Math.hypot(dx, dy),
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isTouchDraggingRef.current) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasDraggedRef.current = true;
      }
      setPanOffset({
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && touchStartRef.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchStartRef.current.dist;
      setZoomLevel((z) => Math.min(3.0, Math.max(0.25, Number((z * ratio).toFixed(2)))));
      touchStartRef.current.dist = dist;
    }
  };

  const handleTouchEnd = () => {
    isTouchDraggingRef.current = false;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900/80 p-5 rounded-xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sky-400">
              <GitFork className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Bipartite Matching Visualizer
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/20">
                  Phase 4 Add-On
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Two-sided bipartite compatibility network mapping algorithmic allocations between eligible donors and waitlist candidates.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scope Indicator */}
          <div
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
              isFiltered
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isFiltered ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span>
              {isFiltered ? 'Filtered Network' : 'Full Network'}
            </span>
          </div>

          {/* Academic Mode Toggle */}
          <button
            id="btn-academic-mode"
            onClick={() => setShowAcademicMode(!showAcademicMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              showAcademicMode
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-purple-400" />
            Academic Mode
          </button>

          {/* CSV Export Button */}
          <button
            id="btn-export-matching-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Academic Mode Explanatory Panel */}
      {showAcademicMode && (
        <div className="bg-slate-950 p-5 rounded-xl border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-400" />
              Bipartite Matching Formal Mathematical Foundations
            </h3>
            <span className="text-[10px] text-purple-400/80 font-mono">Graph Formulation G = (D ∪ R, E)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-semibold text-purple-400 block font-mono">1. Graph Definition</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Let <code className="text-purple-300 font-mono">G = (D ∪ R, E)</code> be an undirected bipartite graph where <code className="text-sky-300 font-mono">D</code> is the set of donor vertices, <code className="text-emerald-300 font-mono">R</code> is the set of recipient vertices, and <code className="text-slate-200 font-mono">E ⊆ D × R</code> denotes candidate relationships.
              </p>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-semibold text-purple-400 block font-mono">2. Matching Conditions</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                A matching <code className="text-purple-300 font-mono">M ⊆ E</code> is an independent edge set where no two edges share a common vertex (one-to-one allocation):
                <br />
                <code className="text-amber-300 font-mono text-[10px]">∀ e₁, e₂ ∈ M, e₁ ∩ e₂ = ∅</code>
              </p>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-semibold text-purple-400 block font-mono">3. Optimization Objectives</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <strong>Maximum Cardinality:</strong> <code className="text-sky-300 font-mono">max |M|</code> via Hopcroft-Karp algorithm.
                <br />
                <strong>Maximum Weight:</strong> <code className="text-emerald-300 font-mono">max ∑ w(e)</code> maximizing total algorithmic compatibility score.
              </p>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 bg-purple-950/20 p-2.5 rounded border border-purple-900/30 flex items-center gap-2">
            <Info className="h-4 w-4 text-purple-400 shrink-0" />
            <span>
              All edge weights <code className="text-slate-200 font-mono">w(e) ∈ [0, 100]</code> represent algorithmic compatibility scores computed by the Phase 3 clinical rules engine. They describe computational decision support metrics and are strictly not clinical success probabilities.
            </span>
          </div>
        </div>
      )}

      {/* Scope Disclaimer Banner (if Filtered) */}
      {isFiltered && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Filtered Network View Active: </span>
              <span>
                Displayed coverage is calculated on {eligibleDonorsCount} eligible donors and {eligibleRecipientsCount} eligible recipients (Network Coverage: {networkMatchingCoverage}%).
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedOrgan('all');
              setSelectedDonorBlood('all');
              setSelectedRecipientBlood('all');
              setSelectedHospitalId('all');
              setMinScore(0);
              setSelectedUrgency('all');
              setAvailableOnly(true);
              setIncludeReview(true);
            }}
            className="text-[11px] underline hover:text-amber-200 ml-3 shrink-0"
          >
            Reset Filters to Full Network
          </button>
        </div>
      )}

      {/* Controls Bar: Algorithm Selector & View Modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        {/* 1. Algorithm Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Matching Algorithm
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              id="alg-cardinality"
              onClick={() => setSelectedAlgorithm('cardinality')}
              className={`px-2 py-1.5 rounded text-[11px] font-semibold transition ${
                selectedAlgorithm === 'cardinality'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Max Cardinality
            </button>
            <button
              id="alg-weight"
              onClick={() => setSelectedAlgorithm('weight')}
              className={`px-2 py-1.5 rounded text-[11px] font-semibold transition ${
                selectedAlgorithm === 'weight'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Max Weight
            </button>
            <button
              id="alg-multi-objective"
              onClick={() => setSelectedAlgorithm('multi-objective')}
              className={`px-2 py-1.5 rounded text-[11px] font-semibold transition ${
                selectedAlgorithm === 'multi-objective'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Multi-Objective
            </button>
          </div>
        </div>

        {/* 2. View Modes (Mode A, B, C) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-sky-400" />
            Matching View Mode
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              id="mode-all-candidates"
              onClick={() => setViewMode('all-candidates')}
              className={`px-2 py-1.5 rounded text-[11px] font-semibold transition ${
                viewMode === 'all-candidates'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show all eligible candidate edges"
            >
              All Candidates
            </button>
            <button
              id="mode-selected-matches"
              onClick={() => setViewMode('selected-matches')}
              className={`px-2 py-1.5 rounded text-[11px] font-semibold transition ${
                viewMode === 'selected-matches'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show only edges selected by the matching algorithm"
            >
              Selected Only
            </button>
            <button
              id="mode-candidates-selected"
              onClick={() => setViewMode('candidates-and-selected')}
              className={`px-2 py-1.5 rounded text-[11px] font-semibold transition ${
                viewMode === 'candidates-and-selected'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show all candidate edges + highlight selected matches (Default)"
            >
              All + Selected
            </button>
          </div>
        </div>

        {/* 3. Edge Score Labels & Quick Toggles */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            Display Options
          </label>
          <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-lg border border-slate-800 h-[38px]">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                id="toggle-edge-labels"
                checked={showEdgeLabels}
                onChange={(e) => setShowEdgeLabels(e.target.checked)}
                className="rounded border-slate-700 text-sky-500 focus:ring-sky-500/20 bg-slate-900"
              />
              <span>Show Edge Scores</span>
            </label>
            <div className="h-4 w-px bg-slate-800" />
            <div className="text-[11px] text-slate-400">
              Selected: <span className="font-bold text-emerald-400 font-mono">{selectedMatchesCount}</span> pairs
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-sky-400" />
            Graph Subnetwork Filters
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {eligibleDonorsCount} Donors | {eligibleRecipientsCount} Recipients | {candidateEdgesCount} Candidate Edges
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* Organ Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Organ</label>
            <select
              value={selectedOrgan}
              onChange={(e) => setSelectedOrgan(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Organs</option>
              <option value="kidney">Kidney</option>
              <option value="liver">Liver</option>
              <option value="heart">Heart</option>
              <option value="lung">Lung</option>
              <option value="cornea">Cornea</option>
            </select>
          </div>

          {/* Organ Size Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Organ Size</label>
            <select
              value={selectedOrganSize}
              onChange={(e) => setSelectedOrganSize(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Sizes</option>
              <option value="Pediatric">Pediatric</option>
              <option value="Small">Small</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
            </select>
          </div>

          {/* Donor Blood */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Donor Blood</label>
            <select
              value={selectedDonorBlood}
              onChange={(e) => setSelectedDonorBlood(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Blood Groups</option>
              <option value="O-">O-</option>
              <option value="O+">O+</option>
              <option value="A-">A-</option>
              <option value="A+">A+</option>
              <option value="B-">B-</option>
              <option value="B+">B+</option>
              <option value="AB-">AB-</option>
              <option value="AB+">AB+</option>
            </select>
          </div>

          {/* Recipient Blood */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Recipient Blood</label>
            <select
              value={selectedRecipientBlood}
              onChange={(e) => setSelectedRecipientBlood(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Blood Groups</option>
              <option value="O-">O-</option>
              <option value="O+">O+</option>
              <option value="A-">A-</option>
              <option value="A+">A+</option>
              <option value="B-">B-</option>
              <option value="B+">B+</option>
              <option value="AB-">AB-</option>
              <option value="AB+">AB+</option>
            </select>
          </div>

          {/* Hospital Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Hospital</label>
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Hospitals</option>
              {hospitals.map((h) => (
                <option key={h.id} value={String(h.id)}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Urgency */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Urgency Tier</label>
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Tiers</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Min Score Range */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
              Min Score: <span className="font-mono text-sky-400 font-bold">{minScore}</span>
            </label>
            <input
              type="range"
              min={0}
              max={95}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-2"
            />
          </div>

          {/* Edge Quality Threshold */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Candidate Status</label>
            <select
              value={includeReview ? 'review' : 'candidates'}
              onChange={(e) => setIncludeReview(e.target.value === 'review')}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="review">Candidates + Review</option>
              <option value="candidates">Candidates Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Prominent Matching Coverage KPI Cards & Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Prominent Matching Coverage Card with Progress Gauge */}
        <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              Matching Coverage
              <div className="group relative">
                <HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 w-64 p-2.5 bg-slate-950 border border-slate-700 rounded-lg shadow-xl text-[11px] text-slate-300 leading-relaxed z-50">
                  Matching coverage measures the proportion of currently eligible donors/recipients that received an algorithmic match in the selected graph. It is not a clinical success rate.
                </div>
              </div>
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              {networkMatchingCoverage}%
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                {networkMatchingCoverage}%
              </span>
              <span className="text-xs text-slate-400">
                ({selectedMatchesCount} of {matchingCapacity} matching capacity)
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-2.5 mt-2.5 overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, networkMatchingCoverage)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-500 block">Donor Coverage</span>
              <span className="font-bold text-sky-400 font-mono">{donorMatchingCoverage}%</span>
            </div>
            <div>
              <span className="text-slate-500 block">Recipient Coverage</span>
              <span className="font-bold text-emerald-400 font-mono">{recipientMatchingCoverage}%</span>
            </div>
          </div>
        </div>

        {/* Selected Algorithm Metric Details */}
        <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                {selectedAlgorithm === 'cardinality' && 'Max Cardinality Result'}
                {selectedAlgorithm === 'weight' && 'Max Weight Result'}
                {selectedAlgorithm === 'multi-objective' && 'Multi-Objective Result'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {activeMatchingResult.executionTimeMs} ms
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="text-2xl font-bold text-slate-100 font-mono">
                {selectedMatchesCount} Selected Matches
              </div>
              <p className="text-[11px] text-slate-400">
                {selectedAlgorithm === 'cardinality' && 'Objective: Maximize total number of matched pairs (|M|).'}
                {selectedAlgorithm === 'weight' && 'Objective: Maximize total compatibility score (∑ w(e)).'}
                {selectedAlgorithm === 'multi-objective' && 'Objective: Balance compatibility score, urgency tier, and wait time.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-500 block">Average Score</span>
              <span className="font-bold text-sky-400 font-mono">{activeMatchingResult.averageWeight} / 100</span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Weight</span>
              <span className="font-bold text-purple-400 font-mono">{activeMatchingResult.totalWeight} pts</span>
            </div>
          </div>
        </div>

        {/* Candidate Edges & Density */}
        <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                Bipartite Density
                <div className="group relative">
                  <HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                  <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 w-64 p-2.5 bg-slate-950 border border-slate-700 rounded-lg shadow-xl text-[11px] text-slate-300 leading-relaxed z-50">
                    Density = E / (D × R) × 100%. Represents the percentage of possible donor-recipient relationships with eligible compatibility edges. This is a topological connectivity metric, not matching coverage.
                  </div>
                </div>
              </span>
              <span className="text-xs font-mono font-bold text-purple-400">
                {bipartiteGraphDensity}%
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="text-2xl font-bold text-slate-100 font-mono">
                {candidateEdgesCount} Candidate Edges
              </div>
              <p className="text-[11px] text-slate-400">
                Eligible relationships available to the solver out of {eligibleDonorsCount * eligibleRecipientsCount} possible cross-pairs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-500 block">Active Donors</span>
              <span className="font-bold text-sky-400 font-mono">{eligibleDonorsCount} nodes</span>
            </div>
            <div>
              <span className="text-slate-500 block">Active Recipients</span>
              <span className="font-bold text-emerald-400 font-mono">{eligibleRecipientsCount} nodes</span>
            </div>
          </div>
        </div>

        {/* Unmatched Entities */}
        <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Unmatched Entities
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {unmatchedDonorsCount + unmatchedRecipientsCount} total
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="text-2xl font-bold text-slate-100 font-mono">
                {unmatchedRecipientsCount} Waitlist Pending
              </div>
              <p className="text-[11px] text-slate-400">
                Patients remaining unmatched under current one-to-one allocation constraints.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-500 block">Unmatched Donors</span>
              <span className="font-bold text-amber-400 font-mono">{unmatchedDonorsCount}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Unmatched Recipients</span>
              <span className="font-bold text-amber-400 font-mono">{unmatchedRecipientsCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Sided Bipartite Graph Visualization Canvas */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        {/* Graph Header with Search, Zoom & Legend */}
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-950">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <GitFork className="h-4 w-4 text-sky-400" />
              Two-Sided Bipartite Allocation Canvas
            </h3>
            <span className="text-[11px] text-slate-400">
              (Left: Donors • Right: Recipients)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Node */}
            <div className="relative">
              <Search className="h-3 w-3 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search node (e.g. D101, R201)..."
                className="bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-48"
              />
            </div>

            {/* Zoom & Canvas Navigation Controls */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-inner">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
                title="Zoom Out (-)"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold text-sky-400 px-1.5 min-w-[42px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
                title="Zoom In (+)"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <div className="h-3.5 w-[1px] bg-slate-800 mx-0.5" />
              <button
                type="button"
                onClick={handleFitToView}
                className="p-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
                title="Fit to View"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoomAndPan}
                className="p-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
                title="Reset View & Center"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Permanent Graph Legend */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
          <span className="font-semibold text-slate-400 uppercase text-[10px]">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-sky-500 border border-sky-300" />
            <span>🔵 Donor Node (Supply)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500 border border-emerald-300" />
            <span>🟢 Recipient Node (Demand)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-slate-600 inline-block" />
            <span>──── Candidate Edge</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-5 bg-emerald-400 inline-block rounded shadow-sm shadow-emerald-400/50" />
            <span className="font-bold text-emerald-300">════ Selected Match</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 border-b border-dashed border-amber-400 inline-block" />
            <span>┄┄ Review Edge</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-5 bg-purple-400 inline-block rounded" />
            <span>── Highlighted Path</span>
          </div>
        </div>

        {/* SVG Visualization Container with Interactive Move & Zoom Canvas */}
        <div
          ref={svgContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative w-full h-[640px] max-h-[640px] overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {/* Subtle Canvas Interaction Guide overlay */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800/90 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-300 shadow-md">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-medium">
              Canvas Navigation: <span className="text-sky-300 font-semibold">Click & Drag to Move</span> • <span className="text-emerald-300 font-semibold">Scroll to Zoom</span>
            </span>
          </div>

          {/* Floating On-Canvas Move & Zoom Controller HUD */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-2xl text-slate-300">
            {/* Move/Pan Indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-300 border-r border-slate-800">
              <Hand className="h-3.5 w-3.5 text-sky-400" />
              <span className="hidden sm:inline">Drag to move</span>
            </div>

            {/* Quick Directional Pan Controls */}
            <div className="flex items-center gap-0.5 pr-1 border-r border-slate-800">
              <button
                type="button"
                onClick={() => handlePanNudge(60, 0)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 transition"
                title="Pan Left"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handlePanNudge(0, 60)}
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 transition"
                  title="Pan Up"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handlePanNudge(0, -60)}
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 transition"
                  title="Pan Down"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => handlePanNudge(-60, 0)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 transition"
                title="Pan Right"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Zoom Out Button */}
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Zoom Out (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            {/* Zoom Percentage */}
            <span className="text-xs font-mono font-bold text-sky-300 px-1 min-w-[46px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>

            {/* Zoom In Button */}
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Zoom In (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            {/* Fit Whole View */}
            <button
              type="button"
              onClick={handleFitToView}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Fit to View"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            {/* Reset View */}
            <button
              type="button"
              onClick={handleResetZoomAndPan}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Reset View & Center (100%)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {eligibleDonorsCount === 0 || eligibleRecipientsCount === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-2">
              <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold">No vertices available under active filter configuration.</p>
              <p className="text-xs text-slate-500">
                Adjust the organ, blood group, or hospital filter above to reveal bipartite compatibility edges.
              </p>
            </div>
          ) : (
            <div
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: '0 0',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                width: `${svgWidth}px`,
              }}
              className="relative"
            >
              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="overflow-visible"
              >
                <defs>
                  {/* Glowing filter for selected matching edges */}
                  <filter id="glow-selected" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="selectedMatchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>

                {/* Partition Header Labels */}
                <g className="text-xs font-bold font-mono">
                  {/* DONORS Column Header */}
                  <rect
                    x={donorColX - 90}
                    y={14}
                    width={180}
                    height={30}
                    rx={6}
                    fill="#0369a1"
                    fillOpacity="0.2"
                    stroke="#0284c7"
                    strokeWidth="1"
                  />
                  <text
                    x={donorColX}
                    y={34}
                    textAnchor="middle"
                    fill="#38bdf8"
                    className="font-bold tracking-widest text-[12px]"
                  >
                    DONORS ({eligibleDonorsCount})
                  </text>

                  {/* RECIPIENTS Column Header */}
                  <rect
                    x={recipientColX - 90}
                    y={14}
                    width={180}
                    height={30}
                    rx={6}
                    fill="#065f46"
                    fillOpacity="0.2"
                    stroke="#059669"
                    strokeWidth="1"
                  />
                  <text
                    x={recipientColX}
                    y={34}
                    textAnchor="middle"
                    fill="#34d399"
                    className="font-bold tracking-widest text-[12px]"
                  >
                    RECIPIENTS ({eligibleRecipientsCount})
                  </text>
                </g>

                {/* RENDER EDGES */}
                <g className="edges-layer">
                  {activeGraph.edges.map((edge) => {
                    const dCoord = donorCoords.get(edge.donorId);
                    const rCoord = recipientCoords.get(edge.recipientId);
                    if (!dCoord || !rCoord) return null;

                    const edgeKey = `${edge.donorId}-${edge.recipientId}`;
                    const isSelectedMatch = selectedMatchMap.has(edgeKey);

                    // Visibility logic based on View Mode
                    if (viewMode === 'selected-matches' && !isSelectedMatch) {
                      return null; // hide non-selected edges in Mode B
                    }

                    // Hover & search highlight determination
                    const isHovered =
                      hoveredEdgeKey === edgeKey ||
                      (activeHighlightedEdges && activeHighlightedEdges.has(edgeKey));

                    const isDimmed =
                      (hoveredNodeId || hoveredEdgeKey) &&
                      !isHovered &&
                      (!isSelectedMatch || viewMode === 'all-candidates');

                    // Cubic bezier smooth bipartite ribbon path
                    const midX = (dCoord.x + rCoord.x) / 2;
                    const pathD = `M ${dCoord.x + 35} ${dCoord.y} C ${midX} ${dCoord.y}, ${midX} ${rCoord.y}, ${rCoord.x - 35} ${rCoord.y}`;

                    const strokeColor = isSelectedMatch
                      ? '#10b981'
                      : isHovered
                      ? '#c084fc'
                      : edge.status === 'REQUIRES_REVIEW'
                      ? '#f59e0b'
                      : '#475569';

                    const strokeWidth = isSelectedMatch
                      ? isHovered
                        ? 4.5
                        : 3.5
                      : isHovered
                      ? 2.5
                      : 1.2;

                    const strokeOpacity = isDimmed ? 0.15 : isSelectedMatch ? 0.95 : isHovered ? 0.9 : 0.45;

                    return (
                      <g
                        key={`edge-${edgeKey}`}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredEdgeKey(edgeKey)}
                        onMouseLeave={() => setHoveredEdgeKey(null)}
                        onClick={() => {
                          if (hasDraggedRef.current) return;
                          const donor = nodeMap.get(edge.donorId)!;
                          const recipient = nodeMap.get(edge.recipientId)!;
                          setSelectedEdgeDetails({
                            edge,
                            donor,
                            recipient,
                            isSelectedMatch,
                            algorithmName: activeMatchingResult.algorithm,
                            rank: selectedMatchMap.get(edgeKey)?.rank,
                          });
                        }}
                      >
                        {/* Glow underlay for selected matching edges */}
                        {isSelectedMatch && !isDimmed && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="8"
                            strokeOpacity="0.25"
                            strokeLinecap="round"
                          />
                        )}

                        {/* Main connecting wire */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeOpacity={strokeOpacity}
                          strokeDasharray={
                            edge.status === 'REQUIRES_REVIEW' && !isSelectedMatch
                              ? '4 3'
                              : undefined
                          }
                          strokeLinecap="round"
                        />

                        {/* Edge Score Label badge (Toggleable) */}
                        {showEdgeLabels && (!isDimmed || isSelectedMatch || isHovered) && (
                          <g
                            transform={`translate(${midX}, ${(dCoord.y + rCoord.y) / 2})`}
                            className="pointer-events-none"
                          >
                            <rect
                              x={-15}
                              y={-9}
                              width={30}
                              height={18}
                              rx={4}
                              fill={isSelectedMatch ? '#065f46' : '#0f172a'}
                              stroke={isSelectedMatch ? '#34d399' : '#334155'}
                              strokeWidth={isSelectedMatch ? '1.5' : '1'}
                              opacity={isSelectedMatch ? 1 : isHovered ? 1 : 0.85}
                            />
                            <text
                              x={0}
                              y={3.5}
                              textAnchor="middle"
                              fill={isSelectedMatch ? '#6ee7b7' : '#94a3b8'}
                              className="text-[10px] font-mono font-bold"
                            >
                              {Math.round(edge.weight)}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* RENDER DONOR NODES (Left Column) */}
                <g className="donors-layer">
                  {activeGraph.donors.map((donor) => {
                    const coord = donorCoords.get(donor.id);
                    if (!coord) return null;

                    const isMatched = matchedDonorLookup.has(donor.id);
                    const matchedRecipient = matchedDonorLookup.get(donor.id);
                    const isHovered = hoveredNodeId === donor.id;
                    const isDimmed =
                      (hoveredNodeId && hoveredNodeId !== donor.id && !activeHighlightedEdges?.has(`${donor.id}-${hoveredNodeId.replace('R', '')}`)) ||
                      (searchQuery && !donor.displayLabel.toLowerCase().includes(searchQuery.toLowerCase()) && !donor.id.toLowerCase().includes(searchQuery.toLowerCase()));

                    return (
                      <g
                        key={`donor-node-${donor.id}`}
                        transform={`translate(${coord.x}, ${coord.y})`}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredNodeId(donor.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={() => {
                          if (hasDraggedRef.current) return;
                          setSelectedNodeDetails(donor);
                        }}
                        opacity={isDimmed ? 0.3 : 1}
                      >
                        {/* Node Card Container */}
                        <rect
                          x={-60}
                          y={-18}
                          width={120}
                          height={36}
                          rx={8}
                          fill={isHovered ? '#0284c7' : isMatched ? '#082f49' : '#0f172a'}
                          stroke={isHovered ? '#7dd3fc' : isMatched ? '#38bdf8' : '#334155'}
                          strokeWidth={isHovered ? '2' : isMatched ? '1.5' : '1'}
                          className="transition-colors"
                        />

                        {/* Visual Icon Badge (Blue Node) */}
                        <title>{`${donor.displayLabel} (${donor.name}) • ${donor.organ}${donor.organSize ? ` [${donor.organSize}]` : ''} • ABO ${donor.bloodGroup}`}</title>
                        <circle cx={-40} cy={0} r={7} fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                        <text x={-40} y={3} textAnchor="middle" fill="#ffffff" className="text-[9px] font-bold">
                          D
                        </text>

                        {/* Display Label (e.g. D001) */}
                        <text
                          x={-26}
                          y={4}
                          textAnchor="start"
                          fill={isMatched ? '#e0f2fe' : '#94a3b8'}
                          className="text-[12px] font-mono font-bold"
                        >
                          {donor.displayLabel}
                        </text>

                        {/* Matched Counterpart Tag / Degree Badge */}
                        {isMatched ? (
                          <g transform="translate(24, 0)">
                            <rect x={-4} y={-9} width={34} height={18} rx={4} fill="#0369a1" fillOpacity="0.6" />
                            <text x={13} y={3.5} textAnchor="middle" fill="#7dd3fc" className="text-[9px] font-mono font-bold">
                              ➔ {matchedRecipient?.displayLabel}
                            </text>
                          </g>
                        ) : (
                          <text x={42} y={3.5} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono">
                            d:{activeGraph.adj.get(donor.id)?.length || 0}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* RENDER RECIPIENT NODES (Right Column) */}
                <g className="recipients-layer">
                  {activeGraph.recipients.map((recipient) => {
                    const coord = recipientCoords.get(recipient.id);
                    if (!coord) return null;

                    const isMatched = matchedRecipientLookup.has(recipient.id);
                    const matchedDonor = matchedRecipientLookup.get(recipient.id);
                    const isHovered = hoveredNodeId === recipient.id;
                    const isDimmed =
                      (hoveredNodeId && hoveredNodeId !== recipient.id && !activeHighlightedEdges?.has(`${hoveredNodeId.replace('D', '')}-${recipient.id}`)) ||
                      (searchQuery && !recipient.displayLabel.toLowerCase().includes(searchQuery.toLowerCase()) && !recipient.id.toLowerCase().includes(searchQuery.toLowerCase()));

                    return (
                      <g
                        key={`recipient-node-${recipient.id}`}
                        transform={`translate(${coord.x}, ${coord.y})`}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredNodeId(recipient.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={() => {
                          if (hasDraggedRef.current) return;
                          setSelectedNodeDetails(recipient);
                        }}
                        opacity={isDimmed ? 0.3 : 1}
                      >
                        {/* Node Card Container */}
                        <rect
                          x={-60}
                          y={-18}
                          width={120}
                          height={36}
                          rx={8}
                          fill={isHovered ? '#059669' : isMatched ? '#064e3b' : '#0f172a'}
                          stroke={isHovered ? '#6ee7b7' : isMatched ? '#34d399' : '#334155'}
                          strokeWidth={isHovered ? '2' : isMatched ? '1.5' : '1'}
                          className="transition-colors"
                        />

                        {/* Visual Icon Badge (Green Node) */}
                        <title>{`${recipient.displayLabel} (${recipient.name}) • ${recipient.organ}${recipient.organSize ? ` [${recipient.organSize}]` : ''} • ABO ${recipient.bloodGroup}`}</title>
                        <circle cx={-40} cy={0} r={7} fill="#059669" stroke="#34d399" strokeWidth="1.5" />
                        <text x={-40} y={3} textAnchor="middle" fill="#ffffff" className="text-[9px] font-bold">
                          R
                        </text>

                        {/* Display Label (e.g. R001) */}
                        <text
                          x={-26}
                          y={4}
                          textAnchor="start"
                          fill={isMatched ? '#d1fae5' : '#94a3b8'}
                          className="text-[12px] font-mono font-bold"
                        >
                          {recipient.displayLabel}
                        </text>

                        {/* Matched Counterpart Tag / Degree Badge */}
                        {isMatched ? (
                          <g transform="translate(24, 0)">
                            <rect x={-4} y={-9} width={34} height={18} rx={4} fill="#065f46" fillOpacity="0.6" />
                            <text x={13} y={3.5} textAnchor="middle" fill="#6ee7b7" className="text-[9px] font-mono font-bold">
                              ➔ {matchedDonor?.displayLabel}
                            </text>
                          </g>
                        ) : (
                          <text x={42} y={3.5} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono">
                            d:{activeGraph.adj.get(recipient.id)?.length || 0}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Algorithm Comparison Table */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              <Award className="h-4 w-4 text-sky-400" />
              Empirical Algorithm Optimization Comparison
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live algorithmic execution comparing Maximum Cardinality, Maximum Weight, and Multi-Objective matching across the active graph.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Active: <span className="font-bold text-sky-400">{activeMatchingResult.algorithm}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Algorithm</th>
                <th className="py-2.5 px-4 text-center">Selected Matches</th>
                <th className="py-2.5 px-4 text-center">Donor Coverage</th>
                <th className="py-2.5 px-4 text-center">Recipient Coverage</th>
                <th className="py-2.5 px-4 text-right">Avg Compatibility Score</th>
                <th className="py-2.5 px-4 text-right">Total Score</th>
                <th className="py-2.5 px-4 text-right">Runtime</th>
                <th className="py-2.5 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {/* 1. Maximum Cardinality */}
              <tr
                className={`hover:bg-slate-800/40 ${
                  selectedAlgorithm === 'cardinality' ? 'bg-sky-500/10' : ''
                }`}
              >
                <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Maximum Cardinality (Hopcroft-Karp)
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans block">
                    Maximizes number of paired entities (|M|)
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-bold text-sky-400">
                  {cardinalityResult.totalMatches} pairs
                </td>
                <td className="py-3 px-4 text-center text-slate-300">
                  {cardinalityResult.donorCoveragePercent}%
                </td>
                <td className="py-3 px-4 text-center text-slate-300">
                  {cardinalityResult.recipientCoveragePercent}%
                </td>
                <td className="py-3 px-4 text-right text-slate-300">
                  {cardinalityResult.averageWeight} / 100
                </td>
                <td className="py-3 px-4 text-right text-slate-300">
                  {cardinalityResult.totalWeight} pts
                </td>
                <td className="py-3 px-4 text-right text-slate-400 font-bold">
                  {cardinalityResult.executionTimeMs} ms
                </td>
                <td className="py-3 px-4">
                  {selectedAlgorithm === 'cardinality' ? (
                    <span className="px-2 py-0.5 rounded bg-sky-500 text-white font-sans text-[10px] font-bold">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => setSelectedAlgorithm('cardinality')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-[10px]"
                    >
                      Select
                    </button>
                  )}
                </td>
              </tr>

              {/* 2. Maximum Weight */}
              <tr
                className={`hover:bg-slate-800/40 ${
                  selectedAlgorithm === 'weight' ? 'bg-purple-500/10' : ''
                }`}
              >
                <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    Maximum Weight (Greedy/Hungarian Priority)
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans block">
                    Maximizes total compatibility weight (∑ w(e))
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-bold text-purple-400">
                  {weightResult.totalMatches} pairs
                </td>
                <td className="py-3 px-4 text-center text-slate-300">
                  {weightResult.donorCoveragePercent}%
                </td>
                <td className="py-3 px-4 text-center text-slate-300">
                  {weightResult.recipientCoveragePercent}%
                </td>
                <td className="py-3 px-4 text-right text-purple-300 font-bold">
                  {weightResult.averageWeight} / 100
                </td>
                <td className="py-3 px-4 text-right text-purple-300 font-bold">
                  {weightResult.totalWeight} pts
                </td>
                <td className="py-3 px-4 text-right text-slate-400 font-bold">
                  {weightResult.executionTimeMs} ms
                </td>
                <td className="py-3 px-4">
                  {selectedAlgorithm === 'weight' ? (
                    <span className="px-2 py-0.5 rounded bg-purple-500 text-white font-sans text-[10px] font-bold">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => setSelectedAlgorithm('weight')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-[10px]"
                    >
                      Select
                    </button>
                  )}
                </td>
              </tr>

              {/* 3. Multi-Objective Matching */}
              <tr
                className={`hover:bg-slate-800/40 ${
                  selectedAlgorithm === 'multi-objective' ? 'bg-emerald-500/10' : ''
                }`}
              >
                <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Multi-Objective Balanced Matching
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans block">
                    Balances Compatibility (50%), Urgency Tier (30%), Waitlist Tenure (20%)
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-bold text-emerald-400">
                  {multiObjectiveResult.totalMatches} pairs
                </td>
                <td className="py-3 px-4 text-center text-slate-300">
                  {multiObjectiveResult.donorCoveragePercent}%
                </td>
                <td className="py-3 px-4 text-center text-slate-300">
                  {multiObjectiveResult.recipientCoveragePercent}%
                </td>
                <td className="py-3 px-4 text-right text-emerald-300 font-bold">
                  {multiObjectiveResult.averageWeight} / 100
                </td>
                <td className="py-3 px-4 text-right text-emerald-300 font-bold">
                  {multiObjectiveResult.totalWeight} pts
                </td>
                <td className="py-3 px-4 text-right text-slate-400 font-bold">
                  {multiObjectiveResult.executionTimeMs} ms
                </td>
                <td className="py-3 px-4">
                  {selectedAlgorithm === 'multi-objective' ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-sans text-[10px] font-bold">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => setSelectedAlgorithm('multi-objective')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-[10px]"
                    >
                      Select
                    </button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Unmatched Entities Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unmatched Donors */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Unmatched Donors ({unmatchedDonorsCount})
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              Surplus capacity in partition
            </span>
          </div>

          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
            {activeMatchingResult.unmatchedDonors.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">All eligible donors received an algorithmic allocation.</p>
            ) : (
              activeMatchingResult.unmatchedDonors.map((donor) => {
                const degree = activeGraph.adj.get(donor.id)?.length || 0;
                return (
                  <div
                    key={`unmatched-d-${donor.id}`}
                    onClick={() => setSelectedNodeDetails(donor)}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono font-bold text-[10px]">
                        {donor.displayLabel}
                      </span>
                      <span className="text-slate-300 font-semibold">{donor.organ}</span>
                      <span className="text-[11px] text-slate-500 font-mono">[{donor.bloodGroup}]</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      <span>degree: {degree}</span>
                      <span className="ml-2 text-amber-400 font-sans">Unmatched</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Unmatched Recipients */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Unmatched Recipients ({unmatchedRecipientsCount})
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              Waitlist patients awaiting compatibility
            </span>
          </div>

          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
            {activeMatchingResult.unmatchedRecipients.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">All eligible recipients received an algorithmic allocation.</p>
            ) : (
              activeMatchingResult.unmatchedRecipients.map((recipient) => {
                const degree = activeGraph.adj.get(recipient.id)?.length || 0;
                return (
                  <div
                    key={`unmatched-r-${recipient.id}`}
                    onClick={() => setSelectedNodeDetails(recipient)}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[10px]">
                        {recipient.displayLabel}
                      </span>
                      <span className="text-slate-300 font-semibold">{recipient.organ}</span>
                      <span className="text-[11px] text-slate-500 font-mono">[{recipient.bloodGroup}]</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        {recipient.urgency}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      <span>degree: {degree}</span>
                      <span className="ml-2 text-slate-500">{recipient.waitingTimeDays}d</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Accessible Matching Table (Requirement #33) */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Accessible Tabular Matching Results
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Complete tabular listing of all {selectedMatchesCount} selected matches for accessibility and inspection.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {activeMatchingResult.algorithm}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Rank</th>
                <th className="py-2.5 px-4">Donor Node</th>
                <th className="py-2.5 px-4">Recipient Node</th>
                <th className="py-2.5 px-4">Organ</th>
                <th className="py-2.5 px-4">Urgency Tier</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Algorithmic Compatibility Score</th>
                <th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {activeMatchingResult.matches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No algorithmic pairings identified in current graph.
                  </td>
                </tr>
              ) : (
                activeMatchingResult.matches.map((m, idx) => (
                  <tr key={`table-match-${m.donor.id}-${m.recipient.id}`} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono text-slate-400">#{m.rank || idx + 1}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-bold text-sky-400 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                        {m.donor.displayLabel}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">[{m.donor.bloodGroup}] {m.donor.location}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {m.recipient.displayLabel}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">[{m.recipient.bloodGroup}] {m.recipient.location}</span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-200">{m.donor.organ}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                        {m.recipient.urgency}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                        SELECTED MATCH
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-400">
                      {m.score.toFixed(1)} / 100
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => {
                          const edge = activeGraph.edges.find(
                            (e) => e.donorId === m.donor.id && e.recipientId === m.recipient.id
                          );
                          if (edge) {
                            setSelectedEdgeDetails({
                              edge,
                              donor: m.donor,
                              recipient: m.recipient,
                              isSelectedMatch: true,
                              algorithmName: activeMatchingResult.algorithm,
                              rank: m.rank,
                            });
                          }
                        }}
                        className="text-[11px] text-sky-400 hover:text-sky-300 underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Match Details Modal Drawer */}
      {selectedEdgeDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
                  {selectedEdgeDetails.isSelectedMatch ? 'Selected Match Pair' : 'Candidate Relationship'}
                </span>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                  <span className="text-sky-400">{selectedEdgeDetails.donor.displayLabel}</span>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                  <span className="text-emerald-400">{selectedEdgeDetails.recipient.displayLabel}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedEdgeDetails(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Donor Node</span>
                  <span className="font-mono font-bold text-sky-400 text-sm">{selectedEdgeDetails.donor.safeNodeId}</span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Blood: {selectedEdgeDetails.donor.bloodGroup} • Organ: {selectedEdgeDetails.donor.organ}
                    {selectedEdgeDetails.donor.organSize && (
                      <span className="text-purple-300 font-semibold"> ({selectedEdgeDetails.donor.organSize})</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Recipient Node</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{selectedEdgeDetails.recipient.safeNodeId}</span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Blood: {selectedEdgeDetails.recipient.bloodGroup} • Tier: {selectedEdgeDetails.recipient.urgency}
                    {selectedEdgeDetails.recipient.organSize && (
                      <span className="text-purple-300 font-semibold"> • Size: {selectedEdgeDetails.recipient.organSize}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Algorithmic Compatibility Score</span>
                  <span className="text-xl font-bold text-sky-400 font-mono">
                    {selectedEdgeDetails.edge.weight.toFixed(1)} / 100
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Matching Algorithm</span>
                  <span className="font-semibold text-slate-200 text-xs block mt-1">
                    {selectedEdgeDetails.algorithmName}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Rank: #{selectedEdgeDetails.rank || 1}</span>
                </div>
              </div>

              {/* Clinical Components Breakdown from Phase 3 */}
              {selectedEdgeDetails.edge.evaluation && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Phase 3 Clinical Component Rules
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedEdgeDetails.edge.evaluation.ruleResults.map((r, idx) => (
                      <div
                        key={`rule-${idx}`}
                        className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800/60 text-[11px]"
                      >
                        <span className="text-slate-300 font-medium">{r.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400">{r.score}/100</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              r.passed
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {r.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-slate-500 font-mono pt-1">
                Rule Engine: {selectedEdgeDetails.edge.ruleVersion} • Evaluated: {selectedEdgeDetails.edge.generatedAt?.slice(0, 19)}
              </div>
            </div>

            <button
              onClick={() => setSelectedEdgeDetails(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
            >
              Close Match Details
            </button>
          </div>
        </div>
      )}

      {/* Node Details Modal Drawer */}
      {selectedNodeDetails && (() => {
        const isDonor = selectedNodeDetails.type === 'donor';
        const matchedPartner = isDonor
          ? matchedDonorLookup.get(selectedNodeDetails.id)
          : matchedRecipientLookup.get(selectedNodeDetails.id);

        const matchedMatchObj = activeMatchingResult.matches.find((m) =>
          isDonor ? m.donor.id === selectedNodeDetails.id : m.recipient.id === selectedNodeDetails.id
        );

        const incidentEdges = (activeGraph.adj.get(selectedNodeDetails.id) || []).slice().sort((a, b) => b.weight - a.weight);

        // Analyze if another candidate has a higher edge score than the matched pair
        const higherEdge = matchedMatchObj
          ? incidentEdges.find((e) => e.neighborId !== matchedPartner?.id && e.weight > matchedMatchObj.score)
          : undefined;

        const higherClaimant = higherEdge
          ? isDonor
            ? matchedRecipientLookup.get(higherEdge.neighborId)
            : matchedDonorLookup.get(higherEdge.neighborId)
          : undefined;

        const higherClaimantMatch = higherEdge && higherClaimant
          ? activeMatchingResult.matches.find((m) =>
              isDonor ? m.recipient.id === higherEdge.neighborId : m.donor.id === higherEdge.neighborId
            )
          : undefined;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 p-4 shrink-0 bg-slate-950/50">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${isDonor ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                    <GitFork className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider block font-bold text-sky-400">
                      {isDonor ? 'Donor Node Inspection' : 'Recipient Node Inspection'}
                    </span>
                    <h3 className="text-base font-bold text-slate-100 font-mono">
                      {selectedNodeDetails.safeNodeId} <span className="text-slate-400 text-xs">({selectedNodeDetails.name || selectedNodeDetails.displayLabel})</span>
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedNodeDetails(null);
                    setExpandedCandidateId(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                  title="Close inspection"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
                {/* Top Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Graph Degree</span>
                    <span className="text-lg font-bold text-sky-400 font-mono">
                      {incidentEdges.length}
                    </span>
                    <span className="text-[10px] text-slate-500 block">compatible candidates</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Organ & Size</span>
                    <div className="font-semibold text-slate-200 truncate">{selectedNodeDetails.organ}</div>
                    <span className="text-[10px] font-bold text-purple-300">
                      {selectedNodeDetails.organSize || 'Standard'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Blood Group</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">
                      {selectedNodeDetails.bloodGroup}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">{selectedNodeDetails.location}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Algorithmic Status</span>
                    {matchedPartner ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold font-mono text-xs mt-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Matched: {matchedPartner.displayLabel}
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold text-xs block mt-0.5">Unmatched</span>
                    )}
                    <span className="text-[10px] text-slate-500 block truncate">{activeMatchingResult.algorithm.split('(')[0]}</span>
                  </div>
                </div>

                {/* Algorithmic Match & Allocation Explanation (HOW THE DONOR IS MATCHED) */}
                <div className={`p-3.5 rounded-lg border space-y-2.5 ${
                  matchedPartner
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-amber-950/20 border-amber-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className={`h-4 w-4 ${matchedPartner ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        {isDonor ? 'How This Donor Is Matched' : 'How This Recipient Is Matched'}
                      </h4>
                    </div>
                    {matchedMatchObj && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Pair Score: {matchedMatchObj.score.toFixed(1)} / 100
                      </span>
                    )}
                  </div>

                  {matchedPartner && matchedMatchObj ? (
                    <div className="space-y-2">
                      {/* Matched Partner Details Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded bg-slate-950/80 border border-slate-800 text-[11px]">
                        <div>
                          <div className="font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                            <span className="text-emerald-400 font-semibold">{isDonor ? 'Assigned Recipient:' : 'Assigned Donor:'}</span>
                            {matchedPartner.safeNodeId} ({matchedPartner.name || matchedPartner.displayLabel})
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            Blood: <span className="text-amber-300 font-mono font-semibold">{matchedPartner.bloodGroup}</span> • 
                            Location: {matchedPartner.location} • 
                            Organ Size: <span className="text-purple-300">{matchedPartner.organSize || 'Standard'}</span>
                            {matchedPartner.urgency && ` • Urgency: ${matchedPartner.urgency}`}
                            {matchedPartner.waitingTimeDays !== undefined && ` (${matchedPartner.waitingTimeDays} days)`}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const edgeObj = incidentEdges.find((e) => e.neighborId === matchedPartner.id);
                            if (edgeObj) {
                              setSelectedEdgeDetails({
                                edge: edgeObj.edge,
                                donor: isDonor ? selectedNodeDetails : matchedPartner,
                                recipient: isDonor ? matchedPartner : selectedNodeDetails,
                                isSelectedMatch: true,
                                algorithmName: activeMatchingResult.algorithm,
                              });
                            }
                          }}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition self-start sm:self-center shrink-0"
                        >
                          View Match Verification
                        </button>
                      </div>

                      {/* Explicit Algorithmic Rationale */}
                      <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 text-[11px] leading-relaxed text-slate-300 space-y-1.5">
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-sky-400" />
                          <span>Allocation Optimization Rationale ({activeMatchingResult.algorithm.split('(')[0]}):</span>
                        </div>
                        {higherEdge && higherClaimant ? (
                          <div className="space-y-1 text-slate-300">
                            <p>
                              <strong className="text-sky-300 font-mono">{selectedNodeDetails.displayLabel}</strong> is paired with{' '}
                              <strong className="text-emerald-300 font-mono">{matchedPartner.displayLabel}</strong> (Score: {matchedMatchObj.score.toFixed(1)}) because alternate candidate{' '}
                              <strong className="text-amber-300 font-mono">{higherEdge.neighborId}</strong> (Score: {higherEdge.weight.toFixed(1)}) was allocated to{' '}
                              <strong className="text-sky-300 font-mono">{higherClaimant.safeNodeId} ({higherClaimant.displayLabel})</strong>
                              {higherClaimantMatch ? ` with compatibility score ${higherClaimantMatch.score.toFixed(1)}` : ''}.
                            </p>
                            <p className="text-slate-400 text-[10px] bg-slate-900/90 p-2 rounded border border-slate-800">
                              <span className="text-sky-400 font-semibold">Why this global allocation? </span>
                              If <span className="text-slate-200 font-mono">{selectedNodeDetails.displayLabel}</span> had taken <span className="text-slate-200 font-mono">{higherEdge.neighborId}</span>, then <span className="text-slate-200 font-mono">{higherClaimant.displayLabel}</span> would be left without an eligible match (e.g. due to incompatible blood or organ constraints), resulting in only 1 transplant performed. By assigning <span className="text-slate-200 font-mono">{selectedNodeDetails.displayLabel} ➔ {matchedPartner.displayLabel}</span>, the network achieves <strong className="text-emerald-300">{activeMatchingResult.matches.length} simultaneous life-saving transplants</strong>, maximizing total global welfare.
                            </p>
                          </div>
                        ) : (
                          <p>
                            <strong className="text-emerald-300 font-mono">{matchedPartner.displayLabel}</strong> is the optimal candidate in the registry for <strong className="text-sky-300 font-mono">{selectedNodeDetails.displayLabel}</strong>, scoring <strong className="text-emerald-300">{matchedMatchObj.score.toFixed(1)} / 100</strong>. No conflicting assignment in the global maximum-weight solution blocked this primary allocation.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                      <span className="text-amber-300 font-semibold">Unmatched in current network solution: </span>
                      {incidentEdges.length > 0 ? (
                        <span>
                          All {incidentEdges.length} incident candidate edges were allocated to other donors/recipients with higher global priority or tighter immunological constraints in the {activeMatchingResult.algorithm.split('(')[0]} solution.
                        </span>
                      ) : (
                        <span>
                          No compatible candidates currently exist in the active registry meeting ABO, organ, and clinical viability constraints.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Incident Compatibility Edges & WHY OTHER HAS LOW MATCHING */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <GitFork className="h-3.5 w-3.5 text-sky-400" />
                        Incident Compatibility Candidates & Score Analysis
                      </h4>
                      <span className="text-[10px] text-slate-500">
                        Detailed breakdown of compatibility scores, positive drivers, and deduction penalties
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {incidentEdges.length} candidate{incidentEdges.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {incidentEdges.length === 0 ? (
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
                      No compatible edges incident to this node.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {incidentEdges.map((neighbor) => {
                        const candNode = isDonor
                          ? activeGraph.recipients.find((r) => r.id === neighbor.neighborId)
                          : activeGraph.donors.find((d) => d.id === neighbor.neighborId);

                        const isMatchedWithThisNode = matchedPartner?.id === neighbor.neighborId;
                        const otherClaimant = !isMatchedWithThisNode
                          ? isDonor
                            ? matchedRecipientLookup.get(neighbor.neighborId)
                            : matchedDonorLookup.get(neighbor.neighborId)
                          : undefined;

                        const otherClaimantMatch = otherClaimant
                          ? activeMatchingResult.matches.find((m) =>
                              isDonor ? m.recipient.id === neighbor.neighborId : m.donor.id === neighbor.neighborId
                            )
                          : undefined;

                        const donorObj = isDonor ? selectedNodeDetails : candNode;
                        const recipientObj = isDonor ? candNode : selectedNodeDetails;
                        const evalObj = neighbor.edge.evaluation;
                        const isExpanded = expandedCandidateId === neighbor.neighborId;

                        // Calculate strengths (why score is high)
                        const strengths: string[] = [];
                        if (donorObj && recipientObj) {
                          if (donorObj.bloodGroup === recipientObj.bloodGroup) {
                            strengths.push(`Identical ABO Blood Group (${donorObj.bloodGroup})`);
                          } else {
                            strengths.push(`Compatible Universal ABO (${donorObj.bloodGroup} ➔ ${recipientObj.bloodGroup})`);
                          }

                          if (donorObj.location === recipientObj.location) {
                            strengths.push(`Intra-city allocation in ${donorObj.location} (zero transit ischemia)`);
                          }

                          if (donorObj.organSize && recipientObj.organSize) {
                            if (donorObj.organSize === recipientObj.organSize) {
                              strengths.push(`Optimal organ size match (${donorObj.organSize})`);
                            }
                          }

                          if (recipientObj.urgency === 'Critical') {
                            strengths.push('Critical urgency tier (Tier 1 clinical priority)');
                          } else if (recipientObj.urgency === 'High') {
                            strengths.push('High urgency tier priority');
                          }

                          if ((evalObj?.hlaScore ?? 80) >= 85) {
                            strengths.push(`High HLA antigen compatibility (${evalObj?.hlaScore ?? 85}/100)`);
                          }
                        }

                        // Calculate deductions (WHY THIS HAS A LOWER SCORE / WHY OTHER HAS LOW MATCHING)
                        const deductions: string[] = [];
                        if (donorObj && recipientObj) {
                          // Organ Size Mismatch
                          if (donorObj.organSize && recipientObj.organSize && donorObj.organSize !== recipientObj.organSize) {
                            const sizeOrder = ['Pediatric', 'Small', 'Medium', 'Large'];
                            const diff = Math.abs(sizeOrder.indexOf(donorObj.organSize) - sizeOrder.indexOf(recipientObj.organSize));
                            deductions.push(
                              `Organ size disparity: Donor offers ${donorObj.organSize} vs Recipient target ${recipientObj.organSize} (${diff > 1 ? 'volumetric disparity warning, -18 pts' : 'acceptable variance, -5 pts'})`
                            );
                          }

                          // Geographic distance
                          if (donorObj.location !== recipientObj.location) {
                            deductions.push(
                              `Geographic transit distance: ${donorObj.location} ➔ ${recipientObj.location} (transit cold ischemia penalty, -15 pts)`
                            );
                          }

                          // Urgency & wait tenure
                          if (recipientObj.urgency === 'Low') {
                            deductions.push(
                              `Low medical urgency tier (${recipientObj.waitingTimeDays ?? 0} days waitlist tenure vs critical 200+ days, -25 pts weight)`
                            );
                          } else if (recipientObj.urgency === 'Medium') {
                            deductions.push(
                              `Moderate urgency tier (${recipientObj.waitingTimeDays ?? 0} days waitlist tenure, -15 pts weight)`
                            );
                          }

                          // Blood disparity
                          if (donorObj.bloodGroup !== recipientObj.bloodGroup) {
                            deductions.push(
                              `Non-identical blood type (${donorObj.bloodGroup} ➔ ${recipientObj.bloodGroup}): requires antibody crossmatch titer monitoring (-10 pts)`
                            );
                          }

                          // Age disparity
                          if (donorObj.age && recipientObj.age && Math.abs(donorObj.age - recipientObj.age) >= 20) {
                            deductions.push(
                              `Significant age disparity: ${Math.abs(donorObj.age - recipientObj.age)} years gap (${donorObj.age} vs ${recipientObj.age}) (-10 pts)`
                            );
                          }

                          // Medical warnings from rule engine
                          if (evalObj?.warnings && evalObj.warnings.length > 0) {
                            evalObj.warnings.forEach((w) => {
                              if (!deductions.some((d) => d.toLowerCase().includes(w.toLowerCase().slice(0, 10)))) {
                                deductions.push(`Clinical alert: ${w}`);
                              }
                            });
                          }
                        }

                        // Determine score tier styling
                        const isHigh = neighbor.weight >= 80;
                        const isModerate = neighbor.weight >= 65 && neighbor.weight < 80;

                        return (
                          <div
                            key={`cand-${neighbor.neighborId}`}
                            className={`rounded-lg border transition-all ${
                              isMatchedWithThisNode
                                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                                : otherClaimant
                                ? 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                                : 'bg-slate-950/60 border-slate-800/80'
                            }`}
                          >
                            {/* Candidate Header Row */}
                            <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-slate-100 text-xs">
                                    {neighbor.neighborId}
                                  </span>
                                  {candNode && (
                                    <span className="text-slate-400 font-medium">
                                      ({candNode.name})
                                    </span>
                                  )}
                                  {/* Allocation Status Badge */}
                                  {isMatchedWithThisNode ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      ✓ Matched with this Node
                                    </span>
                                  ) : otherClaimant ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                      Allocated to {otherClaimant.displayLabel} ({otherClaimantMatch?.score.toFixed(1)} pts)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                      Unmatched Alternate
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                                  {candNode && (
                                    <>
                                      <span>Blood: <strong className="text-amber-300 font-mono">{candNode.bloodGroup}</strong></span>
                                      <span>•</span>
                                      <span>Location: <strong className="text-slate-300">{candNode.location}</strong></span>
                                      <span>•</span>
                                      <span>Size: <strong className="text-purple-300">{candNode.organSize || 'Standard'}</strong></span>
                                      {candNode.urgency && (
                                        <>
                                          <span>•</span>
                                          <span>Urgency: <strong className="text-amber-400">{candNode.urgency}</strong></span>
                                        </>
                                      )}
                                      {candNode.waitingTimeDays !== undefined && (
                                        <>
                                          <span>•</span>
                                          <span>Wait: <strong className="text-slate-300">{candNode.waitingTimeDays}d</strong></span>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Right side: Score & Action Controls */}
                              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                <div className="text-right">
                                  <div
                                    className={`text-sm font-bold font-mono ${
                                      isHigh ? 'text-emerald-400' : isModerate ? 'text-sky-400' : 'text-amber-400'
                                    }`}
                                  >
                                    {neighbor.weight.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">/ 100</span>
                                  </div>
                                  <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                    {isHigh ? 'High Viability' : isModerate ? 'Moderate' : 'Low / Review'}
                                  </div>
                                </div>

                                <button
                                  onClick={() => setExpandedCandidateId(isExpanded ? null : neighbor.neighborId)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[10px] flex items-center gap-1 font-medium"
                                  title="Toggle score factors"
                                >
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  <span>{isExpanded ? 'Hide Factors' : 'Why this score?'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Score Breakdown Accordion (Why high vs why low matching) */}
                            {isExpanded && (
                              <div className="p-3 border-t border-slate-800/80 bg-slate-950/70 space-y-2.5 text-[11px] animate-in fade-in">
                                {/* Score Breakdown Reasons */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {/* Positive Drivers */}
                                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Positive Compatibility Drivers
                                    </div>
                                    {strengths.length > 0 ? (
                                      <ul className="space-y-1 text-slate-300 text-[10px]">
                                        {strengths.map((s, idx) => (
                                          <li key={`str-${idx}`} className="flex items-start gap-1.5">
                                            <span className="text-emerald-400 font-bold">•</span>
                                            <span>{s}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <div className="text-[10px] text-slate-500 italic">No exceptional clinical advantages.</div>
                                    )}
                                  </div>

                                  {/* Why Lower / Deductions */}
                                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      Why This Score Is Lower / Deductions
                                    </div>
                                    {deductions.length > 0 ? (
                                      <ul className="space-y-1 text-slate-300 text-[10px]">
                                        {deductions.map((d, idx) => (
                                          <li key={`ded-${idx}`} className="flex items-start gap-1.5">
                                            <span className="text-amber-400 font-bold">•</span>
                                            <span>{d}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <div className="text-[10px] text-emerald-400 italic">No significant clinical deductions identified.</div>
                                    )}
                                  </div>
                                </div>

                                {/* Detailed Sub-Score Pills */}
                                {evalObj && (
                                  <div className="flex items-center justify-between flex-wrap gap-1.5 pt-1 border-t border-slate-800/60 text-[10px]">
                                    <span className="text-slate-500 font-medium">Sub-Scores:</span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                      Blood: <strong className="text-slate-100">{evalObj.bloodScore}</strong>
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                      HLA: <strong className="text-slate-100">{evalObj.hlaScore}</strong>
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                      Geography: <strong className="text-slate-100">{evalObj.geographicScore}</strong>
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                      Clinical: <strong className="text-slate-100">{evalObj.clinicalScore}</strong>
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                      Urgency: <strong className="text-slate-100">{evalObj.urgencyScore}</strong>
                                    </span>
                                    <button
                                      onClick={() => {
                                        setSelectedEdgeDetails({
                                          edge: neighbor.edge,
                                          donor: donorObj!,
                                          recipient: recipientObj!,
                                          isSelectedMatch: isMatchedWithThisNode,
                                          algorithmName: activeMatchingResult.algorithm,
                                        });
                                      }}
                                      className="ml-auto px-2 py-0.5 text-[10px] font-semibold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1"
                                    >
                                      <span>Full Clinical Audit</span>
                                      <ArrowRight className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footnote Notice */}
                <div className="text-[10px] text-slate-500 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                  <strong>Notice:</strong> Graph degree reflects topological network connectivity across compatible candidates and does not imply clinical superiority. Algorithmic allocation solves for global social-welfare and network throughput, which can deliberately pair a candidate with a moderate-affinity node if it enables additional life-saving transplants across the rest of the patient registry.
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950/50 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedNodeDetails(null);
                    setExpandedCandidateId(null);
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                >
                  Close Node Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
