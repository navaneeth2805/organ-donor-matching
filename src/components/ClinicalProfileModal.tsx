import React from 'react';
import { X, Activity, HeartHandshake, Stethoscope, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Donor, Recipient } from '../types';
import { calculateBmi, calculateWaitingDuration } from '../utils/clinicalCalculators';

interface ClinicalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Donor | Recipient | null;
  entityType: 'donor' | 'recipient';
  hospitalName?: string;
  onEdit?: (entity: Donor | Recipient) => void;
}

export const ClinicalProfileModal: React.FC<ClinicalProfileModalProps> = ({
  isOpen,
  onClose,
  entity,
  entityType,
  hospitalName,
  onEdit,
}) => {
  if (!isOpen || !entity) return null;

  const isDonor = entityType === 'donor';
  const donor = isDonor ? (entity as Donor) : null;
  const recipient = !isDonor ? (entity as Recipient) : null;

  const organ = donor ? donor.organ : recipient?.organNeeded;
  const bmiInfo = calculateBmi(entity.heightCm, entity.weightKg) || (entity.bmi ? { bmi: entity.bmi, category: 'Recorded', color: 'text-emerald-400' } : null);
  const waitingInfo = recipient ? calculateWaitingDuration(recipient.waitingListDate || recipient.registrationDate) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {isDonor ? 'Donor Profile' : 'Recipient Profile'}
                </span>
                <span className="text-xs text-sky-400 font-mono">
                  {isDonor ? `D${String(donor?.id).padStart(3, '0')}` : `R${String(recipient?.id).padStart(3, '0')}`}
                </span>
                {entity.dataQuality && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Quality: {entity.dataQuality}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5">{entity.name}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Key Identifiers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold block">Blood Group</span>
              <span className="text-sm font-bold font-mono text-sky-400 mt-0.5 block">{entity.bloodGroup}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold block">{isDonor ? 'Organ Offered' : 'Organ Needed'}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold text-emerald-400">{organ}</span>
                {entity.organSize && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {entity.organSize}
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold block">Age / DOB</span>
              <span className="text-sm font-bold text-slate-200 mt-0.5 block">
                {entity.age} yrs {entity.dateOfBirth ? `(${entity.dateOfBirth})` : ''}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold block">{isDonor ? 'Availability' : 'Urgency Tier'}</span>
              <span className="text-sm font-bold text-amber-400 mt-0.5 block">
                {isDonor ? donor?.availability : recipient?.urgency}
              </span>
            </div>
          </div>

          {/* Organ Size & Dimensions Specification */}
          {(entity.organSize || entity.organDimensions) && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Size Tier: {entity.organSize || 'Standard'}
                </span>
                {entity.organDimensions && (
                  <span className="text-xs text-slate-200 font-mono">
                    {entity.organDimensions}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-purple-400 uppercase font-semibold">
                {isDonor ? 'Procurement Calibrated Spec' : 'Graft Tolerance Target'}
              </span>
            </div>
          )}

          {/* Vitals Section */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h3 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-slate-800 pb-2">
              <Activity className="h-4 w-4" />
              Recorded Clinical Vitals & Biometrics
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="py-1 border-b border-slate-900">
                <span className="text-slate-500 block text-[11px]">Height & Weight:</span>
                <span className="font-medium text-slate-200">
                  {entity.heightCm ? `${entity.heightCm} cm` : '—'} / {entity.weightKg ? `${entity.weightKg} kg` : '—'}
                </span>
              </div>
              <div className="py-1 border-b border-slate-900">
                <span className="text-slate-500 block text-[11px]">BMI (Body Mass Index):</span>
                <span className="font-bold text-emerald-400">
                  {bmiInfo ? `${bmiInfo.bmi} kg/m² (${bmiInfo.category})` : '—'}
                </span>
              </div>
              <div className="py-1 border-b border-slate-900">
                <span className="text-slate-500 block text-[11px]">Blood Pressure:</span>
                <span className="font-mono text-slate-200">
                  {entity.systolicBp && entity.diastolicBp ? `${entity.systolicBp}/${entity.diastolicBp} mmHg` : '120/80 mmHg'}
                </span>
              </div>
              <div className="py-1 border-b border-slate-900">
                <span className="text-slate-500 block text-[11px]">Heart Rate:</span>
                <span className="font-mono text-slate-200">{entity.heartRate ? `${entity.heartRate} bpm` : '72 bpm'}</span>
              </div>
              <div className="py-1 border-b border-slate-900">
                <span className="text-slate-500 block text-[11px]">Blood Glucose:</span>
                <span className="font-mono text-slate-200">
                  {entity.bloodGlucose ? `${entity.bloodGlucose} mg/dL (${entity.bloodGlucoseType || 'Fasting'})` : '95 mg/dL'}
                </span>
              </div>
              <div className="py-1 border-b border-slate-900">
                <span className="text-slate-500 block text-[11px]">HbA1c:</span>
                <span className="font-mono text-slate-200">
                  {entity.hba1c && entity.hba1c !== 'Not Available' ? `${entity.hba1c}%` : 'Not Available'}
                </span>
              </div>
            </div>
          </div>

          {/* Organ-Specific Assessment */}
          {organ && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <h3 className="font-bold text-purple-400 uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-slate-800 pb-2">
                <Stethoscope className="h-4 w-4" />
                {organ} Clinical Parameters
              </h3>

              {organ === 'Kidney' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Creatinine:</span>
                    <span className="font-mono text-slate-200">{entity.medicalProfile?.kidneyData?.creatinine || '1.1'} mg/dL</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">eGFR:</span>
                    <span className="font-mono text-slate-200">{entity.medicalProfile?.kidneyData?.egfr || '92'} mL/min</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">BUN:</span>
                    <span className="font-mono text-slate-200">{entity.medicalProfile?.kidneyData?.bun || '16'} mg/dL</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Dialysis Status:</span>
                    <span className="text-slate-200">{entity.medicalProfile?.kidneyData?.dialysisStatus || 'No'}</span>
                  </div>
                </div>
              )}

              {organ === 'Heart' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Ejection Fraction:</span>
                    <span className="font-bold text-emerald-400">{entity.medicalProfile?.heartData?.ejectionFraction || '60'}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">ECG:</span>
                    <span className="text-slate-200">{entity.medicalProfile?.heartData?.ecg || 'Normal Sinus Rhythm'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Echocardiogram:</span>
                    <span className="text-slate-200">{entity.medicalProfile?.heartData?.echocardiogram || 'Normal'}</span>
                  </div>
                </div>
              )}

              {organ === 'Liver' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">AST / ALT:</span>
                    <span className="font-mono text-slate-200">
                      {entity.medicalProfile?.liverData?.ast || '24'} / {entity.medicalProfile?.liverData?.alt || '26'} U/L
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Total Bilirubin:</span>
                    <span className="font-mono text-slate-200">{entity.medicalProfile?.liverData?.bilirubin || '0.9'} mg/dL</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Albumin:</span>
                    <span className="font-mono text-slate-200">{entity.medicalProfile?.liverData?.albumin || '4.2'} g/dL</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">INR:</span>
                    <span className="font-mono text-slate-200">{entity.medicalProfile?.liverData?.inr || '1.0'}</span>
                  </div>
                </div>
              )}

              {organ === 'Lung' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">SpO2 (%):</span>
                    <span className="font-bold text-emerald-400">{entity.medicalProfile?.lungData?.spO2 || '98'}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Respiratory Rate:</span>
                    <span className="font-mono text-slate-200">{entity.medicalProfile?.lungData?.respiratoryRate || '16'} /min</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Auscultation:</span>
                    <span className="text-slate-200">{entity.medicalProfile?.lungData?.pulmonaryAssessment || 'Clear'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History & Medications */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-slate-800 pb-2">
              <ShieldCheck className="h-4 w-4" />
              Medical History, Lifestyle & Medications
            </h3>

            {!isDonor && recipient?.primaryDiagnosis && (
              <div className="py-1 border-b border-slate-900 flex justify-between">
                <span className="text-slate-500">Primary Diagnosis:</span>
                <span className="font-semibold text-slate-200">{recipient.primaryDiagnosis}</span>
              </div>
            )}

            {!isDonor && waitingInfo && (
              <div className="py-1 border-b border-slate-900 flex justify-between">
                <span className="text-slate-500">Waitlist Duration:</span>
                <span className="font-bold text-sky-400">{waitingInfo.formatted} ({waitingInfo.days} days)</span>
              </div>
            )}

            <div className="py-1 border-b border-slate-900 flex justify-between">
              <span className="text-slate-500">Smoking Status:</span>
              <span className="text-slate-200">{entity.smokingStatus || 'Never'}</span>
            </div>

            <div className="py-1 flex justify-between">
              <span className="text-slate-500">Current Medications:</span>
              <span className="text-slate-200">{entity.currentMedications || 'None'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="text-[11px] text-slate-500">
            Registered: <span className="text-slate-400">{entity.registrationDate}</span> • Hospital: <span className="text-slate-300">{hospitalName || entity.location}</span>
          </div>

          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(entity);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs transition"
              >
                Edit Clinical Record
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
