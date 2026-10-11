import React, { useState, useMemo } from 'react';
import { Droplet, Info, CheckCircle2, ArrowRight } from 'lucide-react';
import { BloodGroup, Donor, Recipient } from '../../types';
import { BLOOD_COMPATIBILITY_MATRIX } from '../../utils/compatibilityEngine';

interface BloodGroupNetworkVisualProps {
  donors: Donor[];
  recipients: Recipient[];
}

const BLOOD_GROUPS: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export const BloodGroupNetworkVisual: React.FC<BloodGroupNetworkVisualProps> = ({
  donors,
  recipients,
}) => {
  const [selectedBlood, setSelectedBlood] = useState<BloodGroup | null>('O-');

  // Compute counts per blood group from actual database
  const bloodStats = useMemo(() => {
    const stats: Record<BloodGroup, { donors: number; recipients: number }> = {
      'O-': { donors: 0, recipients: 0 },
      'O+': { donors: 0, recipients: 0 },
      'A-': { donors: 0, recipients: 0 },
      'A+': { donors: 0, recipients: 0 },
      'B-': { donors: 0, recipients: 0 },
      'B+': { donors: 0, recipients: 0 },
      'AB-': { donors: 0, recipients: 0 },
      'AB+': { donors: 0, recipients: 0 },
    };

    donors.forEach((d) => {
      if (stats[d.bloodGroup]) stats[d.bloodGroup].donors++;
    });

    recipients.forEach((r) => {
      if (stats[r.bloodGroup]) stats[r.bloodGroup].recipients++;
    });

    return stats;
  }, [donors, recipients]);

  // Node circular coordinates
  const cx = 160;
  const cy = 160;
  const radius = 110;

  const nodePositions = useMemo(() => {
    const map = new Map<BloodGroup, { x: number; y: number }>();
    BLOOD_GROUPS.forEach((bg, idx) => {
      const angleDeg = (idx / BLOOD_GROUPS.length) * 360 - 90; // Start at top
      const angleRad = (angleDeg * Math.PI) / 180;
      map.set(bg, {
        x: cx + radius * Math.cos(angleRad),
        y: cy + radius * Math.sin(angleRad),
      });
    });
    return map;
  }, [cx, cy, radius]);

  // Compatible links list based on BLOOD_COMPATIBILITY_MATRIX
  const compatibilityLinks = useMemo(() => {
    const links: { from: BloodGroup; to: BloodGroup }[] = [];
    BLOOD_GROUPS.forEach((from) => {
      BLOOD_GROUPS.forEach((to) => {
        if (BLOOD_COMPATIBILITY_MATRIX[from]?.[to]) {
          links.push({ from, to });
        }
      });
    });
    return links;
  }, []);

  const activeCanDonateTo = useMemo(() => {
    if (!selectedBlood) return [];
    return BLOOD_GROUPS.filter((to) => BLOOD_COMPATIBILITY_MATRIX[selectedBlood]?.[to]);
  }, [selectedBlood]);

  const activeCanReceiveFrom = useMemo(() => {
    if (!selectedBlood) return [];
    return BLOOD_GROUPS.filter((from) => BLOOD_COMPATIBILITY_MATRIX[from]?.[selectedBlood]);
  }, [selectedBlood]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <Droplet className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Blood Group Compatibility Network
            </h3>
            <p className="text-[11px] text-slate-400">
              Deterministic ABO/Rh transmission graph & bottleneck topology
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Phase 3 Immunological Matrix
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* SVG Network Visual (6 cols) */}
        <div className="lg:col-span-6 flex justify-center relative">
          <svg viewBox="0 0 320 320" className="w-full max-w-[300px] h-auto select-none">
            {/* Background orbit ring */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Compatibility Directed Edges */}
            {compatibilityLinks.map(({ from, to }) => {
              const p1 = nodePositions.get(from);
              const p2 = nodePositions.get(to);
              if (!p1 || !p2) return null;

              const isHighlighted =
                selectedBlood === from || selectedBlood === to;

              const strokeColor =
                selectedBlood === from
                  ? '#38bdf8' // Blue: can donate to
                  : selectedBlood === to
                  ? '#ec4899' // Pink: can receive from
                  : '#1e293b';

              const strokeWidth = isHighlighted ? 1.8 : 0.8;
              const opacity = isHighlighted ? 0.9 : 0.25;

              // Quadratic bezier curve slightly pulled towards center
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              const ctrlX = midX * 0.7 + cx * 0.3;
              const ctrlY = midY * 0.7 + cy * 0.3;

              return (
                <path
                  key={`${from}->${to}`}
                  d={`M ${p1.x} ${p1.y} Q ${ctrlX} ${ctrlY} ${p2.x} ${p2.y}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  className="transition-all duration-300"
                />
              );
            })}

            {/* Blood Type Nodes */}
            {BLOOD_GROUPS.map((bg) => {
              const pt = nodePositions.get(bg);
              if (!pt) return null;
              const isSelected = selectedBlood === bg;
              const isUniversalDonor = bg === 'O-';
              const isUniversalRecipient = bg === 'AB+';

              return (
                <g
                  key={bg}
                  onClick={() => setSelectedBlood(bg)}
                  className="cursor-pointer group"
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 19 : 16}
                    fill={isSelected ? '#1e293b' : '#0f172a'}
                    stroke={
                      isSelected
                        ? '#ef4444'
                        : isUniversalDonor
                        ? '#10b981'
                        : isUniversalRecipient
                        ? '#c084fc'
                        : '#334155'
                    }
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className="transition-all"
                  />
                  <text
                    x={pt.x}
                    y={pt.y + 4}
                    fill={isSelected ? '#ef4444' : '#f1f5f9'}
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="font-mono pointer-events-none"
                  >
                    {bg}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dynamic Topology & Bottleneck Inspector (6 cols) */}
        <div className="lg:col-span-6 space-y-3 text-xs">
          {selectedBlood && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-mono font-bold text-slate-200 text-sm flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  Blood Group: {selectedBlood}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {bloodStats[selectedBlood].donors} Donors • {bloodStats[selectedBlood].recipients} Patients
                </span>
              </div>

              {/* Can Donate To */}
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-sky-400 font-bold block mb-1">
                  Can Donate To ({activeCanDonateTo.length} groups):
                </span>
                <div className="flex flex-wrap gap-1 font-mono">
                  {activeCanDonateTo.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Can Receive From */}
              <div className="pt-1">
                <span className="text-[10px] uppercase font-mono tracking-wider text-pink-400 font-bold block mb-1">
                  Can Receive From ({activeCanReceiveFrom.length} groups):
                </span>
                <div className="flex flex-wrap gap-1 font-mono">
                  {activeCanReceiveFrom.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-pink-300 text-[11px]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottleneck note */}
              <div className="pt-2 text-[11px] text-slate-400 font-sans border-t border-slate-800/80">
                {selectedBlood === 'O-' ? (
                  <span className="text-emerald-400 font-semibold">
                    ★ Universal Donor: Donates to all 8 blood types. However, O- recipients can ONLY receive O- blood.
                  </span>
                ) : selectedBlood === 'AB+' ? (
                  <span className="text-purple-300 font-semibold">
                    ★ Universal Recipient: Can receive from all 8 blood types. However, AB+ can ONLY donate to AB+.
                  </span>
                ) : selectedBlood === 'O+' ? (
                  <span>
                    Rh-positive universal red cell donor subset: Compatible with all Rh+ recipients ({activeCanDonateTo.join(', ')}).
                  </span>
                ) : (
                  <span>
                    Antigen-restricted cohort: Matching bottlenecks occur when donor supply in {selectedBlood} is depleted.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick Guidance Box */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
            <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              Click any blood group node to inspect outgoing donation compatibility (blue) and incoming reception pathways (pink).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
