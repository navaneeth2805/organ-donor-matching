import React from 'react';
import { BarChart3, Download, PieChart, Activity, Layers, ShieldCheck } from 'lucide-react';
import { Donor, Hospital, Recipient } from '../types';

interface AnalyticsViewProps {
  donors: Donor[];
  recipients: Recipient[];
  hospitals: Hospital[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  donors,
  recipients,
  hospitals,
}) => {
  // Aggregate data
  const donorOrgans: Record<string, number> = {};
  donors.forEach((d) => {
    donorOrgans[d.organ] = (donorOrgans[d.organ] || 0) + 1;
  });

  const recipOrgans: Record<string, number> = {};
  recipients.forEach((r) => {
    recipOrgans[r.organNeeded] = (recipOrgans[r.organNeeded] || 0) + 1;
  });

  const donorBlood: Record<string, number> = {};
  donors.forEach((d) => {
    donorBlood[d.bloodGroup] = (donorBlood[d.bloodGroup] || 0) + 1;
  });

  const recipBlood: Record<string, number> = {};
  recipients.forEach((r) => {
    recipBlood[r.bloodGroup] = (recipBlood[r.bloodGroup] || 0) + 1;
  });

  const recipUrgency: Record<string, number> = {};
  recipients.forEach((r) => {
    recipUrgency[r.urgency] = (recipUrgency[r.urgency] || 0) + 1;
  });

  const donorAvail: Record<string, number> = {};
  donors.forEach((d) => {
    donorAvail[d.availability] = (donorAvail[d.availability] || 0) + 1;
  });

  const handleExportAnalyticsCSV = () => {
    const lines = [
      'Metric,Value',
      `Total_Donors,${donors.length}`,
      `Total_Recipients,${recipients.length}`,
      `Active_Hospitals,${hospitals.filter((h) => h.active).length}`,
      `Available_Donors,${donorAvail['Available'] || 0}`,
      `Critical_Recipients,${recipUrgency['Critical'] || 0}`,
      '',
      'Organ,Donor_Supply,Recipient_Demand',
    ];

    const allOrgans = Array.from(new Set([...Object.keys(donorOrgans), ...Object.keys(recipOrgans)])).sort();
    allOrgans.forEach((org) => {
      lines.push(`${org},${donorOrgans[org] || 0},${recipOrgans[org] || 0}`);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + lines.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `analytics_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allOrgans = Array.from(new Set([...Object.keys(donorOrgans), ...Object.keys(recipOrgans)])).sort();
  const bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-sky-400" />
            Clinical Analytics & Inventory Distribution
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated demand vs. supply ratios, ABO blood phenotype distributions, and waitlist urgency breakdowns.
          </p>
        </div>
        <button
          onClick={handleExportAnalyticsCSV}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <Download className="h-4 w-4" />
          Export Summary CSV
        </button>
      </div>

      {/* Demand vs Supply Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organ Inventory Bar Comparison */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-sky-400" />
            Organ Inventory: Donors (Supply) vs. Recipients (Demand)
          </h2>
          <div className="space-y-3.5">
            {allOrgans.map((org) => {
              const dCount = donorOrgans[org] || 0;
              const rCount = recipOrgans[org] || 0;
              const maxVal = Math.max(
                ...Object.values(donorOrgans).map(Number),
                ...Object.values(recipOrgans).map(Number),
                1
              );
              return (
                <div key={org} className="text-xs">
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span className="font-semibold text-slate-200">{org}</span>
                    <span className="text-slate-400">
                      Supply: <strong className="text-emerald-400">{dCount}</strong> | Demand:{' '}
                      <strong className="text-sky-400">{rCount}</strong>
                    </span>
                  </div>
                  <div className="flex gap-2 h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(dCount / maxVal) * 50}%` }}
                    />
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{ width: `${(rCount / maxVal) * 50}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Blood Group Distribution */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-purple-400" />
            Blood Phenotype (ABO/Rh) Distribution
          </h2>
          <div className="space-y-3.5">
            {bloodGroups.map((bg) => {
              const dCount = donorBlood[bg] || 0;
              const rCount = recipBlood[bg] || 0;
              const total = dCount + rCount;
              return (
                <div key={bg} className="text-xs">
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span className="font-mono font-bold text-slate-200">{bg}</span>
                    <span className="text-slate-400">
                      Donors: {dCount} • Recipients: {rCount} (Total: {total})
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${donors.length + recipients.length > 0 ? (total / (donors.length + recipients.length)) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Secondary Metrics: Urgency & Availability Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recipient Urgency Breakdown */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <PieChart className="h-4 w-4 text-red-400" />
            Waitlist Clinical Urgency Levels
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { level: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
              { level: 'High', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
              { level: 'Medium', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
              { level: 'Low', color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' },
            ].map(({ level, color, bg }) => (
              <div key={level} className={`p-3 rounded-lg border ${bg} text-center`}>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {level}
                </span>
                <span className={`text-2xl font-extrabold ${color} mt-1 block`}>
                  {recipUrgency[level] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Donor Availability Breakdown */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Donor Availability Statuses
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { status: 'Available', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
              { status: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
              { status: 'Unavailable', color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' },
            ].map(({ status, color, bg }) => (
              <div key={status} className={`p-3 rounded-lg border ${bg} text-center`}>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {status}
                </span>
                <span className={`text-2xl font-extrabold ${color} mt-1 block`}>
                  {donorAvail[status] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
