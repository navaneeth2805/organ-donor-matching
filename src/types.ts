export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
export type OrganType = 'Kidney' | 'Liver' | 'Heart' | 'Lung' | 'Pancreas' | 'Cornea' | 'Bone Marrow';
export type OrganSize = 'Pediatric' | 'Small' | 'Medium' | 'Large';
export type DonorAvailability = 'Available' | 'Pending' | 'Unavailable';
export type RecipientUrgency = 'Critical' | 'High' | 'Medium' | 'Low';

export type GlucoseMeasurementType = 'Fasting' | 'Random' | 'Post-meal' | 'Unknown';
export type SmokingStatus = 'Never' | 'Former' | 'Current' | 'Unknown';
export type DataSourceType = 'Self-reported' | 'Clinician-entered' | 'Imported' | 'Laboratory' | 'Hospital system' | 'Unknown';

export interface KidneySpecificData {
  creatinine?: number; // mg/dL
  egfr?: number; // mL/min/1.73m²
  bun?: number; // mg/dL
  dialysisStatus?: 'Yes' | 'No' | 'Not Applicable';
  dialysisStartDate?: string;
}

export interface HeartSpecificData {
  ecg?: 'Normal' | 'Sinus Bradycardia' | 'Sinus Tachycardia' | 'Atrial Fibrillation' | 'Non-specific ST-T Changes' | 'Other';
  echocardiogram?: 'Normal' | 'Mild Dysfunction' | 'Moderate Dysfunction' | 'Severe Dysfunction';
  ejectionFraction?: number; // %
}

export interface LiverSpecificData {
  ast?: number; // U/L
  alt?: number; // U/L
  bilirubin?: number; // mg/dL
  albumin?: number; // g/dL
  inr?: number;
}

export interface LungSpecificData {
  spO2?: number; // %
  respiratoryRate?: number; // bpm
  pulmonaryAssessment?: 'Clear' | 'Mild Impairment' | 'Moderate Impairment' | 'Severe Impairment';
}

export interface MedicalProfile {
  dateOfBirth?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  systolicBp?: number; // mmHg
  diastolicBp?: number; // mmHg
  heartRate?: number; // bpm
  bloodGlucose?: number; // mg/dL
  bloodGlucoseType?: GlucoseMeasurementType;
  glucoseMeasurementDate?: string;
  hba1c?: number | 'Not Available';
  smokingStatus?: SmokingStatus;
  yearsSinceQuitting?: number;
  currentMedications?: string;
  primaryDiagnosis?: string;
  secondaryConditions?: string[];
  waitingListDate?: string;
  dataSource?: DataSourceType;
  lastMeasurementDate?: string;
  organSize?: OrganSize | string;
  organDimensions?: string;
  kidneyData?: KidneySpecificData;
  heartData?: HeartSpecificData;
  liverData?: LiverSpecificData;
  lungData?: LungSpecificData;
  completenessPercent?: number;
  dataQuality?: 'Excellent' | 'Good' | 'Fair' | 'Incomplete';
  confirmedAccurate?: boolean;
}

export interface Hospital {
  id: number;
  name: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export interface Donor {
  id: number;
  name: string;
  age: number;
  bloodGroup: BloodGroup;
  organ: OrganType;
  hospitalId: number;
  hospitalName?: string;
  location: string;
  availability: DonorAvailability;
  phone?: string;
  email?: string;
  registrationDate: string;
  organSize?: OrganSize | string;
  organDimensions?: string;
  // Extended Clinical & Registration Fields
  dateOfBirth?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  bloodGlucose?: number;
  bloodGlucoseType?: GlucoseMeasurementType;
  hba1c?: number | 'Not Available';
  smokingStatus?: SmokingStatus;
  yearsSinceQuitting?: number;
  currentMedications?: string;
  medicalProfile?: MedicalProfile;
  completenessPercent?: number;
  dataQuality?: 'Excellent' | 'Good' | 'Fair' | 'Incomplete';
}

export interface Recipient {
  id: number;
  name: string;
  age: number;
  bloodGroup: BloodGroup;
  organNeeded: OrganType;
  hospitalId: number;
  hospitalName?: string;
  location: string;
  urgency: RecipientUrgency;
  waitingTimeDays: number;
  phone?: string;
  email?: string;
  registrationDate: string;
  organSize?: OrganSize | string;
  organDimensions?: string;
  // Extended Clinical & Registration Fields
  dateOfBirth?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  bloodGlucose?: number;
  bloodGlucoseType?: GlucoseMeasurementType;
  hba1c?: number | 'Not Available';
  primaryDiagnosis?: string;
  secondaryConditions?: string[];
  waitingListDate?: string;
  currentMedications?: string;
  medicalProfile?: MedicalProfile;
  completenessPercent?: number;
  dataQuality?: 'Excellent' | 'Good' | 'Fair' | 'Incomplete';
}

export interface AuditLog {
  id: number | string;
  entityType: 'donor' | 'recipient' | 'hospital' | 'system';
  entityId: number | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'INITIALIZE' | 'SEED';
  details: string;
  timestamp: string;
}

export type CompatibilityStatus = 'POTENTIAL_CANDIDATE' | 'REQUIRES_REVIEW' | 'INCOMPATIBLE';

export interface RuleEvaluation {
  name: string;
  isHardConstraint: boolean;
  passed: boolean;
  severity: 'PASS' | 'WARN' | 'FAIL';
  code: string;
  message: string;
  score: number;
}

export interface RankingWeights {
  urgency: number;
  waitingTime: number;
  bloodScore: number;
  hlaScore: number;
  geographicScore: number;
  clinicalViability: number;
}

export interface CompatibilityResult {
  id: string;
  donorId: number;
  recipientId: number;
  donor: Donor;
  recipient: Recipient;
  status: CompatibilityStatus;
  overallScore: number;
  bloodScore: number;
  organScore: number;
  clinicalScore: number;
  urgencyScore: number;
  waitingTimeScore: number;
  hlaScore: number;
  geographicScore: number;
  hardFailures: string[];
  warnings: string[];
  explanations: string[];
  ruleResults: RuleEvaluation[];
  evaluatedAt: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'compatibility'
  | 'ranking'
  | 'donors'
  | 'recipients'
  | 'hospitals'
  | 'analytics'
  | 'graph-analytics'
  | 'settings';

