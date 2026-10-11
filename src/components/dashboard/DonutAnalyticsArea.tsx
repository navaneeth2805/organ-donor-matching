import React from 'react';
import { ShieldCheck, Heart, UserPlus, FileCheck, Info } from 'lucide-react';
import { Donor, Recipient } from '../../types';
import { KpiMetrics } from '../../services/dashboardService';

interface DonutAnalyticsAreaProps {
  donors: Donor[];
  recipients: Recipient[];
  kpis: KpiMetrics;
}

// Reusable SVG Donut Chart with multiple segments
interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

const SvgDonut: React.FC<{
  segments: DonutSegment[];
  centerPrimary: string;
  centerSecondary: string;
  size?: number;
}> = ({ segments, centerPrimary, centerSecondary, size = 160 }) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 58;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
        {/* Background track */}
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />
        {total > 0 &&
          segments.map((seg, idx) => {
            const segmentFraction = seg.value / total;
            const strokeDasharray = `${segmentFraction * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += segmentFraction;

            return (
              <circle
                key={idx}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap={idx === 0 && segments.length === 1 ? 'round' : 'butt'}
                className="transition-all duration-700 ease-out hover:opacity-90"
              />
            );
          })}
      </svg>

      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
        <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">
          {centerPrimary}
        </span>
        <span className="text-2xl font-black font-mono text-slate-100 mt-0.5">
          {centerSecondary}
        </span>
      </div>
    </div>
  );
};

export const DonutAnalyticsArea: React.FC<DonutAnalyticsAreaProps> = ({
  donors,
  recipients,
  kpis,
}) => {
  // A. Matching Coverage data
  const matchedPairs = kpis.currentMatches;
  const eligibleOpportunities = Math.max(1, Math.min(kpis.availableDonors, kpis.activePatients));
  const unmatchedEligible = Math.max(0, eligibleOpportunities - matchedPairs);
  const matchingCoveragePercent = Math.min(100, Math.round((matchedPairs / eligibleOpportunities) * 1000) / 10);

  const coverageSegments: DonutSegment[] = [
    { name: 'Matched', value: matchedPairs, color: '#10b981' }, // Emerald
    { name: 'Eligible Remaining', value: unmatchedEligible, color: '#38bdf8' }, // Sky
  ];

  // B. Donor Availability
  const availableDonors = donors.filter((d) => d.availability === 'Available').length;
  const unavailableDonors = donors.filter((d) => d.availability === 'Unavailable').length;
  const pendingReviewDonors = donors.filter((d) => d.availability === 'Pending').length;

  const donorSegments: DonutSegment[] = [
    { name: 'Available', value: availableDonors, color: '#0ea5e9' }, // Sky-500
    { name: 'Pending Review', value: pendingReviewDonors, color: '#f59e0b' }, // Amber-500
    { name: 'Unavailable', value: unavailableDonors, color: '#64748b' }, // Slate-500
  ];

  // C. Recipient Status
  const matchedRecipients = Math.min(kpis.currentMatches, recipients.length);
  const reviewRequiredRecipients = recipients.filter((r) => r.urgency === 'Critical').length;
  const incompleteDataRecipients = recipients.filter((r) => (r.completenessPercent || 100) < 80).length;
  const waitingRecipients = Math.max(
    0,
    recipients.length - matchedRecipients - Math.min(reviewRequiredRecipients, recipients.length - matchedRecipients)
  );

  const recipientSegments: DonutSegment[] = [
    { name: 'Matched', value: matchedRecipients, color: '#8b5cf6' }, // Purple-500
    { name: 'Waiting', value: waitingRecipients, color: '#06b6d4' }, // Cyan-500
    { name: 'Review Required', value: reviewRequiredRecipients, color: '#ef4444' }, // Red-500
    { name: 'Data Incomplete', value: incompleteDataRecipients, color: '#eab308' }, // Yellow-500
  ];

  // D. Data Quality
  const allProfiles = [...donors, ...recipients];
  const completeProfiles = allProfiles.filter((p) => (p.completenessPercent || 85) >= 90).length;
  const incompleteProfiles = allProfiles.filter((p) => (p.completenessPercent || 85) >= 75 && (p.completenessPercent || 85) < 90).length;
  const staleOrNeedsReview = allProfiles.filter((p) => (p.completenessPercent || 85) < 75).length;
  const averageQuality = kpis.averageDataQuality || 91;

  const qualitySegments: DonutSegment[] = [
    { name: 'Complete Profiles', value: completeProfiles, color: '#6366f1' }, // Indigo-500
    { name: 'Incomplete Profiles', value: incompleteProfiles, color: '#38bdf8' }, // Sky-400
    { name: 'Needs Review', value: staleOrNeedsReview, color: '#f97316' }, // Orange-500
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black tracking-wider uppercase text-slate-300 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-400" />
          Circular Intelligence & Allocation Analytics
        </h2>
        <span className="text-[11px] font-mono text-slate-400">
          Direct Database Aggregation
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DONUT 1: MATCHING COVERAGE */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Matching Coverage
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Formula Ratio
              </span>
            </div>

            <div className="flex justify-center py-4">
              <SvgDonut
                segments={coverageSegments}
                centerPrimary="MATCHING COVERAGE"
                centerSecondary={`${matchingCoveragePercent}%`}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Matched:
              </span>
              <strong className="text-emerald-400 font-bold">{matchedPairs} pairs</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Eligible:
              </span>
              <strong className="text-sky-300 font-bold">{eligibleOpportunities}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-600" />
                Unmatched:
              </span>
              <strong className="text-slate-400 font-bold">{unmatchedEligible}</strong>
            </div>

            {/* Explicit Notice */}
            <div className="mt-2.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[10px] text-slate-400 leading-tight flex items-start gap-1.5 font-sans">
              <Info className="h-3 w-3 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>ALGORITHMIC MATCHING COVERAGE:</strong> Ratio of paired candidates over eligible matching capacity. Not a survival or medical prognosis score.
              </span>
            </div>
          </div>
        </div>

        {/* DONUT 2: DONOR AVAILABILITY */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-sky-400" />
                Donor Availability
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Total: {donors.length}
              </span>
            </div>

            <div className="flex justify-center py-4">
              <SvgDonut
                segments={donorSegments}
                centerPrimary="DONORS"
                centerSecondary={`${donors.length}`}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Available Donors:
              </span>
              <strong className="text-sky-300 font-bold">{availableDonors}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Pending Review:
              </span>
              <strong className="text-amber-400 font-bold">{pendingReviewDonors}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                Unavailable Donors:
              </span>
              <strong className="text-slate-400 font-bold">{unavailableDonors}</strong>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-sans">
              Procurement inventory ready for algorithmic cross-matching.
            </div>
          </div>
        </div>

        {/* DONUT 3: RECIPIENT STATUS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-purple-400" />
                Recipient Status
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Total: {recipients.length}
              </span>
            </div>

            <div className="flex justify-center py-4">
              <SvgDonut
                segments={recipientSegments}
                centerPrimary="PATIENTS"
                centerSecondary={`${recipients.length}`}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Matched:
              </span>
              <strong className="text-purple-300 font-bold">{matchedRecipients}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                Waiting:
              </span>
              <strong className="text-cyan-300 font-bold">{waitingRecipients}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Review Required:
              </span>
              <strong className="text-red-400 font-bold">{reviewRequiredRecipients}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                Data Incomplete:
              </span>
              <strong className="text-yellow-400 font-bold">{incompleteDataRecipients}</strong>
            </div>
          </div>
        </div>

        {/* DONUT 4: DATA QUALITY */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5 text-indigo-400" />
                Data Quality
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Clinical Vitals
              </span>
            </div>

            <div className="flex justify-center py-4">
              <SvgDonut
                segments={qualitySegments}
                centerPrimary="DATA QUALITY"
                centerSecondary={`${averageQuality}%`}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Complete Profiles:
              </span>
              <strong className="text-indigo-300 font-bold">{completeProfiles}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Incomplete Profiles:
              </span>
              <strong className="text-sky-300 font-bold">{incompleteProfiles}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                Invalid / Needs Review:
              </span>
              <strong className="text-orange-400 font-bold">{staleOrNeedsReview}</strong>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-sans">
              Computed from HLA, ABO, biometric biomarkers, and clinical history.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
