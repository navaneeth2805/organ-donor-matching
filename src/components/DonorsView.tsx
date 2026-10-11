import React, { useState, useMemo } from 'react';
import { UserCheck, Plus, Search, Download, Edit2, Trash2, Activity, Stethoscope } from 'lucide-react';
import { BloodGroup, Donor, DonorAvailability, Hospital, OrganType } from '../types';
import { EnhancedRegistrationModal } from './EnhancedRegistrationModal';
import { ClinicalProfileModal } from './ClinicalProfileModal';

interface DonorsViewProps {
  donors: Donor[];
  hospitals: Hospital[];
  onAddDonor: (donor: Donor) => void;
  onUpdateDonor: (donor: Donor) => void;
  onDeleteDonor: (id: number) => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const ORGANS: OrganType[] = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Cornea', 'Bone Marrow'];
const AVAILABILITIES: DonorAvailability[] = ['Available', 'Pending', 'Unavailable'];

export const DonorsView: React.FC<DonorsViewProps> = ({
  donors,
  hospitals,
  onAddDonor,
  onUpdateDonor,
  onDeleteDonor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgan, setSelectedOrgan] = useState<string>('All');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('All');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('All');
  const [selectedHospital, setSelectedHospital] = useState<string>('All');
  const [minAge, setMinAge] = useState<number>(0);
  const [maxAge, setMaxAge] = useState<number>(100);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [viewingProfileDonor, setViewingProfileDonor] = useState<Donor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Donor | null>(null);

  const hospitalMap = useMemo(() => {
    return new Map(hospitals.map((h) => [h.id, h.name]));
  }, [hospitals]);

  // Filtering & Sorting
  const filteredDonors = useMemo(() => {
    return donors.filter((d) => {
      if (selectedOrgan !== 'All' && d.organ !== selectedOrgan) return false;
      if (selectedBloodGroup !== 'All' && d.bloodGroup !== selectedBloodGroup) return false;
      if (selectedAvailability !== 'All' && d.availability !== selectedAvailability) return false;
      if (selectedHospital !== 'All' && d.hospitalId.toString() !== selectedHospital) return false;
      if (d.age < minAge || d.age > maxAge) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const hospName = hospitalMap.get(d.hospitalId)?.toLowerCase() || '';
        const match =
          d.id.toString().includes(term) ||
          d.name.toLowerCase().includes(term) ||
          d.location.toLowerCase().includes(term) ||
          hospName.includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [donors, selectedOrgan, selectedBloodGroup, selectedAvailability, selectedHospital, minAge, maxAge, searchTerm, hospitalMap]);

  const handleExportCSV = () => {
    const headers = [
      'Donor_ID',
      'Name',
      'Age',
      'DOB',
      'Blood_Group',
      'Organ',
      'Hospital',
      'Location',
      'Availability',
      'Height_cm',
      'Weight_kg',
      'BMI',
      'BP_Systolic',
      'BP_Diastolic',
      'Heart_Rate',
      'Glucose_mg_dL',
      'HbA1c',
      'Smoking_Status',
      'Medications',
      'Completeness_Percent',
      'Data_Quality',
      'Registration_Date',
    ];
    const rows = filteredDonors.map((d) => [
      d.id,
      `"${d.name}"`,
      d.age,
      d.dateOfBirth || '',
      d.bloodGroup,
      d.organ,
      `"${hospitalMap.get(d.hospitalId) || 'Unassigned'}"`,
      `"${d.location}"`,
      d.availability,
      d.heightCm || '',
      d.weightKg || '',
      d.bmi || '',
      d.systolicBp || '',
      d.diastolicBp || '',
      d.heartRate || '',
      d.bloodGlucose || '',
      d.hba1c || '',
      `"${d.smokingStatus || 'Unknown'}"`,
      `"${d.currentMedications || 'None'}"`,
      d.completenessPercent || '',
      d.dataQuality || '',
      d.registrationDate,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `donors_clinical_export_${new Date().toISOString().split('T')[0]}.csv`);
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
            <UserCheck className="h-6 w-6 text-sky-400" />
            Organ Donor Registry
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Register and manage voluntary organ donors, complete medical profiles, clinical vitals, and hospital affiliations.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            id="export-donors-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            id="add-donor-btn"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-white transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Register Donor
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
              placeholder="Search by ID, name, location, hospital..."
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
              <option value="All">All Organs</option>
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
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Availability</label>
            <select
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
              className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
            >
              <option value="All">All Statuses</option>
              {AVAILABILITIES.map((st) => (
                <option key={st} value={st}>
                  {st}
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
              Age Range: {minAge} - {maxAge} yrs
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Donors Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-300">
            Showing {filteredDonors.length} of {donors.length} registered donors
          </span>
          <span className="text-[11px] text-slate-400">
            Click any row or medical badge to view comprehensive clinical vitals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Age / DOB</th>
                <th className="py-3 px-4">Blood Group</th>
                <th className="py-3 px-4">Organ</th>
                <th className="py-3 px-4">Facility</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4">Clinical Profile & Vitals</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredDonors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No donors found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredDonors.map((d, idx) => (
                  <tr key={`${d.id}-${idx}`} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-sky-400">
                      D{d.id.toString().padStart(3, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{d.name}</div>
                      <div className="text-[11px] text-slate-400">{d.location}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-200">{d.age} yrs</span>
                      {d.dateOfBirth && (
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {d.dateOfBirth}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold border border-slate-700">
                        {d.bloodGroup}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{d.organ}</div>
                      {d.organSize && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {d.organSize}
                          </span>
                          {d.organDimensions && (
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]" title={d.organDimensions}>
                              {d.organDimensions}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{hospitalMap.get(d.hospitalId) || 'Unassigned'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          d.availability === 'Available'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : d.availability === 'Pending'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {d.availability}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setViewingProfileDonor(d)}
                        className="text-left group flex flex-col gap-0.5 p-1 -m-1 rounded hover:bg-slate-800 transition"
                        title="Click to view full medical details"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 font-mono font-semibold">
                            BMI: {d.bmi || (d.heightCm && d.weightKg ? (d.weightKg / ((d.heightCm / 100) ** 2)).toFixed(1) : '22.8')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                            BP: {d.systolicBp ? `${d.systolicBp}/${d.diastolicBp}` : '120/80'}
                          </span>
                        </div>
                        <span className="text-[10px] text-sky-400 group-hover:underline flex items-center gap-1">
                          <Activity className="h-2.5 w-2.5" />
                          View Medical Profile →
                        </span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingProfileDonor(d)}
                          className="p-1 hover:text-emerald-400 text-slate-400 transition"
                          title="View Clinical Profile"
                        >
                          <Stethoscope className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingDonor(d)}
                          className="p-1 hover:text-sky-400 text-slate-400 transition"
                          title="Edit Donor Clinical Profile"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(d)}
                          className="p-1 hover:text-red-400 text-slate-400 transition"
                          title="Delete Donor"
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
      {(showAddModal || editingDonor) && (
        <EnhancedRegistrationModal
          isOpen={showAddModal || !!editingDonor}
          onClose={() => {
            setShowAddModal(false);
            setEditingDonor(null);
          }}
          entityType="donor"
          initialData={editingDonor}
          hospitals={hospitals}
          existingDonors={donors}
          onSubmitDonor={(newOrUpdatedDonor) => {
            if (editingDonor) {
              onUpdateDonor(newOrUpdatedDonor);
              setEditingDonor(null);
            } else {
              onAddDonor(newOrUpdatedDonor);
              setShowAddModal(false);
            }
          }}
        />
      )}

      {/* Full Clinical Profile Detail Modal */}
      {viewingProfileDonor && (
        <ClinicalProfileModal
          isOpen={!!viewingProfileDonor}
          onClose={() => setViewingProfileDonor(null)}
          entity={viewingProfileDonor}
          entityType="donor"
          hospitalName={hospitalMap.get(viewingProfileDonor.hospitalId)}
          onEdit={(d) => {
            setViewingProfileDonor(null);
            setEditingDonor(d as Donor);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-100">Confirm Record Deletion</h2>
            <p className="text-xs text-slate-400 mt-2">
              Are you sure you want to permanently delete donor{' '}
              <strong className="text-slate-200">
                D{deleteTarget.id.toString().padStart(3, '0')} ({deleteTarget.name})
              </strong>
              ? This action is recorded in the immutable audit log and cannot be undone.
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
                  onDeleteDonor(deleteTarget.id);
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
