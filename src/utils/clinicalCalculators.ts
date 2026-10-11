import { Donor, Recipient, OrganType } from '../types';

/**
 * Calculates accurate age from a Date of Birth string (YYYY-MM-DD).
 * Returns NaN or -1 if invalid or future date.
 */
export function calculateAge(dobString: string): number {
  if (!dobString) return 0;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Calculates BMI from height in cm and weight in kg.
 * Formula: BMI = Weight(kg) / (Height(m))^2
 */
export function calculateBmi(
  heightCm?: number,
  weightKg?: number
): { bmi: number; category: string; color: string } | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  const rawBmi = weightKg / (heightM * heightM);
  const bmi = Math.round(rawBmi * 10) / 10;

  let category = 'Normal weight';
  let color = 'text-emerald-400';

  if (bmi < 18.5) {
    category = 'Underweight';
    color = 'text-amber-400';
  } else if (bmi < 25.0) {
    category = 'Normal weight';
    color = 'text-emerald-400';
  } else if (bmi < 30.0) {
    category = 'Overweight';
    color = 'text-amber-400';
  } else if (bmi < 35.0) {
    category = 'Obese (Class I)';
    color = 'text-rose-400';
  } else {
    category = 'Obese (Class II+)';
    color = 'text-rose-500';
  }

  return { bmi, category, color };
}

/**
 * Calculates waitlist duration in days and humanized string from registration date.
 */
export function calculateWaitingDuration(
  startDateString?: string
): { days: number; formatted: string } {
  if (!startDateString) {
    return { days: 0, formatted: '0 days' };
  }
  const start = new Date(startDateString);
  if (isNaN(start.getTime())) {
    return { days: 0, formatted: '0 days' };
  }
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - start.getTime());
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days < 30) {
    return { days, formatted: `${days} day${days === 1 ? '' : 's'}` };
  }
  const months = Math.floor(days / 30.4);
  const remDays = Math.floor(days % 30.4);
  if (months < 12) {
    return { days, formatted: `${months} mo ${remDays} d (${days} days total)` };
  }
  const years = Math.floor(days / 365.25);
  const remMonths = Math.floor((days % 365.25) / 30.4);
  return { days, formatted: `${years} yr ${remMonths} mo (${days} days total)` };
}

/**
 * Data Quality and Profile Completeness Evaluation for Donors.
 */
export function calculateDonorCompleteness(donor: Partial<Donor>): {
  percentage: number;
  missingOptional: string[];
  missingRequired: string[];
  dataQuality: 'Excellent' | 'Good' | 'Fair' | 'Incomplete';
} {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  // Required core fields (weight: 10 each, total 50)
  if (!donor.name || donor.name.trim().length < 2) missingRequired.push('Full Legal Name');
  if (!donor.bloodGroup) missingRequired.push('Blood Group (ABO/Rh)');
  if (!donor.organ) missingRequired.push('Donation Organ');
  if (!donor.hospitalId) missingRequired.push('Procurement Hospital');
  if (!donor.availability) missingRequired.push('Availability Status');

  // Optional matching and health fields (weight: 5 each, total 50)
  if (!donor.dateOfBirth) missingOptional.push('Date of Birth');
  if (!donor.heightCm || donor.heightCm <= 0) missingOptional.push('Height (cm)');
  if (!donor.weightKg || donor.weightKg <= 0) missingOptional.push('Weight (kg)');
  if (!donor.systolicBp || !donor.diastolicBp) missingOptional.push('Blood Pressure (mmHg)');
  if (!donor.heartRate || donor.heartRate <= 0) missingOptional.push('Heart Rate (bpm)');
  if (!donor.bloodGlucose || donor.bloodGlucose <= 0) missingOptional.push('Blood Glucose (mg/dL)');
  if (donor.hba1c === undefined || donor.hba1c === null) missingOptional.push('HbA1c (%)');
  if (!donor.smokingStatus || donor.smokingStatus === 'Unknown') missingOptional.push('Smoking / Tobacco Status');
  if (!donor.currentMedications) missingOptional.push('Current Medications');
  if (!donor.phone && !donor.email) missingOptional.push('Contact Information');
  if (!donor.organSize) missingOptional.push('Organ Size Specification');

  // Check organ-specific data if applicable
  const organ = donor.organ;
  const med = donor.medicalProfile;
  if (organ === 'Kidney' && (!med?.kidneyData?.creatinine || !med?.kidneyData?.egfr)) {
    missingOptional.push('Kidney Labs (Creatinine / eGFR)');
  } else if (organ === 'Heart' && (!med?.heartData?.ejectionFraction || !med?.heartData?.ecg)) {
    missingOptional.push('Cardiac Assessment (EF / ECG)');
  } else if (organ === 'Liver' && (!med?.liverData?.bilirubin || !med?.liverData?.inr)) {
    missingOptional.push('Hepatic Panel (Bilirubin / INR)');
  } else if (organ === 'Lung' && (!med?.lungData?.spO2 || !med?.lungData?.respiratoryRate)) {
    missingOptional.push('Pulmonary Vitals (SpO2 / RR)');
  }

  const reqTotal = 5;
  const reqMet = reqTotal - missingRequired.length;
  const optTotal = 12;
  const optMet = optTotal - missingOptional.length;

  // 60% weight for required, 40% for optional health profile
  const reqScore = (reqMet / reqTotal) * 60;
  const optScore = (optMet / optTotal) * 40;
  const percentage = Math.min(100, Math.max(0, Math.round(reqScore + optScore)));

  let dataQuality: 'Excellent' | 'Good' | 'Fair' | 'Incomplete' = 'Incomplete';
  if (percentage >= 88 && missingRequired.length === 0) {
    dataQuality = 'Excellent';
  } else if (percentage >= 70 && missingRequired.length === 0) {
    dataQuality = 'Good';
  } else if (percentage >= 50 && missingRequired.length === 0) {
    dataQuality = 'Fair';
  } else {
    dataQuality = 'Incomplete';
  }

  return { percentage, missingOptional, missingRequired, dataQuality };
}

/**
 * Data Quality and Profile Completeness Evaluation for Recipients.
 */
export function calculateRecipientCompleteness(recipient: Partial<Recipient>): {
  percentage: number;
  missingOptional: string[];
  missingRequired: string[];
  dataQuality: 'Excellent' | 'Good' | 'Fair' | 'Incomplete';
} {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  // Required core fields (weight: 10 each, total 50)
  if (!recipient.name || recipient.name.trim().length < 2) missingRequired.push('Full Legal Name');
  if (!recipient.bloodGroup) missingRequired.push('Blood Group (ABO/Rh)');
  if (!recipient.organNeeded) missingRequired.push('Requested Organ');
  if (!recipient.hospitalId) missingRequired.push('Transplant Hospital');
  if (!recipient.urgency) missingRequired.push('Clinical Urgency Tier');

  // Optional matching and health fields
  if (!recipient.dateOfBirth) missingOptional.push('Date of Birth');
  if (!recipient.heightCm || recipient.heightCm <= 0) missingOptional.push('Height (cm)');
  if (!recipient.weightKg || recipient.weightKg <= 0) missingOptional.push('Weight (kg)');
  if (!recipient.systolicBp || !recipient.diastolicBp) missingOptional.push('Blood Pressure (mmHg)');
  if (!recipient.heartRate || recipient.heartRate <= 0) missingOptional.push('Heart Rate (bpm)');
  if (!recipient.bloodGlucose || recipient.bloodGlucose <= 0) missingOptional.push('Blood Glucose (mg/dL)');
  if (recipient.hba1c === undefined || recipient.hba1c === null) missingOptional.push('HbA1c (%)');
  if (!recipient.primaryDiagnosis) missingOptional.push('Primary Medical Diagnosis');
  if (!recipient.waitingListDate && !recipient.registrationDate) missingOptional.push('Waiting List Registration Date');
  if (!recipient.currentMedications) missingOptional.push('Current Medications');
  if (!recipient.phone && !recipient.email) missingOptional.push('Contact Information');
  if (!recipient.organSize) missingOptional.push('Organ Size Requirement');

  // Check organ-specific data if applicable
  const organ = recipient.organNeeded;
  const med = recipient.medicalProfile;
  if (organ === 'Kidney' && (!med?.kidneyData?.creatinine || !med?.kidneyData?.egfr)) {
    missingOptional.push('Kidney Labs (Creatinine / eGFR)');
  } else if (organ === 'Heart' && (!med?.heartData?.ejectionFraction || !med?.heartData?.ecg)) {
    missingOptional.push('Cardiac Assessment (EF / ECG)');
  } else if (organ === 'Liver' && (!med?.liverData?.bilirubin || !med?.liverData?.inr)) {
    missingOptional.push('Hepatic Panel (Bilirubin / INR)');
  } else if (organ === 'Lung' && (!med?.lungData?.spO2 || !med?.lungData?.respiratoryRate)) {
    missingOptional.push('Pulmonary Vitals (SpO2 / RR)');
  }

  const reqTotal = 5;
  const reqMet = reqTotal - missingRequired.length;
  const optTotal = 13;
  const optMet = optTotal - missingOptional.length;

  const reqScore = (reqMet / reqTotal) * 60;
  const optScore = (optMet / optTotal) * 40;
  const percentage = Math.min(100, Math.max(0, Math.round(reqScore + optScore)));

  let dataQuality: 'Excellent' | 'Good' | 'Fair' | 'Incomplete' = 'Incomplete';
  if (percentage >= 88 && missingRequired.length === 0) {
    dataQuality = 'Excellent';
  } else if (percentage >= 70 && missingRequired.length === 0) {
    dataQuality = 'Good';
  } else if (percentage >= 50 && missingRequired.length === 0) {
    dataQuality = 'Fair';
  } else {
    dataQuality = 'Incomplete';
  }

  return { percentage, missingOptional, missingRequired, dataQuality };
}
