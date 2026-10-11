import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Activity,
  HeartHandshake,
  Calendar,
  Scale,
  Stethoscope,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
  Clock,
  Building2,
  UserPlus,
  Users,
  Ruler,
} from 'lucide-react';
import {
  BloodGroup,
  DataSourceType,
  Donor,
  DonorAvailability,
  GlucoseMeasurementType,
  Hospital,
  MedicalProfile,
  OrganSize,
  OrganType,
  Recipient,
  RecipientUrgency,
  SmokingStatus,
} from '../types';
import {
  calculateAge,
  calculateBmi,
  calculateDonorCompleteness,
  calculateRecipientCompleteness,
  calculateWaitingDuration,
} from '../utils/clinicalCalculators';

interface EnhancedRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'donor' | 'recipient';
  initialData?: Donor | Recipient | null;
  hospitals: Hospital[];
  existingDonors?: Donor[];
  existingRecipients?: Recipient[];
  onSubmitDonor?: (donor: Donor) => void;
  onSubmitRecipient?: (recipient: Recipient) => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const ORGANS: OrganType[] = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Cornea', 'Bone Marrow'];
export const ORGAN_SIZES: {
  value: OrganSize;
  label: string;
  sublabel: string;
  donorDescription: string;
  recipientDescription: string;
}[] = [
  {
    value: 'Pediatric',
    label: 'Pediatric',
    sublabel: 'Child / Infant (<40 kg)',
    donorDescription: 'Pediatric graft (<10–12 cm or low mass)',
    recipientDescription: 'Requires pediatric or small-volume graft',
  },
  {
    value: 'Small',
    label: 'Small Adult',
    sublabel: 'Petite / Lower volume (<160 cm, <55 kg)',
    donorDescription: 'Small anatomical frame graft',
    recipientDescription: 'Requires small graft to prevent compartment syndrome',
  },
  {
    value: 'Medium',
    label: 'Standard / Medium',
    sublabel: 'Standard adult frame (160–180 cm, 55–80 kg)',
    donorDescription: 'Standard adult organ dimensions',
    recipientDescription: 'Standard adult anatomical capacity',
  },
  {
    value: 'Large',
    label: 'Large Adult',
    sublabel: 'Tall / High volume (>180 cm, >80 kg)',
    donorDescription: 'High mass / high volume adult graft',
    recipientDescription: 'Requires robust large organ for metabolic demand',
  },
];
const DONOR_AVAILABILITIES: DonorAvailability[] = ['Available', 'Pending', 'Unavailable'];
const RECIPIENT_URGENCIES: RecipientUrgency[] = ['Critical', 'High', 'Medium', 'Low'];
const GLUCOSE_TYPES: GlucoseMeasurementType[] = ['Fasting', 'Random', 'Post-meal', 'Unknown'];
const SMOKING_STATUSES: SmokingStatus[] = ['Never', 'Former', 'Current', 'Unknown'];
const DATA_SOURCES: DataSourceType[] = [
  'Clinician-entered',
  'Hospital system',
  'Laboratory',
  'Self-reported',
  'Imported',
  'Unknown',
];

const PRIMARY_DIAGNOSES = [
  'End-Stage Renal Disease (ESRD)',
  'Diabetic Nephropathy',
  'Polycystic Kidney Disease',
  'End-Stage Liver Disease (Cirrhosis)',
  'Hepatocellular Carcinoma',
  'Acute Hepatic Failure',
  'Dilated Cardiomyopathy',
  'End-Stage Coronary Artery Disease',
  'Idiopathic Pulmonary Fibrosis',
  'Chronic Obstructive Pulmonary Disease (COPD)',
  'Cystic Fibrosis',
  'Type 1 Diabetes Mellitus with End-Stage Complications',
  'Corneal Dystrophy / Endothelial Failure',
  'Aplastic Anemia / Hematologic Malignancy',
  'Other Clinical Diagnosis',
];

export const EnhancedRegistrationModal: React.FC<EnhancedRegistrationModalProps> = ({
  isOpen,
  onClose,
  entityType,
  initialData,
  hospitals,
  existingDonors = [],
  existingRecipients = [],
  onSubmitDonor,
  onSubmitRecipient,
}) => {
  const isEditMode = !!initialData;
  const isDonor = entityType === 'donor';

  // Active step in smart form
  const [activeStep, setActiveStep] = useState<'form' | 'preview' | 'success'>('form');

  // Accordion Sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    matching: true,
    health: true,
    organSpecific: true,
    lifestyle: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Basic Fields
  const [formId, setFormId] = useState<number>(() => {
    if (initialData) return initialData.id;
    if (isDonor) {
      return existingDonors.length > 0 ? Math.max(...existingDonors.map((d) => d.id)) + 1 : 101;
    } else {
      return existingRecipients.length > 0 ? Math.max(...existingRecipients.map((r) => r.id)) + 1 : 201;
    }
  });
  const [name, setName] = useState(initialData?.name || '');
  const [dob, setDob] = useState(initialData?.dateOfBirth || '');
  const [age, setAge] = useState<number>(initialData?.age || (isDonor ? 30 : 45));
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [hospitalId, setHospitalId] = useState<number>(initialData?.hospitalId || hospitals[0]?.id || 1);
  const [location, setLocation] = useState(initialData?.location || 'New Delhi');

  // Matching Fields
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(initialData?.bloodGroup || 'O+');
  const [organ, setOrgan] = useState<OrganType>(
    (isDonor ? (initialData as Donor)?.organ : (initialData as Recipient)?.organNeeded) || 'Kidney'
  );
  const [availability, setAvailability] = useState<DonorAvailability>(
    (initialData as Donor)?.availability || 'Available'
  );
  const [urgency, setUrgency] = useState<RecipientUrgency>(
    (initialData as Recipient)?.urgency || 'Medium'
  );
  const [waitingListDate, setWaitingListDate] = useState<string>(
    (initialData as Recipient)?.waitingListDate || initialData?.registrationDate || new Date().toISOString().split('T')[0]
  );
  const [waitingTimeDays, setWaitingTimeDays] = useState<number>(
    (initialData as Recipient)?.waitingTimeDays || 30
  );

  // Organ Sizing Fields (Registered at registration time)
  const [organSize, setOrganSize] = useState<OrganSize>(
    ((initialData?.organSize as OrganSize) || 'Medium')
  );
  const [organDimensions, setOrganDimensions] = useState<string>(
    initialData?.organDimensions || ''
  );

  // Health Vitals (10 Medical Fields)
  const [heightCm, setHeightCm] = useState<string>(
    initialData?.heightCm ? String(initialData.heightCm) : '172'
  );
  const [weightKg, setWeightKg] = useState<string>(
    initialData?.weightKg ? String(initialData.weightKg) : '68'
  );
  const [systolicBp, setSystolicBp] = useState<string>(
    initialData?.systolicBp ? String(initialData.systolicBp) : '120'
  );
  const [diastolicBp, setDiastolicBp] = useState<string>(
    initialData?.diastolicBp ? String(initialData.diastolicBp) : '80'
  );
  const [heartRate, setHeartRate] = useState<string>(
    initialData?.heartRate ? String(initialData.heartRate) : '72'
  );
  const [bloodGlucose, setBloodGlucose] = useState<string>(
    initialData?.bloodGlucose ? String(initialData.bloodGlucose) : '95'
  );
  const [bloodGlucoseType, setBloodGlucoseType] = useState<GlucoseMeasurementType>(
    initialData?.bloodGlucoseType || 'Fasting'
  );
  const [hba1cAvailable, setHba1cAvailable] = useState<boolean>(
    initialData?.hba1c !== 'Not Available'
  );
  const [hba1c, setHba1c] = useState<string>(
    initialData?.hba1c && initialData.hba1c !== 'Not Available'
      ? String(initialData.hba1c)
      : '5.5'
  );

  // Lifestyle & Diagnosis
  const [smokingStatus, setSmokingStatus] = useState<SmokingStatus>(
    initialData?.smokingStatus || 'Never'
  );
  const [yearsSinceQuitting, setYearsSinceQuitting] = useState<string>(
    initialData?.yearsSinceQuitting ? String(initialData.yearsSinceQuitting) : ''
  );
  const [currentMedications, setCurrentMedications] = useState<string>(
    initialData?.currentMedications || 'None'
  );
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState<string>(
    (initialData as Recipient)?.primaryDiagnosis || PRIMARY_DIAGNOSES[0]
  );
  const [secondaryConditions, setSecondaryConditions] = useState<string>(
    (initialData as Recipient)?.secondaryConditions?.join(', ') || ''
  );
  const [dataSource, setDataSource] = useState<DataSourceType>('Clinician-entered');

  // Organ-Specific Conditional State
  const [creatinine, setCreatinine] = useState<string>('1.1');
  const [egfr, setEgfr] = useState<string>('92');
  const [bun, setBun] = useState<string>('16');
  const [dialysisStatus, setDialysisStatus] = useState<'Yes' | 'No' | 'Not Applicable'>('No');
  const [ecg, setEcg] = useState<string>('Normal');
  const [echocardiogram, setEchocardiogram] = useState<string>('Normal');
  const [ejectionFraction, setEjectionFraction] = useState<string>('60');
  const [ast, setAst] = useState<string>('24');
  const [alt, setAlt] = useState<string>('26');
  const [bilirubin, setBilirubin] = useState<string>('0.9');
  const [albumin, setAlbumin] = useState<string>('4.2');
  const [inr, setInr] = useState<string>('1.0');
  const [spO2, setSpO2] = useState<string>('98');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('16');
  const [pulmonaryAssessment, setPulmonaryAssessment] = useState<string>('Clear');

  // Final Confirmation & Validation State
  const [confirmedAccurate, setConfirmedAccurate] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Auto-recalculate Age whenever DOB changes
  useEffect(() => {
    if (dob) {
      const computedAge = calculateAge(dob);
      setAge(computedAge);
    }
  }, [dob]);

  // Auto-recalculate Waiting Duration whenever Waiting List Date changes
  const computedWaiting = useMemo(() => {
    return calculateWaitingDuration(waitingListDate);
  }, [waitingListDate]);

  useEffect(() => {
    if (!isDonor && computedWaiting.days >= 0) {
      setWaitingTimeDays(computedWaiting.days);
    }
  }, [computedWaiting, isDonor]);

  // Auto-calculate BMI
  const computedBmi = useMemo(() => {
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    return calculateBmi(h, w);
  }, [heightCm, weightKg]);

  // Intelligent recommendation for organ size based on anthropometric vitals
  const suggestedOrganSize = useMemo<OrganSize>(() => {
    const parsedAge = age;
    const parsedHeight = parseFloat(heightCm);
    const parsedWeight = parseFloat(weightKg);

    if (parsedAge > 0 && parsedAge < 14) return 'Pediatric';
    if (!isNaN(parsedWeight) && parsedWeight < 40) return 'Pediatric';
    if (!isNaN(parsedHeight) && parsedHeight < 158 && !isNaN(parsedWeight) && parsedWeight < 54) return 'Small';
    if ((!isNaN(parsedHeight) && parsedHeight >= 182) || (!isNaN(parsedWeight) && parsedWeight >= 85)) return 'Large';
    return 'Medium';
  }, [age, heightCm, weightKg]);

  // Build draft object for completeness calculation
  const currentDraft = useMemo(() => {
    const medProfile: MedicalProfile = {
      dateOfBirth: dob,
      age,
      heightCm: parseFloat(heightCm) || undefined,
      weightKg: parseFloat(weightKg) || undefined,
      bmi: computedBmi?.bmi,
      systolicBp: parseFloat(systolicBp) || undefined,
      diastolicBp: parseFloat(diastolicBp) || undefined,
      heartRate: parseFloat(heartRate) || undefined,
      bloodGlucose: parseFloat(bloodGlucose) || undefined,
      bloodGlucoseType,
      hba1c: hba1cAvailable ? parseFloat(hba1c) || undefined : 'Not Available',
      smokingStatus,
      yearsSinceQuitting: yearsSinceQuitting ? parseFloat(yearsSinceQuitting) : undefined,
      currentMedications,
      primaryDiagnosis: !isDonor ? primaryDiagnosis : undefined,
      secondaryConditions: !isDonor && secondaryConditions ? secondaryConditions.split(',').map((s) => s.trim()) : undefined,
      waitingListDate: !isDonor ? waitingListDate : undefined,
      dataSource,
      lastMeasurementDate: new Date().toISOString().split('T')[0],
      organSize,
      organDimensions: organDimensions.trim() || undefined,
      kidneyData: organ === 'Kidney' ? { creatinine: parseFloat(creatinine), egfr: parseFloat(egfr), bun: parseFloat(bun), dialysisStatus } : undefined,
      heartData: organ === 'Heart' ? { ecg: ecg as any, echocardiogram: echocardiogram as any, ejectionFraction: parseFloat(ejectionFraction) } : undefined,
      liverData: organ === 'Liver' ? { ast: parseFloat(ast), alt: parseFloat(alt), bilirubin: parseFloat(bilirubin), albumin: parseFloat(albumin), inr: parseFloat(inr) } : undefined,
      lungData: organ === 'Lung' ? { spO2: parseFloat(spO2), respiratoryRate: parseFloat(respiratoryRate), pulmonaryAssessment: pulmonaryAssessment as any } : undefined,
      confirmedAccurate,
    };

    if (isDonor) {
      const d: Partial<Donor> = {
        id: Number(formId),
        name: name.trim(),
        age,
        bloodGroup,
        organ,
        organSize,
        organDimensions: organDimensions.trim() || undefined,
        hospitalId: Number(hospitalId),
        location,
        availability,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        dateOfBirth: dob,
        heightCm: parseFloat(heightCm) || undefined,
        weightKg: parseFloat(weightKg) || undefined,
        bmi: computedBmi?.bmi,
        systolicBp: parseFloat(systolicBp) || undefined,
        diastolicBp: parseFloat(diastolicBp) || undefined,
        heartRate: parseFloat(heartRate) || undefined,
        bloodGlucose: parseFloat(bloodGlucose) || undefined,
        bloodGlucoseType,
        hba1c: hba1cAvailable ? parseFloat(hba1c) || undefined : 'Not Available',
        smokingStatus,
        yearsSinceQuitting: yearsSinceQuitting ? parseFloat(yearsSinceQuitting) : undefined,
        currentMedications,
        medicalProfile: medProfile,
      };
      return d;
    } else {
      const r: Partial<Recipient> = {
        id: Number(formId),
        name: name.trim(),
        age,
        bloodGroup,
        organNeeded: organ,
        organSize,
        organDimensions: organDimensions.trim() || undefined,
        hospitalId: Number(hospitalId),
        location,
        urgency,
        waitingTimeDays: computedWaiting.days,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        dateOfBirth: dob,
        heightCm: parseFloat(heightCm) || undefined,
        weightKg: parseFloat(weightKg) || undefined,
        bmi: computedBmi?.bmi,
        systolicBp: parseFloat(systolicBp) || undefined,
        diastolicBp: parseFloat(diastolicBp) || undefined,
        heartRate: parseFloat(heartRate) || undefined,
        bloodGlucose: parseFloat(bloodGlucose) || undefined,
        bloodGlucoseType,
        hba1c: hba1cAvailable ? parseFloat(hba1c) || undefined : 'Not Available',
        primaryDiagnosis,
        secondaryConditions: secondaryConditions ? secondaryConditions.split(',').map((s) => s.trim()) : undefined,
        waitingListDate,
        currentMedications,
        medicalProfile: medProfile,
      };
      return r;
    }
  }, [
    isDonor,
    formId,
    name,
    age,
    bloodGroup,
    organ,
    hospitalId,
    location,
    availability,
    urgency,
    phone,
    email,
    dob,
    heightCm,
    weightKg,
    computedBmi,
    systolicBp,
    diastolicBp,
    heartRate,
    bloodGlucose,
    bloodGlucoseType,
    hba1cAvailable,
    hba1c,
    smokingStatus,
    yearsSinceQuitting,
    currentMedications,
    primaryDiagnosis,
    secondaryConditions,
    waitingListDate,
    organSize,
    organDimensions,
    computedWaiting.days,
    dataSource,
    creatinine,
    egfr,
    bun,
    dialysisStatus,
    ecg,
    echocardiogram,
    ejectionFraction,
    ast,
    alt,
    bilirubin,
    albumin,
    inr,
    spO2,
    respiratoryRate,
    pulmonaryAssessment,
    confirmedAccurate,
  ]);

  // Completeness score
  const completeness = useMemo(() => {
    if (isDonor) {
      return calculateDonorCompleteness(currentDraft as Partial<Donor>);
    } else {
      return calculateRecipientCompleteness(currentDraft as Partial<Recipient>);
    }
  }, [isDonor, currentDraft]);

  // Validation function
  const validateForm = (): boolean => {
    setValidationError('');

    if (!name.trim() || name.trim().length < 2) {
      setValidationError('Please enter a valid full legal name (minimum 2 characters).');
      return false;
    }

    if (!formId || formId <= 0) {
      setValidationError('Please specify a valid positive numeric ID.');
      return false;
    }

    // Check duplicate ID if new record
    if (!isEditMode) {
      if (isDonor && existingDonors.some((d) => d.id === Number(formId))) {
        setValidationError(`Donor ID ${formId} already exists in registry. Please assign a unique ID.`);
        return false;
      }
      if (!isDonor && existingRecipients.some((r) => r.id === Number(formId))) {
        setValidationError(`Recipient ID ${formId} already exists on waitlist. Please assign a unique ID.`);
        return false;
      }
    }

    // Date of Birth validation
    if (dob) {
      const dobDate = new Date(dob);
      const today = new Date();
      if (dobDate > today) {
        setValidationError('Date of Birth cannot be a future date.');
        return false;
      }
      if (dobDate.getFullYear() < 1900) {
        setValidationError('Please enter a valid realistic Date of Birth.');
        return false;
      }
    }

    // Height & Weight validation
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    if (isNaN(h) || h < 40 || h > 260) {
      setValidationError('Please enter a valid height between 40 cm and 260 cm.');
      return false;
    }
    if (isNaN(w) || w < 5 || w > 350) {
      setValidationError('Please enter a valid weight between 5 kg and 350 kg.');
      return false;
    }

    // Blood Pressure validation
    const sBp = parseFloat(systolicBp);
    const dBp = parseFloat(diastolicBp);
    if (isNaN(sBp) || sBp < 60 || sBp > 260) {
      setValidationError('Please enter a valid Systolic BP between 60 and 260 mmHg.');
      return false;
    }
    if (isNaN(dBp) || dBp < 30 || dBp > 160) {
      setValidationError('Please enter a valid Diastolic BP between 30 and 160 mmHg.');
      return false;
    }

    // Heart rate
    const hr = parseFloat(heartRate);
    if (isNaN(hr) || hr < 30 || hr > 220) {
      setValidationError('Please enter a valid Heart Rate between 30 and 220 bpm.');
      return false;
    }

    // Glucose
    const glu = parseFloat(bloodGlucose);
    if (isNaN(glu) || glu < 30 || glu > 600) {
      setValidationError('Please enter a valid Blood Glucose level between 30 and 600 mg/dL.');
      return false;
    }

    // HbA1c
    if (hba1cAvailable) {
      const a1c = parseFloat(hba1c);
      if (isNaN(a1c) || a1c < 3.0 || a1c > 20.0) {
        setValidationError('Please enter a valid HbA1c percentage between 3.0% and 20.0% or select Not Available.');
        return false;
      }
    }

    // Recipient waiting list date
    if (!isDonor && waitingListDate) {
      const wDate = new Date(waitingListDate);
      if (wDate > new Date()) {
        setValidationError('Waiting list registration date cannot be a future date.');
        return false;
      }
    }

    return true;
  };

  const handleProceedToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setActiveStep('preview');
    }
  };

  const handleFinalSubmit = () => {
    if (!confirmedAccurate) {
      setValidationError('Please verify and check the confirmation box before submitting.');
      return;
    }

    if (isDonor) {
      const fullDonor: Donor = {
        ...(currentDraft as Donor),
        registrationDate: initialData?.registrationDate || new Date().toISOString().split('T')[0],
        completenessPercent: completeness.percentage,
        dataQuality: completeness.dataQuality,
      };
      if (onSubmitDonor) onSubmitDonor(fullDonor);
    } else {
      const fullRecipient: Recipient = {
        ...(currentDraft as Recipient),
        registrationDate: initialData?.registrationDate || new Date().toISOString().split('T')[0],
        completenessPercent: completeness.percentage,
        dataQuality: completeness.dataQuality,
      };
      if (onSubmitRecipient) onSubmitRecipient(fullRecipient);
    }

    setActiveStep('success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isDonor
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {isDonor ? <Users className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {isEditMode ? 'Update Clinical Record' : 'Initial Registration'}
                </span>
                <span className="text-xs text-sky-400 font-mono">
                  {isDonor ? `DONOR_D${formId}` : `RECIPIENT_R${formId}`}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 mt-0.5">
                {isEditMode
                  ? `Edit ${isDonor ? 'Donor' : 'Patient / Recipient'} Clinical Profile`
                  : isDonor
                  ? 'REGISTER DONOR'
                  : 'REGISTER PATIENT / RECIPIENT'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Profile Completeness Badge */}
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-[11px] text-slate-400 font-medium">Profile Completeness</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      completeness.percentage >= 85
                        ? 'bg-emerald-400'
                        : completeness.percentage >= 60
                        ? 'bg-sky-400'
                        : 'bg-amber-400'
                    }`}
                    style={{ width: `${completeness.percentage}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {completeness.percentage}%
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: SMART REGISTRATION FORM */}
          {activeStep === 'form' && (
            <form onSubmit={handleProceedToPreview} className="space-y-6">
              {validationError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Progress Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 border-b border-slate-800 pb-3">
                <span className="text-sky-400 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  Data Entry & Vitals
                </span>
                <span className="text-slate-600">➔</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  Clinical Review
                </span>
                <span className="text-slate-600">➔</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  Confirmation
                </span>
              </div>

              {/* SECTION 1: BASIC INFORMATION */}
              <div className="border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('basic')}
                  className="w-full px-4 py-3 bg-slate-900/80 flex items-center justify-between text-xs font-bold text-slate-200 uppercase tracking-wider hover:bg-slate-800/60 transition"
                >
                  <span className="flex items-center gap-2 text-sky-400">
                    <FileText className="h-4 w-4" />
                    ▼ Basic Identity & Demographics
                  </span>
                  {expandedSections.basic ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedSections.basic && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          {isDonor ? 'Donor ID' : 'Recipient ID'}{' '}
                          <span className="text-sky-400">*</span>
                        </label>
                        <input
                          type="number"
                          value={formId}
                          onChange={(e) => setFormId(Number(e.target.value))}
                          disabled={isEditMode}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 disabled:opacity-60 font-mono"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Full Legal Name <span className="text-sky-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Maya Krishnan"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* FIELD 1: Date of Birth & Auto Age */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Date of Birth <span className="text-slate-400 text-[11px]">(DOB)</span>
                        </label>
                        <input
                          type="date"
                          max={new Date().toISOString().split('T')[0]}
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-300">
                            Age (Years) <span className="text-sky-400">*</span>
                          </label>
                          {dob && (
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Calculated
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="115"
                          value={age}
                          onChange={(e) => setAge(Number(e.target.value))}
                          disabled={!!dob}
                          className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 ${
                            dob ? 'bg-slate-950 font-bold text-sky-400 cursor-not-allowed' : ''
                          }`}
                          required
                        />
                        {dob && (
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Derived automatically from Date of Birth
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Assigned Hospital Facility <span className="text-sky-400">*</span>
                        </label>
                        <select
                          value={hospitalId}
                          onChange={(e) => {
                            const selectedId = Number(e.target.value);
                            setHospitalId(selectedId);
                            const h = hospitals.find((item) => item.id === selectedId);
                            if (h) setLocation(h.city);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        >
                          {hospitals.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name} ({h.city})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Geographic Location / City
                        </label>
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Contact Phone <span className="text-slate-500 text-[10px]">(Optional)</span>
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98000 00000"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Contact Email <span className="text-slate-500 text-[10px]">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="donor@domain.org"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: MATCHING & ALLOCATION INFORMATION */}
              <div className="border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('matching')}
                  className="w-full px-4 py-3 bg-slate-900/80 flex items-center justify-between text-xs font-bold text-slate-200 uppercase tracking-wider hover:bg-slate-800/60 transition"
                >
                  <span className="flex items-center gap-2 text-sky-400">
                    <HeartHandshake className="h-4 w-4" />
                    ▼ Matching & Allocation Parameters
                  </span>
                  {expandedSections.matching ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedSections.matching && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Blood Group (ABO/Rh) <span className="text-sky-400">*</span>
                        </label>
                        <select
                          value={bloodGroup}
                          onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-sky-500"
                        >
                          {BLOOD_GROUPS.map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Hard compatibility constraint
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          {isDonor ? 'Procurement Organ' : 'Requested Organ'}{' '}
                          <span className="text-sky-400">*</span>
                        </label>
                        <select
                          value={organ}
                          onChange={(e) => setOrgan(e.target.value as OrganType)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-sky-500"
                        >
                          {ORGANS.map((org) => (
                            <option key={org} value={org}>
                              {org}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Triggers conditional organ assessment
                        </span>
                      </div>

                      {isDonor ? (
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Donation Availability <span className="text-sky-400">*</span>
                          </label>
                          <select
                            value={availability}
                            onChange={(e) => setAvailability(e.target.value as DonorAvailability)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                          >
                            {DONOR_AVAILABILITIES.map((av) => (
                              <option key={av} value={av}>
                                {av}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Clinical Urgency Tier <span className="text-sky-400">*</span>
                          </label>
                          <select
                            value={urgency}
                            onChange={(e) => setUrgency(e.target.value as RecipientUrgency)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-semibold"
                          >
                            {RECIPIENT_URGENCIES.map((urg) => (
                              <option key={urg} value={urg}>
                                {urg} Priority
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {!isDonor && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        {/* PATIENT FIELD 10: Waiting List Date & Duration */}
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Waiting List Registration Date <span className="text-sky-400">*</span>
                          </label>
                          <input
                            type="date"
                            max={new Date().toISOString().split('T')[0]}
                            value={waitingListDate}
                            onChange={(e) => setWaitingListDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-slate-300">
                              Calculated Waitlist Duration
                            </label>
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Calculated
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-sky-400">
                            {computedWaiting.formatted} ({computedWaiting.days} days)
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Integrated directly into candidate priority ranking
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ORGAN SIZE & ANATOMICAL CAPACITY SPECIFICATION */}
                    <div className="bg-slate-900/70 p-3.5 rounded-xl border border-purple-500/20 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <Ruler className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-100">
                                {isDonor ? 'Procurement Organ Sizing' : 'Recipient Organ Size Requirement'}
                              </span>
                              <span className="text-[10px] font-semibold text-purple-400 px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/20">
                                Matching Parameter
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              {isDonor
                                ? 'Specifies anatomical graft dimensions to prevent size mismatch and thoracic/abdominal pressure.'
                                : 'Determines anatomical cavity clearance and metabolic demand matching.'}
                            </span>
                          </div>
                        </div>

                        {/* Recommendation pill */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[11px] text-slate-400">
                            Auto-suggested: <span className="text-purple-300 font-semibold">{suggestedOrganSize}</span>
                          </span>
                          {organSize !== suggestedOrganSize && (
                            <button
                              type="button"
                              onClick={() => setOrganSize(suggestedOrganSize)}
                              className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-semibold border border-purple-500/40 transition"
                            >
                              Apply Suggested
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 4-Column Selectable Size Tier Cards */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                          Organ Size Category <span className="text-sky-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {ORGAN_SIZES.map((sz) => {
                            const isSelected = organSize === sz.value;
                            return (
                              <button
                                key={sz.value}
                                type="button"
                                onClick={() => setOrganSize(sz.value)}
                                className={`p-2.5 rounded-xl text-left border transition-all duration-150 relative flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-purple-500/15 border-purple-400 text-slate-100 shadow-sm shadow-purple-500/10'
                                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold">{sz.label}</span>
                                    <div
                                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                        isSelected
                                          ? 'border-purple-400 bg-purple-500 text-slate-950'
                                          : 'border-slate-600'
                                      }`}
                                    >
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block mt-1 leading-tight">
                                    {sz.sublabel}
                                  </span>
                                </div>
                                <span className="text-[9px] text-purple-400 font-medium mt-2 pt-1 border-t border-slate-800/80 block">
                                  {isDonor ? sz.donorDescription : sz.recipientDescription}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Optional Precise Dimensions input */}
                      <div className="pt-2 border-t border-slate-800/60">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-300">
                            Precise Anatomical Dimensions / Measured Volume <span className="text-slate-500 text-[10px]">(Optional)</span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {organ === 'Kidney'
                              ? 'Length/width in cm or weight in g'
                              : organ === 'Liver'
                              ? 'Graft weight in g or estimated volume in cc'
                              : organ === 'Heart'
                              ? 'Cardiac mass in g or thoracic diameter'
                              : organ === 'Lung'
                              ? 'Predicted TLC (Total Lung Capacity) in L'
                              : 'Quantitative dimensions'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={organDimensions}
                            onChange={(e) => setOrganDimensions(e.target.value)}
                            placeholder={
                              organ === 'Kidney'
                                ? 'e.g., 11.2 cm length × 5.8 cm width (160 g)'
                                : organ === 'Liver'
                                ? 'e.g., 1380 g graft weight (1450 cc volume)'
                                : organ === 'Heart'
                                ? 'e.g., 320 g cardiac mass, ventricular wall 11 mm'
                                : organ === 'Lung'
                                ? 'e.g., 5.4 L pTLC, 32 cm chest diameter'
                                : 'e.g., Standard anatomical dimensions'
                            }
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
                          />
                          {['Kidney', 'Liver', 'Heart', 'Lung'].includes(organ) && !organDimensions && (
                            <button
                              type="button"
                              onClick={() => {
                                if (organ === 'Kidney') setOrganDimensions(organSize === 'Small' ? '9.8 cm (130 g)' : organSize === 'Large' ? '12.4 cm (190 g)' : '11.0 cm (155 g)');
                                else if (organ === 'Liver') setOrganDimensions(organSize === 'Small' ? '1150 g' : organSize === 'Large' ? '1650 g' : '1380 g');
                                else if (organ === 'Heart') setOrganDimensions(organSize === 'Small' ? '270 g' : organSize === 'Large' ? '370 g' : '310 g');
                                else if (organ === 'Lung') setOrganDimensions(organSize === 'Small' ? '4.5 L pTLC' : organSize === 'Large' ? '6.8 L pTLC' : '5.5 L pTLC');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-[11px] font-medium border border-slate-700 whitespace-nowrap transition"
                            >
                              Insert Typical {organ} Size
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: HEALTH INFORMATION & 10 MEDICAL FIELDS */}
              <div className="border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('health')}
                  className="w-full px-4 py-3 bg-slate-900/80 flex items-center justify-between text-xs font-bold text-slate-200 uppercase tracking-wider hover:bg-slate-800/60 transition"
                >
                  <span className="flex items-center gap-2 text-emerald-400">
                    <Activity className="h-4 w-4" />
                    ▼ Basic Health & Clinical Vitals (10 Medical Fields)
                  </span>
                  {expandedSections.health ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedSections.health && (
                  <div className="p-4 space-y-4">
                    {/* Height, Weight, BMI */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* FIELD 2: Height */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Height <span className="text-slate-400 text-[11px]">(cm)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="40"
                            max="260"
                            step="0.5"
                            value={heightCm}
                            onChange={(e) => setHeightCm(e.target.value)}
                            placeholder="172"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                          />
                          <span className="absolute right-3 top-2.5 text-[11px] text-slate-500">cm</span>
                        </div>
                      </div>

                      {/* FIELD 3: Weight */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Weight <span className="text-slate-400 text-[11px]">(kg)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="5"
                            max="350"
                            step="0.5"
                            value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value)}
                            placeholder="68"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                          />
                          <span className="absolute right-3 top-2.5 text-[11px] text-slate-500">kg</span>
                        </div>
                      </div>

                      {/* FIELD 4: BMI Auto Calculated */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-300">
                            Body Mass Index (BMI)
                          </label>
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Calculated
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs flex items-center justify-between font-mono">
                          <span className="font-bold text-slate-200">
                            {computedBmi ? `${computedBmi.bmi} kg/m²` : '—'}
                          </span>
                          {computedBmi && (
                            <span className={`text-[11px] font-medium ${computedBmi.color}`}>
                              {computedBmi.category}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Weight(kg) / Height(m)²
                        </span>
                      </div>
                    </div>

                    {/* Blood Pressure & Heart Rate */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* FIELD 5: Blood Pressure */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Blood Pressure <span className="text-slate-400 text-[11px]">(Systolic / Diastolic mmHg)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <input
                              type="number"
                              min="50"
                              max="260"
                              value={systolicBp}
                              onChange={(e) => setSystolicBp(e.target.value)}
                              placeholder="120"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-12 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                            />
                            <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-500 font-mono">
                              SYS
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="30"
                              max="160"
                              value={diastolicBp}
                              onChange={(e) => setDiastolicBp(e.target.value)}
                              placeholder="80"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-12 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                            />
                            <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-500 font-mono">
                              DIA
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Recorded: {systolicBp || 120} / {diastolicBp || 80} mmHg (Clinical reference only)
                        </span>
                      </div>

                      {/* FIELD 6: Heart Rate */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Heart Rate <span className="text-slate-400 text-[11px]">(bpm)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="30"
                            max="220"
                            value={heartRate}
                            onChange={(e) => setHeartRate(e.target.value)}
                            placeholder="72"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] text-slate-500">bpm</span>
                        </div>
                      </div>
                    </div>

                    {/* Blood Glucose & HbA1c */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* FIELD 7: Blood Glucose */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Blood Glucose <span className="text-slate-400 text-[11px]">(mg/dL)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="30"
                            max="600"
                            value={bloodGlucose}
                            onChange={(e) => setBloodGlucose(e.target.value)}
                            placeholder="95"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-14 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                          />
                          <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-500 font-mono">
                            mg/dL
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Glucose Measurement Type
                        </label>
                        <select
                          value={bloodGlucoseType}
                          onChange={(e) => setBloodGlucoseType(e.target.value as GlucoseMeasurementType)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        >
                          {GLUCOSE_TYPES.map((gt) => (
                            <option key={gt} value={gt}>
                              {gt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* FIELD 8: HbA1c */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-300">
                            Glycated Hemoglobin (HbA1c)
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!hba1cAvailable}
                              onChange={(e) => setHba1cAvailable(!e.target.checked)}
                              className="rounded border-slate-700 text-sky-500 h-3 w-3 focus:ring-0"
                            />
                            <span className="text-[10px] text-slate-400">N/A</span>
                          </label>
                        </div>
                        {hba1cAvailable ? (
                          <div className="relative">
                            <input
                              type="number"
                              min="3"
                              max="20"
                              step="0.1"
                              value={hba1c}
                              onChange={(e) => setHba1c(e.target.value)}
                              placeholder="5.4"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                            />
                            <span className="absolute right-3 top-2.5 text-[11px] text-slate-500">%</span>
                          </div>
                        ) : (
                          <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono italic">
                            Not Available / Unrecorded
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: CONDITIONAL ORGAN-SPECIFIC INFORMATION */}
              <div className="border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('organSpecific')}
                  className="w-full px-4 py-3 bg-slate-900/80 flex items-center justify-between text-xs font-bold text-slate-200 uppercase tracking-wider hover:bg-slate-800/60 transition"
                >
                  <span className="flex items-center gap-2 text-purple-400">
                    <Stethoscope className="h-4 w-4" />
                    ▼ Conditional Organ Assessment: <span className="text-slate-100">{organ}</span>
                  </span>
                  {expandedSections.organSpecific ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedSections.organSpecific && (
                  <div className="p-4 space-y-4">
                    <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-center gap-2">
                      <Info className="h-4 w-4 shrink-0 text-purple-400" />
                      <span>
                        Dynamically loaded organ-specific clinical metrics for <strong>{organ}</strong> evaluation.
                      </span>
                    </div>

                    {/* KIDNEY SPECIFIC */}
                    {organ === 'Kidney' && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Serum Creatinine <span className="text-[10px] text-slate-500">(mg/dL)</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={creatinine}
                            onChange={(e) => setCreatinine(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            eGFR <span className="text-[10px] text-slate-500">(mL/min/1.73m²)</span>
                          </label>
                          <input
                            type="number"
                            value={egfr}
                            onChange={(e) => setEgfr(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            BUN <span className="text-[10px] text-slate-500">(mg/dL)</span>
                          </label>
                          <input
                            type="number"
                            value={bun}
                            onChange={(e) => setBun(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Dialysis Status
                          </label>
                          <select
                            value={dialysisStatus}
                            onChange={(e) => setDialysisStatus(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes (Active Hemodialysis)</option>
                            <option value="Not Applicable">Not Applicable</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* HEART SPECIFIC */}
                    {organ === 'Heart' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Electrocardiogram (ECG)
                          </label>
                          <select
                            value={ecg}
                            onChange={(e) => setEcg(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                          >
                            <option value="Normal">Normal Sinus Rhythm</option>
                            <option value="Sinus Bradycardia">Sinus Bradycardia</option>
                            <option value="Sinus Tachycardia">Sinus Tachycardia</option>
                            <option value="Atrial Fibrillation">Atrial Fibrillation</option>
                            <option value="Other">Other ECG Pattern</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Echocardiogram Assessment
                          </label>
                          <select
                            value={echocardiogram}
                            onChange={(e) => setEchocardiogram(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                          >
                            <option value="Normal">Normal Wall Motion</option>
                            <option value="Mild Dysfunction">Mild Dysfunction</option>
                            <option value="Moderate Dysfunction">Moderate Dysfunction</option>
                            <option value="Severe Dysfunction">Severe Dysfunction</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Ejection Fraction <span className="text-[10px] text-slate-500">(%)</span>
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="80"
                            value={ejectionFraction}
                            onChange={(e) => setEjectionFraction(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* LIVER SPECIFIC */}
                    {organ === 'Liver' && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            AST (U/L)
                          </label>
                          <input
                            type="number"
                            value={ast}
                            onChange={(e) => setAst(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            ALT (U/L)
                          </label>
                          <input
                            type="number"
                            value={alt}
                            onChange={(e) => setAlt(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Bilirubin (mg/dL)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={bilirubin}
                            onChange={(e) => setBilirubin(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Albumin (g/dL)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={albumin}
                            onChange={(e) => setAlbumin(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            INR
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={inr}
                            onChange={(e) => setInr(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* LUNG SPECIFIC */}
                    {organ === 'Lung' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            SpO2 (%)
                          </label>
                          <input
                            type="number"
                            min="60"
                            max="100"
                            value={spO2}
                            onChange={(e) => setSpO2(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Respiratory Rate (/min)
                          </label>
                          <input
                            type="number"
                            min="8"
                            max="50"
                            value={respiratoryRate}
                            onChange={(e) => setRespiratoryRate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Pulmonary Assessment
                          </label>
                          <select
                            value={pulmonaryAssessment}
                            onChange={(e) => setPulmonaryAssessment(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                          >
                            <option value="Clear">Clear to Auscultation</option>
                            <option value="Mild Impairment">Mild Impairment</option>
                            <option value="Moderate Impairment">Moderate Impairment</option>
                            <option value="Severe Impairment">Severe Impairment</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* PANCREAS, CORNEA, BONE MARROW */}
                    {['Pancreas', 'Cornea', 'Bone Marrow'].includes(organ) && (
                      <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        General histocompatibility and cellular viability assays are active for {organ}. Standard clinical profiles apply.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 5: LIFESTYLE, MEDICATIONS & DIAGNOSIS */}
              <div className="border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('lifestyle')}
                  className="w-full px-4 py-3 bg-slate-900/80 flex items-center justify-between text-xs font-bold text-slate-200 uppercase tracking-wider hover:bg-slate-800/60 transition"
                >
                  <span className="flex items-center gap-2 text-amber-400">
                    <ShieldCheck className="h-4 w-4" />
                    ▼ Medical History, Lifestyle & Medications
                  </span>
                  {expandedSections.lifestyle ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedSections.lifestyle && (
                  <div className="p-4 space-y-4">
                    {/* PATIENT FIELD 9: Diagnosis */}
                    {!isDonor && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Primary Medical Diagnosis <span className="text-sky-400">*</span>
                          </label>
                          <select
                            value={primaryDiagnosis}
                            onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                          >
                            {PRIMARY_DIAGNOSES.map((diag) => (
                              <option key={diag} value={diag}>
                                {diag}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Secondary Conditions / Comorbidities{' '}
                            <span className="text-slate-500 text-[10px]">(Comma-separated)</span>
                          </label>
                          <input
                            type="text"
                            value={secondaryConditions}
                            onChange={(e) => setSecondaryConditions(e.target.value)}
                            placeholder="e.g. Hypertension, Dyslipidemia"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                          />
                        </div>
                      </div>
                    )}

                    {/* FIELD 9: Smoking / Tobacco Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Tobacco / Smoking Status
                        </label>
                        <select
                          value={smokingStatus}
                          onChange={(e) => setSmokingStatus(e.target.value as SmokingStatus)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                        >
                          {SMOKING_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      {smokingStatus === 'Former' ? (
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Years Since Quitting
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="80"
                            value={yearsSinceQuitting}
                            onChange={(e) => setYearsSinceQuitting(e.target.value)}
                            placeholder="e.g. 5"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 flex items-center pt-5">
                          <span>Tobacco status recorded without exclusion bias.</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Clinical Data Source
                        </label>
                        <select
                          value={dataSource}
                          onChange={(e) => setDataSource(e.target.value as DataSourceType)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                        >
                          {DATA_SOURCES.map((ds) => (
                            <option key={ds} value={ds}>
                              {ds}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* FIELD 10: Current Medications */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-300">
                          Current Medications & Relevant Pharmacology
                        </label>
                        <div className="flex items-center gap-2">
                          {['None', 'Unknown', 'Not Available'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setCurrentMedications(preset)}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={currentMedications}
                        onChange={(e) => setCurrentMedications(e.target.value)}
                        placeholder="e.g. Amlodipine 5mg daily, Atorvastatin 20mg, or 'None'"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Privacy notice: Medication details are kept strictly in clinical profile and excluded from public graph visualizations.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition shadow-sm"
                >
                  <span>Review Clinical Profile</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: REGISTRATION PREVIEW & FINAL CONFIRMATION */}
          {activeStep === 'preview' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">
                      Step 2: Pre-Submission Clinical Verification
                    </span>
                    <h3 className="text-base font-bold text-slate-100 mt-0.5">
                      {isDonor ? 'DONOR REGISTRATION REVIEW' : 'PATIENT REGISTRATION REVIEW'}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Completeness</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {completeness.percentage}% ({completeness.dataQuality})
                    </span>
                  </div>
                </div>

                {/* Completeness Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Quality Index</span>
                    <span>
                      {completeness.missingRequired.length === 0
                        ? '✓ All mandatory fields satisfied'
                        : `⚠ Missing: ${completeness.missingRequired.join(', ')}`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${completeness.percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Review Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Basic & Demographics */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <h4 className="font-bold text-sky-400 uppercase tracking-wider text-[11px] border-b border-slate-800 pb-1.5">
                    Basic & Identification
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Entity ID:</span>
                    <span className="font-mono font-bold text-slate-200">
                      {isDonor ? `D${formId}` : `R${formId}`}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Legal Name:</span>
                    <span className="font-semibold text-slate-200">{name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Date of Birth:</span>
                    <span className="font-mono text-slate-200">{dob || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Age:</span>
                    <span className="font-bold text-emerald-400">
                      {age} years {dob && '(Calculated)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Hospital Facility:</span>
                    <span className="text-slate-200">
                      {hospitals.find((h) => h.id === Number(hospitalId))?.name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Location:</span>
                    <span className="text-slate-200">{location}</span>
                  </div>
                </div>

                {/* Card 2: Matching Parameters */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <h4 className="font-bold text-sky-400 uppercase tracking-wider text-[11px] border-b border-slate-800 pb-1.5">
                    Matching & Allocation
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Blood Group (ABO/Rh):</span>
                    <span className="font-mono font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                      {bloodGroup}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">{isDonor ? 'Offered Organ:' : 'Needed Organ:'}</span>
                    <span className="font-bold text-emerald-400">{organ}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">{isDonor ? 'Procured Organ Size:' : 'Required Organ Size:'}</span>
                    <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[11px] font-mono">
                        {organSize}
                      </span>
                      {organDimensions && (
                        <span className="text-slate-400 font-normal">({organDimensions})</span>
                      )}
                    </span>
                  </div>
                  {isDonor ? (
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Availability:</span>
                      <span className="font-semibold text-slate-200">{availability}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-400">Urgency Tier:</span>
                        <span className="font-bold text-amber-400">{urgency}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-400">Waitlist Registered:</span>
                        <span className="font-mono text-slate-200">{waitingListDate}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Waiting Duration:</span>
                        <span className="font-bold text-sky-400">
                          {computedWaiting.formatted} ({computedWaiting.days} days)
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Card 3: Health Vitals (10 fields) */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] border-b border-slate-800 pb-1.5">
                    Recorded Health Vitals
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Height / Weight:</span>
                    <span className="text-slate-200">
                      {heightCm} cm / {weightKg} kg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">BMI:</span>
                    <span className="font-bold text-emerald-400">
                      {computedBmi ? `${computedBmi.bmi} (${computedBmi.category})` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Blood Pressure:</span>
                    <span className="font-mono text-slate-200">
                      {systolicBp}/{diastolicBp} mmHg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Heart Rate:</span>
                    <span className="font-mono text-slate-200">{heartRate} bpm</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Blood Glucose:</span>
                    <span className="font-mono text-slate-200">
                      {bloodGlucose} mg/dL ({bloodGlucoseType})
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">HbA1c:</span>
                    <span className="font-mono text-slate-200">
                      {hba1cAvailable ? `${hba1c}%` : 'Not Available'}
                    </span>
                  </div>
                </div>

                {/* Card 4: Organ Assessment & History */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <h4 className="font-bold text-purple-400 uppercase tracking-wider text-[11px] border-b border-slate-800 pb-1.5">
                    {organ} Clinical Markers & History
                  </h4>
                  {!isDonor && (
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Primary Diagnosis:</span>
                      <span className="font-semibold text-slate-200 text-right">{primaryDiagnosis}</span>
                    </div>
                  )}
                  {organ === 'Kidney' && (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-400">Creatinine / eGFR:</span>
                        <span className="font-mono text-slate-200">
                          {creatinine} mg/dL / {egfr} mL/min
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-400">Dialysis Status:</span>
                        <span className="text-slate-200">{dialysisStatus}</span>
                      </div>
                    </>
                  )}
                  {organ === 'Heart' && (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-400">Ejection Fraction:</span>
                        <span className="font-bold text-emerald-400">{ejectionFraction}%</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900">
                        <span className="text-slate-400">ECG:</span>
                        <span className="text-slate-200">{ecg}</span>
                      </div>
                    </>
                  )}
                  {organ === 'Liver' && (
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">AST / ALT / Bili / INR:</span>
                      <span className="font-mono text-slate-200">
                        {ast} / {alt} / {bilirubin} / {inr}
                      </span>
                    </div>
                  )}
                  {organ === 'Lung' && (
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">SpO2 / RR:</span>
                      <span className="font-mono text-slate-200">
                        {spO2}% / {respiratoryRate} min
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">Smoking Status:</span>
                    <span className="text-slate-200">
                      {smokingStatus} {yearsSinceQuitting ? `(${yearsSinceQuitting} yrs quit)` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Current Medications:</span>
                    <span className="text-slate-200 truncate max-w-[180px]">
                      {currentMedications || 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* MANDATORY CONFIRMATION CHECKBOX */}
              <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-500/20 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedAccurate}
                    onChange={(e) => {
                      setConfirmedAccurate(e.target.checked);
                      setValidationError('');
                    }}
                    className="mt-0.5 rounded border-slate-700 text-sky-500 h-4 w-4 focus:ring-0"
                  />
                  <span className="text-xs text-slate-200 font-medium">
                    I confirm that the clinical and demographic information entered is accurate to the best of my knowledge.
                  </span>
                </label>
                <span className="text-[10px] text-slate-400 block ml-7">
                  Recorded under clinical decision support protocol. Algorithmic matching compatibility will be recalculated upon registry commitment.
                </span>
              </div>

              {validationError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Back and Confirm Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep('form')}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  ← Back to Edit
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition shadow-sm font-bold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirm & Save to Registry</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REGISTRATION SUCCESS PAGE */}
          {activeStep === 'success' && (
            <div className="p-6 text-center space-y-5 max-w-lg mx-auto py-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-400">
                  Registration Successful ✓
                </span>
                <h3 className="text-xl font-extrabold text-slate-100 mt-1">
                  {name}
                </h3>
                <span className="text-xs font-mono text-sky-400 block mt-0.5">
                  {isDonor ? `Donor ID: D${formId}` : `Patient ID: R${formId}`}
                </span>
                <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-mono font-bold">
                    {bloodGroup}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                    {organ}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1">
                    <Ruler className="h-3 w-3" />
                    Size: {organSize}
                  </span>
                  {organDimensions && (
                    <span className="text-[11px] font-mono text-slate-400">
                      ({organDimensions})
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Completeness</span>
                  <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                    {completeness.percentage}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Data Quality</span>
                  <span className="text-sm font-bold text-sky-400 mt-0.5 block">
                    {completeness.dataQuality}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Matching Status</span>
                  <span className="text-[11px] font-semibold text-amber-400 mt-0.5 block">
                    Pending Eval
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                The record has been committed to the secure registry and audited. Candidate compatibility relationships and bipartite graph edges are automatically updated.
              </p>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition shadow-sm"
                >
                  View in Registry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setName('');
                    setFormId((prev) => prev + 1);
                    setDob('');
                    setConfirmedAccurate(false);
                    setActiveStep('form');
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Register Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
