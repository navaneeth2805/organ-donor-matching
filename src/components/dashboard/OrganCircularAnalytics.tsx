import React, { useState, useMemo } from 'react';
import { PieChart, Layers } from 'lucide-react';
import { Donor, Recipient, OrganType } from '../../types';
import { MatchingResult } from '../../utils/graphAnalyticsEngine';

interface OrganCircularAnalyticsProps {
  donors: Donor[];
  recipients: Recipient[];
  activeMatching: MatchingResult;
}

const ORGANS: OrganType[] = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Cornea', 'Bone Marrow'];

const ORGAN_COLORS: Record<OrganType, string> = {
  Kidney: '#38bdf8', // Sky
  Liver: '#f59e0b', // Amber
  Heart: '#ef4444', // Red
  Lung: '#06b6d4', // Cyan
  Pancreas: '#a855f7', // Purple
  Cornea: '#10b981', // Emerald
  'Bone Marrow': '#ec4899', // Pink
};

export const OrganCircularAnalytics: React.FC<OrganCircularAnalyticsProps> = ({
  donors,
  recipients,
  activeMatching,
}) => {
  const [activeTab, setActiveTab] = useState<'DONORS' | 'RECIPIENTS' | 'MATCHES'>('DONORS');

  const organData = useMemo(() => {
    const counts: Record<OrganType, number> = {
      Kidney: 0,
      Liver: 0,
      Heart: 0,
      Lung: 0,
      Pancreas: 0,
      Cornea: 0,
      'Bone Marrow': 0,
    };

    if (activeTab === 'DONORS') {
      donors.forEach((d) => {
        if (counts[d.organ] !== undefined) counts[d.organ]++;
      });
    } else if (activeTab === 'RECIPIENTS') {
      recipients.forEach((r) => {
        if (counts[r.organNeeded] !== undefined) counts[r.organNeeded]++;
      });
    } else {
      activeMatching.matches.forEach((m) => {
        const org = (m.donor.organ || m.recipient.organ) as OrganType;
        if (counts[org] !== undefined) counts[org]++;
      });
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return {
      counts,
      total,
      segments: ORGANS.map((org) => ({
        organ: org,
        count: counts[org],
        color: ORGAN_COLORS[org],
        percent: total > 0 ? Math.round((counts[org] / total) * 100) : 0,
      })),
    };
  }, [donors, recipients, activeMatching, activeTab]);

  // Donut circumference calculations
  const radius = 62;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  let accumulatedFraction = 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header with Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <PieChart className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Organ-Wise Circular Analytics
            </h3>
            <p className="text-[11px] text-slate-400">
              Procurement & allocation breakdown across 7 anatomical organ categories
            </p>
          </div>
        </div>

        {/* Dynamic Switcher: DONORS, RECIPIENTS, MATCHES */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          {(['DONORS', 'RECIPIENTS', 'MATCHES'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                activeTab === tab
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* SVG Donut Chart (5 cols) */}
        <div className="md:col-span-5 flex justify-center">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 170 170">
              <circle
                cx="85"
                cy="85"
                r={radius}
                fill="none"
                stroke="#1e293b"
                strokeWidth={strokeWidth}
              />
              {organData.total > 0 &&
                organData.segments.map((seg, idx) => {
                  const fraction = seg.count / organData.total;
                  if (fraction <= 0) return null;
                  const dasharray = `${fraction * circumference} ${circumference}`;
                  const dashoffset = -accumulatedFraction * circumference;
                  accumulatedFraction += fraction;

                  return (
                    <circle
                      key={idx}
                      cx="85"
                      cy="85"
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={dasharray}
                      strokeDashoffset={dashoffset}
                      className="transition-all duration-700 hover:opacity-85"
                    />
                  );
                })}
            </svg>

            {/* Donut Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
              <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">
                {activeTab}
              </span>
              <span className="text-3xl font-black font-mono text-slate-100">
                {organData.total}
              </span>
              <span className="text-[9px] text-pink-400 font-mono">UNITS</span>
            </div>
          </div>
        </div>

        {/* Breakdown Legend (7 cols) */}
        <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          {organData.segments.map((seg) => (
            <div
              key={seg.organ}
              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-[11px] font-bold text-slate-300 truncate">
                  {seg.organ}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2 pt-1 border-t border-slate-800/60">
                <span className="text-sm font-black text-slate-100">{seg.count}</span>
                <span className="text-[10px] text-slate-400">{seg.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
