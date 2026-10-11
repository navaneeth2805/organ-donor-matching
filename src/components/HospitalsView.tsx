import React, { useState, useMemo } from 'react';
import { Building2, Plus, Search, Download, Edit2, Power, X } from 'lucide-react';
import { Hospital } from '../types';

interface HospitalsViewProps {
  hospitals: Hospital[];
  onAddHospital: (hospital: Hospital) => void;
  onUpdateHospital: (hospital: Hospital) => void;
  onToggleHospitalActive: (id: number) => void;
}

export const HospitalsView: React.FC<HospitalsViewProps> = ({
  hospitals,
  onAddHospital,
  onUpdateHospital,
  onToggleHospitalActive,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formCountry, setFormCountry] = useState('India');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');

  const filteredHospitals = useMemo(() => {
    return hospitals.filter((h) => {
      if (activeOnly && !h.active) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const match =
          h.name.toLowerCase().includes(term) ||
          h.city.toLowerCase().includes(term) ||
          h.state.toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [hospitals, activeOnly, searchTerm]);

  const handleExportCSV = () => {
    const headers = ['Facility_ID', 'Name', 'City', 'State', 'Country', 'Phone', 'Email', 'Active', 'Created_At'];
    const rows = filteredHospitals.map((h) => [
      h.id,
      `"${h.name}"`,
      `"${h.city}"`,
      `"${h.state}"`,
      `"${h.country}"`,
      `"${h.phone || ''}"`,
      `"${h.email || ''}"`,
      h.active ? '1' : '0',
      h.createdAt,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hospitals_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const submitAddHospital = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim() || formName.trim().length < 3) {
      setFormError('Please enter a valid facility name (minimum 3 characters).');
      return;
    }
    if (hospitals.some((h) => h.name.toLowerCase() === formName.trim().toLowerCase())) {
      setFormError(`A hospital named "${formName.trim()}" is already registered.`);
      return;
    }

    const nextId = hospitals.length > 0 ? Math.max(...hospitals.map(h => h.id)) + 1 : 1;
    const newHosp: Hospital = {
      id: nextId,
      name: formName.trim(),
      city: formCity.trim() || 'New Delhi',
      state: formState.trim() || 'Delhi',
      country: formCountry.trim() || 'India',
      phone: formPhone.trim() || '+91 11 00000000',
      email: formEmail.trim() || 'transplant@hospital.org',
      active: formActive,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onAddHospital(newHosp);
    setShowAddModal(false);
    setFormName('');
    setFormCity('');
    setFormState('');
  };

  const submitEditHospital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHospital) return;
    onUpdateHospital(editingHospital);
    setEditingHospital(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-sky-400" />
            Hospital & Transplant Facility Directory
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Registered medical centers, authorized organ retrieval units, and transplant partner hospitals.
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
            Register Facility
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search facility by name, city, or state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer self-start sm:self-auto">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-sky-500 rounded"
          />
          Show Active Transplant Centers Only
        </label>
      </div>

      {/* Hospitals Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-300">
            Showing {filteredHospitals.length} of {hospitals.length} partner medical centers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Facility Name</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Country</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredHospitals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No hospital facilities found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredHospitals.map((h, idx) => (
                  <tr key={`${h.id}-${idx}`} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-sky-400">#{h.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-100">{h.name}</td>
                    <td className="py-3 px-4">{h.city}</td>
                    <td className="py-3 px-4 text-slate-400">{h.state}</td>
                    <td className="py-3 px-4 text-slate-400">{h.country}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{h.phone || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-400">{h.email || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          h.active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {h.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onToggleHospitalActive(h.id)}
                          className={`p-1 transition ${
                            h.active ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title={h.active ? 'Deactivate Facility' : 'Activate Facility'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingHospital(h)}
                          className="p-1 hover:text-sky-400 text-slate-400 transition"
                          title="Edit Facility"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
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

      {/* Add Hospital Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-slate-100">Register Partner Facility</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={submitAddHospital} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Facility Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Medanta The Medicity"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">City *</label>
                  <input
                    type="text"
                    placeholder="e.g. Gurugram"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">State *</label>
                  <input
                    type="text"
                    placeholder="e.g. Haryana"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Country *</label>
                  <input
                    type="text"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 ..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="transplant@center.org"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                />
              </div>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="accent-sky-500 rounded"
                />
                Mark as Active Transplant Facility
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg font-semibold"
                >
                  Register Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Hospital Modal */}
      {editingHospital && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-slate-100">Edit Facility #{editingHospital.id}</h2>
              <button onClick={() => setEditingHospital(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitEditHospital} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Facility Name *</label>
                <input
                  type="text"
                  value={editingHospital.name}
                  onChange={(e) => setEditingHospital({ ...editingHospital, name: e.target.value })}
                  required
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">City *</label>
                  <input
                    type="text"
                    value={editingHospital.city}
                    onChange={(e) => setEditingHospital({ ...editingHospital, city: e.target.value })}
                    required
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">State *</label>
                  <input
                    type="text"
                    value={editingHospital.state}
                    onChange={(e) => setEditingHospital({ ...editingHospital, state: e.target.value })}
                    required
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingHospital.phone}
                    onChange={(e) => setEditingHospital({ ...editingHospital, phone: e.target.value })}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Email</label>
                  <input
                    type="email"
                    value={editingHospital.email}
                    onChange={(e) => setEditingHospital({ ...editingHospital, email: e.target.value })}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingHospital(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
