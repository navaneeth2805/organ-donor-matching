import React, { useState, useMemo } from 'react';
import { UserPlus, Plus, Search, Download, Edit2, Trash2, Clock, AlertCircle, Activity, Stethoscope } from 'lucide-react';
import { BloodGroup, Hospital, OrganType, Recipient, RecipientUrgency } from '../types';
import { EnhancedRegistrationModal } from './EnhancedRegistrationModal';
import { ClinicalProfileModal } from './ClinicalProfileModal';

interface RecipientsViewProps {
  recipients: Recipient[];
  hospitals: Hospital[];
  onAddRecipient: (recipient: Recipient) => void;
  onUpdateRecipient: (recipient: Recipient) => void;
  onDeleteRecipient: (id: number) => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const ORGANS: OrganType[] = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Cornea', 'Bone Marrow'];
const URGENCIES: RecipientUrgency[] = ['Critical', 'High', 'Medium', 'Low'];

export const RecipientsView: React.FC<RecipientsViewProps> = ({
  recipients,
  hospitals,
  onAddRecipient,
  onUpdateRecipient,
  onDeleteRecipient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgan, setSelectedOrgan] = useState<string>('All');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('All');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('All');
  const [selectedHospital, setSelectedHospital] = useState<string>('All');
  const [minWaitTime, setMinWaitTime] = useState<number>(0);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [viewingProfileRecipient, setViewingProfileRecipient] = useState<Recipient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipient | null>(null);

  const hospitalMap = useMemo(() => {
    return new Map(hospitals.map((h) => [h.id, h.name]));
  }, [hospitals]);

  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      if (selectedOrgan !== 'All' && r.organNeeded !== selectedOrgan) return false;
      if (selectedBloodGroup !== 'All' && r.bloodGroup !== selectedBloodGroup) return false;
      if (selectedUrgency !== 'All' && r.urgency !== selectedUrgency) return false;
      if (selectedHospital !== 'All' && r.hospitalId.toString() !== selectedHospital) return false;
      if (r.waitingTimeDays < minWaitTime) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const hospName = hospitalMap.get(r.hospitalId)?.toLowerCase() || '';
        const match =
          r.id.toString().includes(term) ||
          r.name.toLowerCase().includes(term) ||
          r.location.toLowerCase().includes(term) ||
          (r.primaryDiagnosis && r.primaryDiagnosis.toLowerCase().includes(term)) ||
          hospName.includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [recipients, selectedOrgan, selectedBloodGroup, selectedUrgency, selectedHospital, minWaitTime, searchTerm, hospitalMap]);

  const handleExportCSV = () => {
    const headers = [
      'Recipient_ID',
      'Name',
      'Age',
      'DOB',
      'Blood_Group',
      'Organ_Needed',
      'Hospital',
      'Location',
      'Urgency',
      'Waiting_Time_Days',
      'Primary_Diagnosis',
      'Height_cm',
      'Weight_kg',
      'BMI',
      'BP_Systolic',
      'BP_Diastolic',
      'Heart_Rate',
      'Glucose_mg_dL',
      'HbA1c',
      'Medications',
      'Completeness_Percent',
      'Data_Quality',
      'Registration_Date',
    ];
    const rows = filteredRecipients.map((r) => [
      r.id,
      `"${r.name}"`,
      r.age,
      r.dateOfBirth || '',
      r.bloodGroup,
      r.organNeeded,
      `"${hospitalMap.get(r.hospitalId) || 'Unassigned'}"`,
      `"${r.location}"`,
      r.urgency,
      r.waitingTimeDays,
      `"${r.primaryDiagnosis || 'Unspecified'}"`,
      r.heightCm || '',
      r.weightKg || '',
      r.bmi || '',
      r.systolicBp || '',
      r.diastolicBp || '',
      r.heartRate || '',
      r.bloodGlucose || '',
      r.hba1c || '',
      `"${r.currentMedications || 'None'}"`,
      r.completenessPercent || '',
      r.dataQuality || '',
      r.registrationDate,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `recipients_clinical_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <AlertCircle className="h-6 w-6 text-sky-400" />
            Organ Recipient Waitlist
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Prioritize patients based on urgency, complete clinical profiles, calculated wait times, and compatibility factors.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-white transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Register Patient
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative col-span-1 md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, name, diagnosis, location, hospital..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <select
              value={selectedOrgan}
              onChange={(e) => setSelectedOrgan(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="All">All Needed Organs</option>
              {ORGANS.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedBloodGroup}
              onChange={(e) => setSelectedBloodGroup(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="All">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Clinical Urgency</label>
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
            >
              <option value="All">All Urgency Tiers</option>
              {URGENCIES.map((urg) => (
                <option key={urg} value={urg}>
                  {urg} Priority
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Affiliated Hospital</label>
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
            >
              <option value="All">All Facilities</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id.toString()}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Minimum Wait Time: {minWaitTime} days
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="730"
                step="30"
                value={minWaitTime}
                onChange={(e) => setMinWaitTime(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recipients Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-300">
            Showing {filteredRecipients.length} of {recipients.length} waitlisted patients
          </span>
          <span className="text-[11px] text-slate-400">
            Click medical badge or row to view clinical diagnosis and vitals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Age / DOB</th>
                <th className="py-3 px-4">Blood Group</th>
                <th className="py-3 px-4">Needed Organ</th>
                <th className="py-3 px-4">Facility</th>
                <th className="py-3 px-4">Urgency</th>
                <th className="py-3 px-4">Wait Time</th>
                <th className="py-3 px-4">Clinical Diagnosis & Vitals</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No recipients found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((r, idx) => (
                  <tr key={`${r.id}-${idx}`} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-sky-400">
                      R{r.id.toString().padStart(3, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{r.name}</div>
                      <div className="text-[11px] text-slate-400">{r.location}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-200">{r.age} yrs</span>
                      {r.dateOfBirth && (
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {r.dateOfBirth}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold border border-slate-700">
                        {r.bloodGroup}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{r.organNeeded}</div>
                      {r.organSize && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {r.organSize}
                          </span>
                          {r.organDimensions && (
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]" title={r.organDimensions}>
                              {r.organDimensions}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{hospitalMap.get(r.hospitalId) || 'Unassigned'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          r.urgency === 'Critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                            : r.urgency === 'High'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : r.urgency === 'Medium'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {r.urgency}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-200">{r.waitingTimeDays} days</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setViewingProfileRecipient(r)}
                        className="text-left group flex flex-col gap-0.5 p-1 -m-1 rounded hover:bg-slate-800 transition max-w-[200px]"
                        title="Click to view full medical details"
                      >
                        <span className="text-[11px] font-medium text-slate-200 truncate block">
                          {r.primaryDiagnosis || 'Chronic Organ Failure'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 font-mono">
                            BMI: {r.bmi || (r.heightCm && r.weightKg ? (r.weightKg / ((r.heightCm / 100) ** 2)).toFixed(1) : '24.1')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                            BP: {r.systolicBp ? `${r.systolicBp}/${r.diastolicBp}` : '124/82'}
                          </span>
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingProfileRecipient(r)}
                          className="p-1 hover:text-emerald-400 text-slate-400 transition"
                          title="View Clinical Profile"
                        >
                          <Stethoscope className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingRecipient(r)}
                          className="p-1 hover:text-sky-400 text-slate-400 transition"
                          title="Edit Patient Clinical Profile"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-1 hover:text-red-400 text-slate-400 transition"
                          title="Delete Patient"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enhanced Registration / Edit Modal */}
      {(showAddModal || editingRecipient) && (
        <EnhancedRegistrationModal
          isOpen={showAddModal || !!editingRecipient}
          onClose={() => {
            setShowAddModal(false);
            setEditingRecipient(null);
          }}
          entityType="recipient"
          initialData={editingRecipient}
          hospitals={hospitals}
          existingRecipients={recipients}
          onSubmitRecipient={(newOrUpdatedRecipient) => {
            if (editingRecipient) {
              onUpdateRecipient(newOrUpdatedRecipient);
              setEditingRecipient(null);
            } else {
              onAddRecipient(newOrUpdatedRecipient);
              setShowAddModal(false);
            }
          }}
        />
      )}

      {/* Full Clinical Profile Detail Modal */}
      {viewingProfileRecipient && (
        <ClinicalProfileModal
          isOpen={!!viewingProfileRecipient}
          onClose={() => setViewingProfileRecipient(null)}
          entity={viewingProfileRecipient}
          entityType="recipient"
          hospitalName={hospitalMap.get(viewingProfileRecipient.hospitalId)}
          onEdit={(r) => {
            setViewingProfileRecipient(null);
            setEditingRecipient(r as Recipient);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-100">Confirm Patient Removal</h2>
            <p className="text-xs text-slate-400 mt-2">
              Are you sure you want to permanently remove patient{' '}
              <strong className="text-slate-200">
                R{deleteTarget.id.toString().padStart(3, '0')} ({deleteTarget.name})
              </strong>{' '}
              from the active transplant waitlist? This action is recorded in the immutable audit log and cannot be undone.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteRecipient(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
