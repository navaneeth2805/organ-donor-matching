import React, { useState } from 'react';
import { Settings, Database, RefreshCw, Trash2, History, AlertTriangle, CheckCircle } from 'lucide-react';
import { AuditLog, Donor, Hospital, Recipient } from '../types';

interface SettingsViewProps {
  donors: Donor[];
  recipients: Recipient[];
  hospitals: Hospital[];
  auditLogs: AuditLog[];
  onLoadDemoData: () => void;
  onClearData: () => void;
  onResetToDefault: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  donors,
  recipients,
  hospitals,
  auditLogs,
  onLoadDemoData,
  onClearData,
  onResetToDefault,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAction = (actionFn: () => void, successMsg: string) => {
    actionFn();
    setMessage(successMsg);
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
          <Settings className="h-6 w-6 text-sky-400" />
          System Settings & Audit Log
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          System diagnostics, synthetic test data generators, and immutable transaction audit trails.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {message}
        </div>
      )}

      {/* Diagnostics Grid */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Database className="h-4 w-4 text-sky-400" />
          System Diagnostics & Storage Status
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Application</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block">Organ Matching</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Engine</span>
            <span className="text-xs font-bold text-emerald-400 mt-1 block">Connected</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Donors</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block">{donors.length}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Recipients</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block">{recipients.length}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Hospitals</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block">{hospitals.length}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-medium">Audit Events</span>
            <span className="text-xs font-bold text-sky-400 mt-1 block">{auditLogs.length}</span>
          </div>
        </div>
      </div>

      {/* Database Maintenance Tools */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-sky-400" />
          Synthetic Dataset Seeding & Maintenance
        </h2>
        <p className="text-xs text-slate-400">
          Populate or reset the matching engine with representative multi-hospital clinical scenarios.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            onClick={() => handleAction(onLoadDemoData, 'Synthetic demo dataset successfully loaded into registry!')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-white transition shadow-sm"
          >
            🧪 Load Synthetic Demo Dataset
          </button>

          <button
            onClick={() => handleAction(onResetToDefault, 'Database re-initialized to initial baseline state.')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            🔄 Reset to Baseline
          </button>
        </div>

        <div className="pt-4 border-t border-slate-800/80">
          <span className="text-xs font-bold text-red-400 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Danger Zone
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmClear}
                onChange={(e) => setConfirmClear(e.target.checked)}
                className="accent-red-500 rounded"
              />
              Confirm total deletion of all registered records
            </label>
            <button
              disabled={!confirmClear}
              onClick={() => {
                handleAction(onClearData, 'All database records successfully cleared.');
                setConfirmClear(false);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition flex items-center gap-1.5 self-start"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Purge All Data
            </button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
          <strong className="text-slate-300">Notice:</strong> Synthetic demo records are generated strictly for
          educational, evaluation, and algorithmic testing purposes. No real personal health information (PHI) is ever
          stored.
        </div>
      </div>

      {/* System Audit Trail */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <History className="h-4 w-4 text-purple-400" />
            Transaction Audit Trail
          </h2>
          <span className="text-xs text-slate-400">Showing {auditLogs.length} events</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No transactions recorded in audit trail.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log, idx) => (
                  <tr key={`${log.id}-${idx}`} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{log.timestamp}</td>
                    <td className="py-2.5 px-4 uppercase font-semibold text-slate-200">
                      {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.action === 'CREATE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : log.action === 'DELETE'
                            ? 'bg-red-500/20 text-red-400'
                            : log.action === 'UPDATE'
                            ? 'bg-sky-500/20 text-sky-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 font-mono text-[11px]">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
