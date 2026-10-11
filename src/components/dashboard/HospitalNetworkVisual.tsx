import React, { useState, useMemo } from 'react';
import { Building2, ArrowLeftRight, Heart, Users, Award, Shield } from 'lucide-react';
import { Hospital, Donor, Recipient } from '../../types';
import { MatchingResult, BipartiteGraph } from '../../utils/graphAnalyticsEngine';

interface HospitalNetworkVisualProps {
  hospitals: Hospital[];
  donors: Donor[];
  recipients: Recipient[];
  activeMatching: MatchingResult;
  graph: BipartiteGraph;
}

export const HospitalNetworkVisual: React.FC<HospitalNetworkVisualProps> = ({
  hospitals,
  donors,
  recipients,
  activeMatching,
  graph,
}) => {
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(
    hospitals[0]?.id || null
  );

  // Compute stats per hospital
  const hospitalStats = useMemo(() => {
    return hospitals.map((h) => {
      const hDonors = donors.filter((d) => d.hospitalId === h.id);
      const hRecipients = recipients.filter((r) => r.hospitalId === h.id);

      // Matches involving this hospital
      const hMatches = activeMatching.matches.filter(
        (m) => m.donor.hospitalId === h.id || m.recipient.hospitalId === h.id
      );

      // Cross-center matches (inter-hospital logistics)
      const interMatches = hMatches.filter(
        (m) => m.donor.hospitalId !== m.recipient.hospitalId
      );

      // Intra-center matches (same hospital donor & recipient)
      const intraMatches = hMatches.filter(
        (m) => m.donor.hospitalId === m.recipient.hospitalId
      );

      // Compatibility opportunities
      const hDonorIds = new Set(hDonors.map((d) => d.id));
      const hRecipientIds = new Set(hRecipients.map((r) => r.id));
      const compatibleEdges = graph.edges.filter(
        (e) => hDonorIds.has(e.donorId) || hRecipientIds.has(e.recipientId)
      ).length;

      return {
        hospital: h,
        donorCount: hDonors.length,
        recipientCount: hRecipients.length,
        totalMatches: hMatches.length,
        interMatches: interMatches.length,
        intraMatches: intraMatches.length,
        compatibleEdges,
      };
    });
  }, [hospitals, donors, recipients, activeMatching, graph]);

  // Inter-hospital match links between hospital pairs
  const interHospitalLinks = useMemo(() => {
    const pairCounts: Record<string, number> = {};

    activeMatching.matches.forEach((m) => {
      const dH = m.donor.hospitalId;
      const rH = m.recipient.hospitalId;
      if (dH && rH && dH !== rH) {
        const key = dH < rH ? `${dH}-${rH}` : `${rH}-${dH}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    });

    return Object.entries(pairCounts).map(([key, count]) => {
      const [h1, h2] = key.split('-').map(Number);
      return { h1, h2, count };
    });
  }, [activeMatching]);

  // Selected hospital details
  const currentHospitalStat = useMemo(() => {
    return (
      hospitalStats.find((s) => s.hospital.id === selectedHospitalId) ||
      hospitalStats[0]
    );
  }, [hospitalStats, selectedHospitalId]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Hospital Center Collaborative Network
            </h3>
            <p className="text-[11px] text-slate-400">
              Procurement & allocation topology across licensed transplant medical centers
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {hospitals.length} Clinical Centers Participating
        </span>
      </div>

      {/* Grid of Hospital Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {hospitalStats.map((item) => {
          const isSelected = selectedHospitalId === item.hospital.id;
          return (
            <div
              key={item.hospital.id}
              onClick={() => setSelectedHospitalId(item.hospital.id)}
              className={`cursor-pointer rounded-xl p-3.5 border transition flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800/95 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-indigo-400">
                    ID #{item.hospital.id}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {item.hospital.city}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 mt-2 line-clamp-2 leading-snug">
                  {item.hospital.name}
                </h4>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1 text-[11px] font-mono">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Donors:</span>
                  <strong className="text-sky-300 font-bold">{item.donorCount}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Patients:</span>
                  <strong className="text-purple-300 font-bold">{item.recipientCount}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Matches:</span>
                  <strong className="text-emerald-400 font-bold">{item.totalMatches} pairs</strong>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[10px] pt-0.5">
                  <span>Edges:</span>
                  <span>{item.compatibleEdges} paths</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Hospital Detail Banner */}
      {currentHospitalStat && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-bold">
                CENTER SPECIFICATION
              </span>
              <h4 className="text-sm font-bold text-slate-100">
                {currentHospitalStat.hospital.name}
              </h4>
            </div>
            <p className="text-xs text-slate-400">
              Location: {currentHospitalStat.hospital.city}, {currentHospitalStat.hospital.state} • Accreditations: National Organ Sharing Network Node
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Intra-Hospital</span>
              <strong className="text-sm font-bold text-emerald-400">
                {currentHospitalStat.intraMatches} pairs
              </strong>
            </div>

            <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Inter-Hospital Transit</span>
              <strong className="text-sm font-bold text-sky-400">
                {currentHospitalStat.interMatches} pairs
              </strong>
            </div>

            <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block">Potential Crossings</span>
              <strong className="text-sm font-bold text-purple-400">
                {currentHospitalStat.compatibleEdges} edges
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
