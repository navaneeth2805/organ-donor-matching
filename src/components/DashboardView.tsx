import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Building2,
  GitFork,
  HeartHandshake,
  AlertTriangle,
  RefreshCw,
  Sliders,
  TrendingUp,
  Stethoscope,
} from 'lucide-react';
import { ActiveTab, BloodGroup, Donor, Hospital, OrganType, Recipient } from '../types';
import { buildCompatibilityGraph, runHopcroftKarp } from '../utils/graphAnalyticsEngine';
import {
  DashboardService,
  DashboardFilters,
  KpiMetrics,
  AttentionItem,
  AiInsight,
} from '../services/dashboardService';
import { StatusRingsBar } from './dashboard/StatusRingsBar';
import { MatchingFlowVisual } from './dashboard/MatchingFlowVisual';
import { DonutAnalyticsArea } from './dashboard/DonutAnalyticsArea';
import { RadialNetworkConnectivity } from './dashboard/RadialNetworkConnectivity';
import { AlgorithmComparisonVisual } from './dashboard/AlgorithmComparisonVisual';
import { OrganCircularAnalytics } from './dashboard/OrganCircularAnalytics';
import { BloodGroupNetworkVisual } from './dashboard/BloodGroupNetworkVisual';
import { HospitalNetworkVisual } from './dashboard/HospitalNetworkVisual';
import { AttentionRequiredSection } from './dashboard/AttentionRequiredSection';
import { AiIntelligencePanel } from './dashboard/AiIntelligencePanel';

interface DashboardViewProps {
  donors: Donor[];
  recipients: Recipient[];
  hospitals: Hospital[];
  onNavigate: (tab: ActiveTab) => void;
  onAddDonor?: (donor: Donor) => void;
  onAddRecipient?: (recipient: Recipient) => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const ORGANS: OrganType[] = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Cornea', 'Bone Marrow'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  donors,
  recipients,
  hospitals,
  onNavigate,
}) => {
  // Global Filters
  const [filters, setFilters] = useState<DashboardFilters>({
    hospitalId: 'All',
    organ: 'All',
    bloodGroup: 'All',
    urgency: 'All',
    status: 'All',
    dateRange: 'All',
  });

  // Selected matching algorithm
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<
    'cardinality' | 'weight' | 'multi-objective'
  >('cardinality');

  // Auto-refresh interval (seconds, 0 = off)
  const [refreshInterval, setRefreshInterval] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Live active');

  // Auto-refresh timer
  useEffect(() => {
    if (refreshInterval === 0) return;
    setCountdown(refreshInterval);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setLastSyncTime(new Date().toLocaleTimeString());
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refreshInterval]);

  const handleManualRefresh = () => {
    setLastSyncTime(new Date().toLocaleTimeString());
    if (refreshInterval > 0) setCountdown(refreshInterval);
  };

  // Apply filters
  const { filteredDonors, filteredRecipients } = useMemo(() => {
    return DashboardService.filterEntities(donors, recipients, filters);
  }, [donors, recipients, filters]);

  // Build live bipartite graph from filtered entities
  const graph = useMemo(() => {
    return buildCompatibilityGraph(filteredDonors, filteredRecipients, true);
  }, [filteredDonors, filteredRecipients]);

  // Algorithmic Comparison Suite
  const comparisonSummary = useMemo(() => {
    return DashboardService.computeMatchingComparison(graph);
  }, [graph]);

  // Active matching result based on selected algorithm
  const activeMatching = useMemo(() => {
    if (selectedAlgorithm === 'weight') return comparisonSummary.maxWeight;
    if (selectedAlgorithm === 'multi-objective') return comparisonSummary.multiObjective;
    return comparisonSummary.cardinality;
  }, [comparisonSummary, selectedAlgorithm]);

  // Calculate live KPIs
  const kpis = useMemo<KpiMetrics>(() => {
    return DashboardService.computeKpis(
      filteredDonors,
      filteredRecipients,
      hospitals,
      graph,
      activeMatching
    );
  }, [filteredDonors, filteredRecipients, hospitals, graph, activeMatching]);

  // AI Insights
  const aiInsights = useMemo<AiInsight[]>(() => {
    return DashboardService.generateAiInsights(
      filteredDonors,
      filteredRecipients,
      graph,
      kpis,
      comparisonSummary
    );
  }, [filteredDonors, filteredRecipients, graph, kpis, comparisonSummary]);

  // Attention & Clinical Alert Items
  const attentionItems = useMemo<AttentionItem[]>(() => {
    return DashboardService.generateAttentionItems(
      filteredDonors,
      filteredRecipients,
      graph
    );
  }, [filteredDonors, filteredRecipients, graph]);

  const handleAttentionAction = (item: AttentionItem) => {
    if (item.targetView) {
      onNavigate(item.targetView as ActiveTab);
    }
  };

  const handleAiInsightAction = (insight: AiInsight) => {
    if (insight.type === 'optimization') {
      setSelectedAlgorithm('multi-objective');
    } else if (insight.type === 'bottleneck') {
      onNavigate('recipients');
    } else {
      onNavigate('graph-analytics');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HERO COMMAND HEADER (Preserved exactly as is) */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                Transplant Network Online
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[11px] font-mono text-slate-400">
                Graph Engine <strong className="text-slate-200">v4.1</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[11px] font-mono text-slate-400">
                Rule Engine <strong className="text-slate-200">v3.2</strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-100 mt-1">
              ORGAN MATCHING INTELLIGENCE CENTER
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Real-time donor • recipient • compatibility • graph matching overview
            </p>
          </div>

          {/* Controls: Auto-refresh & Manual Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
              <RefreshCw
                className={`h-3.5 w-3.5 text-slate-400 ${
                  countdown > 0 ? 'animate-spin-slow' : ''
                }`}
              />
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-xs text-slate-200 focus:outline-none"
              >
                <option value={0}>Auto: Off</option>
                <option value={30}>Auto: 30s</option>
                <option value={60}>Auto: 1m</option>
                <option value={300}>Auto: 5m</option>
              </select>
              {refreshInterval > 0 && (
                <span className="font-mono text-emerald-400 text-[10px] ml-1">
                  ({countdown}s)
                </span>
              )}
            </div>

            <button
              onClick={handleManualRefresh}
              title="Manual Refresh"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. VISUAL STATUS RINGS RIBBON (Requirement 12) */}
      <StatusRingsBar
        kpis={kpis}
        nodeCount={graph.nodes.length}
        edgeCount={graph.edges.length}
        lastUpdated={lastSyncTime}
      />

      {/* 3. GLOBAL FILTER BAR (Preserved exactly as is) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-300 flex items-center gap-2 text-xs uppercase tracking-wider">
            <Sliders className="h-3.5 w-3.5 text-sky-400" />
            Active Filter Matrix
          </span>
          {(filters.hospitalId !== 'All' ||
            filters.organ !== 'All' ||
            filters.bloodGroup !== 'All' ||
            filters.urgency !== 'All') && (
            <button
              onClick={() =>
                setFilters({
                  hospitalId: 'All',
                  organ: 'All',
                  bloodGroup: 'All',
                  urgency: 'All',
                  status: 'All',
                  dateRange: 'All',
                })
              }
              className="text-xs text-sky-400 hover:text-sky-300 underline font-semibold"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Facility / Hospital
            </label>
            <select
              value={filters.hospitalId}
              onChange={(e) => setFilters({ ...filters, hospitalId: e.target.value })}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
            >
              <option value="All">All Hospital Facilities</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id.toString()}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Organ
            </label>
            <select
              value={filters.organ}
              onChange={(e) => setFilters({ ...filters, organ: e.target.value })}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
            >
              <option value="All">All Organs</option>
              {ORGANS.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Blood Group
            </label>
            <select
              value={filters.bloodGroup}
              onChange={(e) => setFilters({ ...filters, bloodGroup: e.target.value })}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
            >
              <option value="All">All Blood Types</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Patient Urgency
            </label>
            <select
              value={filters.urgency}
              onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
            >
              <option value="All">All Urgency Tiers</option>
              <option value="Critical">Critical Only</option>
              <option value="High">High Only</option>
              <option value="Medium">Medium Only</option>
              <option value="Low">Low Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. EIGHT COMMAND CENTER KPI CARDS (Preserved exactly as is) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Available Donors */}
        <div
          onClick={() => onNavigate('donors')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 p-3.5 rounded-xl shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Donors</span>
            <Users className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono mt-1">
            {kpis.availableDonors}
          </div>
          <span className="text-[10px] text-emerald-400 font-medium">
            {kpis.totalDonors} registered
          </span>
        </div>

        {/* 2. Active Patients */}
        <div
          onClick={() => onNavigate('recipients')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 p-3.5 rounded-xl shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Patients</span>
            <UserPlus className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono mt-1">
            {kpis.activePatients}
          </div>
          <span className="text-[10px] text-red-400 font-medium">
            {kpis.criticalPatients} critical
          </span>
        </div>

        {/* 3. Compatible Relationships */}
        <div
          onClick={() => onNavigate('compatibility')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 p-3.5 rounded-xl shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Pairs</span>
            <HeartHandshake className="h-4 w-4 text-pink-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono mt-1">
            {kpis.compatibleRelationships}
          </div>
          <span className="text-[10px] text-slate-400">Eligible edges</span>
        </div>

        {/* 4. Current Matches */}
        <div
          onClick={() => onNavigate('graph-analytics')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 p-3.5 rounded-xl shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Matches</span>
            <GitFork className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {kpis.currentMatches}
          </div>
          <span className="text-[10px] text-emerald-500 font-medium">Optimal yield</span>
        </div>

        {/* 5. Matching Coverage */}
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Coverage</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {kpis.matchingCoveragePercent}%
          </div>
          <span className="text-[10px] text-slate-400">Capacity ratio</span>
        </div>

        {/* 6. Unmatched Patients */}
        <div
          onClick={() => onNavigate('recipients')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 p-3.5 rounded-xl shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Unmatched</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {kpis.unmatchedPatients}
          </div>
          <span className="text-[10px] text-amber-500 font-medium">Waitlist demand</span>
        </div>

        {/* 7. Active Hospitals */}
        <div
          onClick={() => onNavigate('hospitals')}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 p-3.5 rounded-xl shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Centers</span>
            <Building2 className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono mt-1">
            {kpis.activeHospitals}
          </div>
          <span className="text-[10px] text-sky-400 font-medium">Facilities online</span>
        </div>

        {/* 8. Clinical Data Quality */}
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Data Quality</span>
            <Stethoscope className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400 font-mono mt-1">
            {kpis.averageDataQuality}%
          </div>
          <span className="text-[10px] text-indigo-300 font-medium">Clinical Vitals</span>
        </div>
      </div>

      {/* 5. MATCHING FLOW VISUALIZATION (Requirement 5) */}
      <MatchingFlowVisual
        totalDonorsCount={donors.length}
        filteredDonorsCount={filteredDonors.length}
        totalRecipientsCount={recipients.length}
        filteredRecipientsCount={filteredRecipients.length}
        graph={graph}
        activeMatching={activeMatching}
      />

      {/* 6. CIRCULAR / DONUT VISUALIZATION AREA (Requirement 1) */}
      <DonutAnalyticsArea
        donors={filteredDonors}
        recipients={filteredRecipients}
        kpis={kpis}
      />

      {/* 7. RADIAL NETWORK CONNECTIVITY (NETWORK HEALTH) (Requirement 3) */}
      <RadialNetworkConnectivity graph={graph} />

      {/* 9. MATCHING ALGORITHM COMPARISON (Requirement 4) */}
      <AlgorithmComparisonVisual
        summary={comparisonSummary}
        selectedAlgorithm={selectedAlgorithm}
        onSelectAlgorithm={setSelectedAlgorithm}
      />

      {/* 10. SPECIALIZED VISUALIZATIONS: ORGAN-WISE & BLOOD GROUP NETWORKS (Requirements 6 & 7) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrganCircularAnalytics
          donors={filteredDonors}
          recipients={filteredRecipients}
          activeMatching={activeMatching}
        />
        <BloodGroupNetworkVisual
          donors={filteredDonors}
          recipients={filteredRecipients}
        />
      </div>

      {/* 11. HOSPITAL NETWORK VISUALIZATION (Requirement 8) */}
      <HospitalNetworkVisual
        hospitals={hospitals}
        donors={filteredDonors}
        recipients={filteredRecipients}
        activeMatching={activeMatching}
        graph={graph}
      />

      {/* 12. CLINICAL ALERTS & AI INTELLIGENCE (Preserved supporting modules) */}
      <AttentionRequiredSection
        items={attentionItems}
        onActionClick={handleAttentionAction}
      />
      <AiIntelligencePanel
        insights={aiInsights}
        onActionClick={handleAiInsightAction}
      />
    </div>
  );
};
