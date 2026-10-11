import React, { useState, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HeartHandshake,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Stethoscope,
  Info,
  Layers,
  Search,
} from 'lucide-react';
import { Donor, Recipient } from '../types';
import {
  evaluatePair,
  checkBloodCompatibility,
  BLOOD_COMPATIBILITY_MATRIX,
  DEFAULT_RANKING_WEIGHTS,
} from '../utils/compatibilityEngine';

interface CompatibilityViewProps {
  donors: Donor[];
  recipients: Recipient[];
}

export const CompatibilityView: React.FC<CompatibilityViewProps> = ({ donors, recipients }) => {
  const [selectedDonorId, setSelectedDonorId] = useState<number>(donors[0]?.id || 0);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number>(recipients[0]?.id || 0);
  const [showMatrixModal, setShowMatrixModal] = useState<boolean>(false);
  const [donorFilter, setDonorFilter] = useState<string>('');
  const [recipFilter, setRecipFilter] = useState<string>('');

  const selectedDonor = donors.find((d) => d.id === selectedDonorId) || donors[0];
  const selectedRecipient = recipients.find((r) => r.id === selectedRecipientId) || recipients[0];

  const evaluation = useMemo(() => {
    if (!selectedDonor || !selectedRecipient) return null;
    return evaluatePair(selectedDonor, selectedRecipient, DEFAULT_RANKING_WEIGHTS);
  }, [selectedDonor, selectedRecipient]);

  // Find all compatible recipients for this donor
  const compatibleRecipients = useMemo(() => {
    if (!selectedDonor) return [];
    return recipients.filter((r) => {
      const res = evaluatePair(selectedDonor, r, DEFAULT_RANKING_WEIGHTS);
      return res.status !== 'INCOMPATIBLE';
    });
  }, [selectedDonor, recipients]);

  // Find all compatible donors for this recipient
  const compatibleDonors = useMemo(() => {
    if (!selectedRecipient) return [];
    return donors.filter((d) => {
      const res = evaluatePair(d, selectedRecipient, DEFAULT_RANKING_WEIGHTS);
      return res.status !== 'INCOMPATIBLE';
    });
  }, [selectedRecipient, donors]);

  const filteredDonors = donors.filter(
    (d) =>
      d.name.toLowerCase().includes(donorFilter.toLowerCase()) ||
      d.organ.toLowerCase().includes(donorFilter.toLowerCase()) ||
      d.bloodGroup.toLowerCase().includes(donorFilter.toLowerCase())
  );

  const filteredRecipients = recipients.filter(
    (r) =>
      r.name.toLowerCase().includes(recipFilter.toLowerCase()) ||
      r.organNeeded.toLowerCase().includes(recipFilter.toLowerCase()) ||
      r.bloodGroup.toLowerCase().includes(recipFilter.toLowerCase())
  );

  const bloodGroups = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wide">
              Phase 3 Clinical Decision Support
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5 mt-1.5">
            <HeartHandshake className="h-6 w-6 text-sky-400" />
            Compatibility Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic two-tiered pair evaluation: Hard constraint validation followed by multi-criteria clinical scoring.
          </p>
        </div>

        <button
          onClick={() => setShowMatrixModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <Layers className="h-4 w-4 text-sky-400" />
          View 64-Combo Blood Matrix
        </button>
      </div>

      {/* Selector Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donor Selector Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Donor Candidate</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {compatibleRecipients.length} Compatible Recipient(s)
            </span>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter donors by name, organ, or blood group..."
                value={donorFilter}
                onChange={(e) => setDonorFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={selectedDonor?.id}
              onChange={(e) => setSelectedDonorId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
            >
              {filteredDonors.map((d, idx) => (
                <option key={`${d.id}-${idx}`} value={d.id}>
                  #{d.id} • {d.name} ({d.age}y) — {d.organ} [{d.bloodGroup}] — {d.availability} ({d.location})
                </option>
              ))}
            </select>
          </div>

          {selectedDonor && (
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Organ Offered</span>
                <p className="font-bold text-slate-100 mt-0.5">{selectedDonor.organ}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Blood Group</span>
                <p className="font-bold text-sky-400 font-mono mt-0.5">{selectedDonor.bloodGroup}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Location / Age</span>
                <p className="font-medium text-slate-200 mt-0.5">{selectedDonor.location} • {selectedDonor.age}y</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Procurement</span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-semibold ${
                    selectedDonor.availability === 'Available'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {selectedDonor.availability}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recipient Selector Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Recipient Candidate</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {compatibleDonors.length} Compatible Donor(s)
            </span>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter recipients by name, organ, or blood group..."
                value={recipFilter}
                onChange={(e) => setRecipFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={selectedRecipient?.id}
              onChange={(e) => setSelectedRecipientId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
            >
              {filteredRecipients.map((r, idx) => (
                <option key={`${r.id}-${idx}`} value={r.id}>
                  #{r.id} • {r.name} ({r.age}y) — Needs {r.organNeeded} [{r.bloodGroup}] — Tier: {r.urgency} ({r.waitingTimeDays}d)
                </option>
              ))}
            </select>
          </div>

          {selectedRecipient && (
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Organ Needed</span>
                <p className="font-bold text-slate-100 mt-0.5">{selectedRecipient.organNeeded}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Blood Group</span>
                <p className="font-bold text-sky-400 font-mono mt-0.5">{selectedRecipient.bloodGroup}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Wait Time</span>
                <p className="font-medium text-slate-200 mt-0.5">{selectedRecipient.waitingTimeDays} days</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Urgency Tier</span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-semibold ${
                    selectedRecipient.urgency === 'Critical'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : selectedRecipient.urgency === 'High'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  }`}
                >
                  {selectedRecipient.urgency}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evaluation Results Banner */}
      {evaluation && (
        <div
          className={`rounded-xl border p-5 transition ${
            evaluation.status === 'POTENTIAL_CANDIDATE'
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : evaluation.status === 'REQUIRES_REVIEW'
              ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
              : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-xl ${
                  evaluation.status === 'POTENTIAL_CANDIDATE'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : evaluation.status === 'REQUIRES_REVIEW'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {evaluation.status === 'POTENTIAL_CANDIDATE' ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : evaluation.status === 'REQUIRES_REVIEW' ? (
                  <AlertTriangle className="h-7 w-7" />
                ) : (
                  <XCircle className="h-7 w-7" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pair Evaluation Outcome
                </span>
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  {evaluation.status.replace(/_/g, ' ')}
                  <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-900 border border-slate-700 text-slate-300">
                    Pair Score: {evaluation.overallScore.toFixed(1)} / 100
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  {evaluation.explanations[0]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Blood Rule</span>
                <span className={`text-xs font-bold ${evaluation.bloodScore > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {evaluation.bloodScore > 0 ? 'Compatible' : 'Incompatible'}
                </span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Organ Match</span>
                <span className={`text-xs font-bold ${evaluation.organScore > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {evaluation.organScore > 0 ? 'Exact Match' : 'Mismatch'}
                </span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">HLA Index</span>
                <span className="text-xs font-bold text-sky-400 font-mono">
                  {evaluation.hlaScore}/100
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Component Score Breakdown */}
      {evaluation && evaluation.status !== 'INCOMPATIBLE' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Activity className="h-4 w-4 text-sky-400" />
              Multi-Criteria Scoring Breakdown
            </h2>
            <span className="text-xs text-slate-400 font-medium">Weighted Composite Engine</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">ABO / Rh Blood Harmony</span>
                <span className="font-bold text-emerald-400 font-mono">{evaluation.bloodScore} / 100</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${evaluation.bloodScore}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                {selectedDonor.bloodGroup} ➔ {selectedRecipient.bloodGroup} (UNOS Cross-Matching)
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">HLA Histocompatibility</span>
                <span className="font-bold text-sky-400 font-mono">{evaluation.hlaScore} / 100</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full"
                  style={{ width: `${evaluation.hlaScore}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                Estimated Loci Match across HLA-A, B, C, DR, DQ
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Clinical Urgency Priority</span>
                <span className="font-bold text-amber-400 font-mono">{evaluation.urgencyScore} / 100</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${evaluation.urgencyScore}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                Waitlist Tier: {selectedRecipient.urgency} Priority
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Waitlist Tenure</span>
                <span className="font-bold text-purple-400 font-mono">{evaluation.waitingTimeScore} / 100</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${evaluation.waitingTimeScore}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                {selectedRecipient.waitingTimeDays} active waitlist days
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Logistical Proximity</span>
                <span className="font-bold text-teal-400 font-mono">{evaluation.geographicScore} / 100</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full"
                  style={{ width: `${evaluation.geographicScore}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                {selectedDonor.location} ➔ {selectedRecipient.location}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Clinical Viability & Parity</span>
                <span className="font-bold text-indigo-400 font-mono">{evaluation.clinicalScore} / 100</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${evaluation.clinicalScore}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                Age delta: {Math.abs(selectedDonor.age - selectedRecipient.age)} years
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Rule Execution Checklist */}
      {evaluation && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Clinical Rule Engine Verification Audit
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {evaluation.ruleResults.filter((r) => r.passed).length} / {evaluation.ruleResults.length} Rules Passed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Rule / Constraint</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Clinical Finding</th>
                  <th className="px-4 py-2.5 text-right">Component Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {evaluation.ruleResults.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-2.5 font-semibold text-slate-100">{r.name}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          r.isHardConstraint
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {r.isHardConstraint ? 'Hard Rule' : 'Soft Rule'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.severity === 'PASS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : r.severity === 'WARN'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {r.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-400 text-[11px]">{r.code}</td>
                    <td className="px-4 py-2.5 text-slate-300 max-w-md">{r.message}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-200">
                      {r.score.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 64-Combination Blood Compatibility Reference Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers className="h-5 w-5 text-sky-400" />
                64-Combination ABO & Rh Compatibility Matrix
              </h3>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="text-slate-400 hover:text-slate-100 text-xs px-2 py-1 rounded bg-slate-800"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Rows indicate donor blood groups; columns indicate recipient blood groups. Green cells indicate permissible matches under clinical guidelines. O- is the universal red cell donor; AB+ is the universal recipient.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs text-slate-300 border border-slate-800">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="p-2 text-left font-bold text-sky-400">Donor \ Recipient</th>
                    {bloodGroups.map((bg) => (
                      <th key={bg} className="p-2 font-mono text-slate-200">
                        {bg}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bloodGroups.map((donorBg) => (
                    <tr key={donorBg} className="hover:bg-slate-800/30">
                      <td className="p-2 font-bold font-mono text-left bg-slate-950/60 text-slate-200">
                        {donorBg}
                      </td>
                      {bloodGroups.map((recipBg) => {
                        const isMatch = checkBloodCompatibility(donorBg, recipBg);
                        return (
                          <td
                            key={recipBg}
                            className={`p-2 font-semibold font-mono ${
                              isMatch ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-600'
                            }`}
                          >
                            {isMatch ? '✓' : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 text-slate-400">
              <span>Standard Red Blood Cell & Solid Organ Transfusion Rules</span>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
