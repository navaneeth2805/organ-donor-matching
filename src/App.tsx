import React, { useState, useEffect } from 'react';
import {
  Activity,
  Users,
  UserPlus,
  Building2,
  BarChart3,
  Settings,
  HeartHandshake,
  CheckCircle2,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { ActiveTab, AuditLog, Donor, Hospital, Recipient } from './types';
import { INITIAL_DONORS, INITIAL_HOSPITALS, INITIAL_RECIPIENTS } from './initialData';
import { DashboardView } from './components/DashboardView';
import { CompatibilityView } from './components/CompatibilityView';
import { RankingView } from './components/RankingView';
import { DonorsView } from './components/DonorsView';
import { RecipientsView } from './components/RecipientsView';
import { HospitalsView } from './components/HospitalsView';
import { AnalyticsView } from './components/AnalyticsView';
import { GraphAnalyticsView } from './components/GraphAnalyticsView';
import { SettingsView } from './components/SettingsView';

const STORAGE_KEY_DONORS = 'organ_matching_donors_v1';
const STORAGE_KEY_RECIPIENTS = 'organ_matching_recipients_v1';
const STORAGE_KEY_HOSPITALS = 'organ_matching_hospitals_v1';
const STORAGE_KEY_LOGS = 'organ_matching_logs_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Local storage state initialization
  const [donors, setDonors] = useState<Donor[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DONORS);
    return saved ? JSON.parse(saved) : INITIAL_DONORS;
  });

  const [recipients, setRecipients] = useState<Recipient[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_RECIPIENTS);
    return saved ? JSON.parse(saved) : INITIAL_RECIPIENTS;
  });

  const [hospitals, setHospitals] = useState<Hospital[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_HOSPITALS);
    return saved ? JSON.parse(saved) : INITIAL_HOSPITALS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOGS);
    if (saved) {
      try {
        const parsed: AuditLog[] = JSON.parse(saved);
        const seen = new Set<string | number>();
        return parsed.map((log, idx) => {
          let id = log.id;
          if (!id || seen.has(id)) {
            id = `${id || 'log'}-${idx}-${Math.random().toString(36).substring(2, 8)}`;
          }
          seen.add(id);
          return { ...log, id };
        });
      } catch (e) {
        console.error('Failed to parse audit logs from localStorage', e);
      }
    }
    return [
      {
        id: 'sys-init-1',
        entityType: 'system',
        entityId: null,
        action: 'INITIALIZE',
        details: 'System database initialized with baseline medical schema',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      },
    ];
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DONORS, JSON.stringify(donors));
  }, [donors]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RECIPIENTS, JSON.stringify(recipients));
  }, [recipients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HOSPITALS, JSON.stringify(hospitals));
  }, [hospitals]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Audit Logging Helper with globally unique IDs and debounced duplicate protection
  const addLog = (
    entityType: 'donor' | 'recipient' | 'hospital' | 'system',
    entityId: number | null,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'INITIALIZE' | 'SEED',
    details: string
  ) => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newLog: AuditLog = {
      id: uniqueId,
      entityType,
      entityId,
      action,
      details,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setAuditLogs((prev) => {
      // Prevent inserting duplicate log if fired rapidly for same event
      if (
        prev.length > 0 &&
        prev[0].action === action &&
        prev[0].details === details &&
        prev[0].entityId === entityId
      ) {
        return prev;
      }
      return [newLog, ...prev];
    });
  };

  // Donor Actions
  const handleAddDonor = (newDonor: Donor) => {
    setDonors((prev) => [newDonor, ...prev]);
    addLog(
      'donor',
      newDonor.id,
      'CREATE',
      `Registered donor: ${newDonor.name}, Organ: ${newDonor.organ}, Blood: ${newDonor.bloodGroup}`
    );
  };

  const handleUpdateDonor = (updatedDonor: Donor) => {
    setDonors((prev) => prev.map((d) => (d.id === updatedDonor.id ? updatedDonor : d)));
    addLog('donor', updatedDonor.id, 'UPDATE', `Updated donor ID ${updatedDonor.id} record`);
  };

  const handleDeleteDonor = (id: number) => {
    const target = donors.find((d) => d.id === id);
    setDonors((prev) => prev.filter((d) => d.id !== id));
    addLog('donor', id, 'DELETE', `Deleted donor ID ${id} (${target?.name || 'unknown'})`);
  };

  // Recipient Actions
  const handleAddRecipient = (newRecipient: Recipient) => {
    setRecipients((prev) => [newRecipient, ...prev]);
    addLog(
      'recipient',
      newRecipient.id,
      'CREATE',
      `Registered waitlist recipient: ${newRecipient.name}, Needed: ${newRecipient.organNeeded}, Urgency: ${newRecipient.urgency}`
    );
  };

  const handleUpdateRecipient = (updatedRecipient: Recipient) => {
    setRecipients((prev) => prev.map((r) => (r.id === updatedRecipient.id ? updatedRecipient : r)));
    addLog('recipient', updatedRecipient.id, 'UPDATE', `Updated recipient ID ${updatedRecipient.id} clinical record`);
  };

  const handleDeleteRecipient = (id: number) => {
    const target = recipients.find((r) => r.id === id);
    setRecipients((prev) => prev.filter((r) => r.id !== id));
    addLog('recipient', id, 'DELETE', `Removed recipient ID ${id} (${target?.name || 'unknown'}) from waitlist`);
  };

  // Hospital Actions
  const handleAddHospital = (newHospital: Hospital) => {
    setHospitals((prev) => [...prev, newHospital]);
    addLog('hospital', newHospital.id, 'CREATE', `Registered hospital facility: ${newHospital.name}`);
  };

  const handleUpdateHospital = (updatedHospital: Hospital) => {
    setHospitals((prev) => prev.map((h) => (h.id === updatedHospital.id ? updatedHospital : h)));
    addLog('hospital', updatedHospital.id, 'UPDATE', `Updated hospital facility ID ${updatedHospital.id}`);
  };

  const handleToggleHospitalActive = (id: number) => {
    const target = hospitals.find((h) => h.id === id);
    if (!target) return;
    const newState = !target.active;
    setHospitals((prev) =>
      prev.map((h) => (h.id === id ? { ...h, active: newState } : h))
    );
    addLog(
      'hospital',
      id,
      'STATUS_CHANGE',
      `Facility ${target.name} status changed to ${newState ? 'Active' : 'Inactive'}`
    );
  };

  // Settings Actions
  const handleLoadDemoData = () => {
    setDonors(INITIAL_DONORS);
    setRecipients(INITIAL_RECIPIENTS);
    setHospitals(INITIAL_HOSPITALS);
    addLog('system', null, 'SEED', 'Loaded synthetic multi-hospital matching dataset');
  };

  const handleClearData = () => {
    setDonors([]);
    setRecipients([]);
    setHospitals([]);
    addLog('system', null, 'DELETE', 'Cleared all records from registry and waitlists');
  };

  const handleResetToDefault = () => {
    setDonors(INITIAL_DONORS);
    setRecipients(INITIAL_RECIPIENTS);
    setHospitals(INITIAL_HOSPITALS);
    addLog('system', null, 'INITIALIZE', 'Re-initialized system baseline configuration');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-sky-500 selection:text-white">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 leading-tight">Organ Matching</h2>
                <span className="text-[11px] text-sky-400 font-semibold tracking-wide uppercase">
                  Network Platform
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-snug">
              Graph Algorithms Decision-Support & Clinical Allocation System
            </p>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            <button
              id="nav-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'dashboard'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="h-4 w-4" />
              Dashboard
            </button>

            <button
              id="nav-compatibility"
              onClick={() => setActiveTab('compatibility')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'compatibility'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <HeartHandshake className="h-4 w-4" />
              Compatibility Center
            </button>

            <button
              id="nav-ranking"
              onClick={() => setActiveTab('ranking')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'ranking'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Trophy className="h-4 w-4" />
              Candidate Ranking
            </button>

            <button
              id="nav-donors"
              onClick={() => setActiveTab('donors')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'donors'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-3">
                <Users className="h-4 w-4" />
                Donors
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {donors.length}
              </span>
            </button>

            <button
              id="nav-recipients"
              onClick={() => setActiveTab('recipients')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'recipients'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-3">
                <UserPlus className="h-4 w-4" />
                Recipients
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {recipients.length}
              </span>
            </button>

            <button
              id="nav-hospitals"
              onClick={() => setActiveTab('hospitals')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'hospitals'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-3">
                <Building2 className="h-4 w-4" />
                Hospitals
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {hospitals.length}
              </span>
            </button>

            <button
              id="nav-analytics"
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </button>

            <button
              id="nav-graph-analytics"
              onClick={() => setActiveTab('graph-analytics')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'graph-analytics'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                📈 Graph Analytics
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/20">
                Network
              </span>
            </button>

            <button
              id="nav-settings"
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </nav>
        </div>

        {/* Engine Diagnostics Badge */}
        <div className="p-4 border-t border-slate-800 m-3 rounded-xl bg-slate-950 border border-slate-800/80">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-400 uppercase tracking-wider">Engine Status</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Online
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Phase 1, 2 & 3 Clinical Engine Online
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
        {activeTab === 'dashboard' && (
          <DashboardView
            donors={donors}
            recipients={recipients}
            hospitals={hospitals}
            onNavigate={(tab) => setActiveTab(tab)}
            onAddDonor={handleAddDonor}
            onAddRecipient={handleAddRecipient}
          />
        )}

        {activeTab === 'compatibility' && (
          <CompatibilityView donors={donors} recipients={recipients} />
        )}

        {activeTab === 'ranking' && (
          <RankingView donors={donors} recipients={recipients} />
        )}

        {activeTab === 'donors' && (
          <DonorsView
            donors={donors}
            hospitals={hospitals}
            onAddDonor={handleAddDonor}
            onUpdateDonor={handleUpdateDonor}
            onDeleteDonor={handleDeleteDonor}
          />
        )}

        {activeTab === 'recipients' && (
          <RecipientsView
            recipients={recipients}
            hospitals={hospitals}
            onAddRecipient={handleAddRecipient}
            onUpdateRecipient={handleUpdateRecipient}
            onDeleteRecipient={handleDeleteRecipient}
          />
        )}

        {activeTab === 'hospitals' && (
          <HospitalsView
            hospitals={hospitals}
            onAddHospital={handleAddHospital}
            onUpdateHospital={handleUpdateHospital}
            onToggleHospitalActive={handleToggleHospitalActive}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView donors={donors} recipients={recipients} hospitals={hospitals} />
        )}

        {activeTab === 'graph-analytics' && (
          <GraphAnalyticsView donors={donors} recipients={recipients} hospitals={hospitals} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            donors={donors}
            recipients={recipients}
            hospitals={hospitals}
            auditLogs={auditLogs}
            onLoadDemoData={handleLoadDemoData}
            onClearData={handleClearData}
            onResetToDefault={handleResetToDefault}
          />
        )}
      </main>
    </div>
  );
}
