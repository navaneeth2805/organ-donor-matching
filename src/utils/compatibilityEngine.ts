import { BloodGroup, CompatibilityResult, Donor, RankingWeights, Recipient, RuleEvaluation } from '../types';

/**
 * Standard 8x8 ABO and Rh factor compatibility matrix.
 * Row: Donor Blood Group, Column: Recipient Blood Group
 */
export const BLOOD_COMPATIBILITY_MATRIX: Record<BloodGroup, Record<BloodGroup, boolean>> = {
  'O-': { 'O-': true, 'O+': true, 'A-': true, 'A+': true, 'B-': true, 'B+': true, 'AB-': true, 'AB+': true },
  'O+': { 'O-': false, 'O+': true, 'A-': false, 'A+': true, 'B-': false, 'B+': true, 'AB-': false, 'AB+': true },
  'A-': { 'O-': false, 'O+': false, 'A-': true, 'A+': true, 'B-': false, 'B+': false, 'AB-': true, 'AB+': true },
  'A+': { 'O-': false, 'O+': false, 'A-': false, 'A+': true, 'B-': false, 'B+': false, 'AB-': false, 'AB+': true },
  'B-': { 'O-': false, 'O+': false, 'A-': false, 'A+': false, 'B-': true, 'B+': true, 'AB-': true, 'AB+': true },
  'B+': { 'O-': false, 'O+': false, 'A-': false, 'A+': false, 'B-': false, 'B+': true, 'AB-': false, 'AB+': true },
  'AB-': { 'O-': false, 'O+': false, 'A-': false, 'A+': false, 'B-': false, 'B+': false, 'AB-': true, 'AB+': true },
  'AB+': { 'O-': false, 'O+': false, 'A-': false, 'A+': false, 'B-': false, 'B+': false, 'AB-': false, 'AB+': true },
};

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  urgency: 30,
  waitingTime: 20,
  bloodScore: 15,
  hlaScore: 15,
  geographicScore: 10,
  clinicalViability: 10,
};

export const WEIGHT_PRESETS: Record<string, { name: string; description: string; weights: RankingWeights }> = {
  standard: {
    name: 'Standard Clinical (Balanced)',
    description: 'Balanced multi-criteria evaluation adhering to national organ sharing allocation norms.',
    weights: { urgency: 30, waitingTime: 20, bloodScore: 15, hlaScore: 15, geographicScore: 10, clinicalViability: 10 },
  },
  urgency: {
    name: 'High Urgency First',
    description: 'Prioritizes life-threatening Status 1 critical waitlist candidates.',
    weights: { urgency: 50, waitingTime: 15, bloodScore: 10, hlaScore: 10, geographicScore: 10, clinicalViability: 5 },
  },
  immunology: {
    name: 'HLA & Immunology Priority',
    description: 'Emphasizes histocompatibility and minimal antigen mismatch to prolong long-term graft survival.',
    weights: { urgency: 15, waitingTime: 10, bloodScore: 20, hlaScore: 35, geographicScore: 10, clinicalViability: 10 },
  },
  logistics: {
    name: 'Ischemia & Rapid Logistics',
    description: 'Favors localized donors to minimize organ cold ischemia time and transit risk.',
    weights: { urgency: 20, waitingTime: 15, bloodScore: 15, hlaScore: 10, geographicScore: 30, clinicalViability: 10 },
  },
};

/**
 * Check if donor blood is immunologically compatible with recipient blood.
 */
export function checkBloodCompatibility(donorBlood: BloodGroup, recipientBlood: BloodGroup): boolean {
  return BLOOD_COMPATIBILITY_MATRIX[donorBlood]?.[recipientBlood] ?? false;
}

/**
 * Deterministic pseudo-hash calculation for mock HLA locus simulation based on patient attributes.
 */
function calculateHlaMatch(donor: Donor, recipient: Recipient): { score: number; lociMatches: number } {
  // Same blood group gives genetic proximity boost
  const baseMatch = donor.bloodGroup === recipient.bloodGroup ? 3 : 1;
  const ageDelta = Math.abs(donor.age - recipient.age);
  const ageFactor = ageDelta < 10 ? 2 : ageDelta < 25 ? 1 : 0;
  const hashVal = ((donor.id * 17 + recipient.id * 31) % 4) + 1; // 1 to 4

  const totalMatches = Math.min(6, Math.max(1, baseMatch + ageFactor + (hashVal > 2 ? 1 : 0)));
  const score = Math.round((totalMatches / 6) * 100);

  return { score, lociMatches: totalMatches };
}

/**
 * Geographic score between donor and recipient hospital/city.
 */
function calculateGeographicScore(donor: Donor, recipient: Recipient): { score: number; detail: string } {
  if (donor.hospitalId === recipient.hospitalId) {
    return { score: 100, detail: 'Same Hospital Facility (Zero Transit Time)' };
  }
  if (donor.location.toLowerCase() === recipient.location.toLowerCase()) {
    return { score: 90, detail: `Same Metro Area (${donor.location}) - Rapid Local Transfer` };
  }
  return { score: 65, detail: `Regional Transfer (${donor.location} ➔ ${recipient.location})` };
}

/**
 * Clinical viability scoring based on age parity and clinical conditions.
 */
function calculateClinicalScore(donor: Donor, recipient: Recipient): { score: number; detail: string } {
  const ageDiff = Math.abs(donor.age - recipient.age);
  let score = 100;
  const reasons: string[] = [];

  if (donor.age > 65) {
    score -= 15;
    reasons.push('Extended donor criteria (Age > 65)');
  }
  if (recipient.age < 18 && donor.age > 45) {
    score -= 20;
    reasons.push('Pediatric recipient paired with mature donor');
  } else if (ageDiff > 30) {
    score -= 10;
    reasons.push(`Moderate age disparity (${ageDiff} years)`);
  }

  // Organ Size Compatibility
  if (donor.organSize && recipient.organSize) {
    const sizeOrder = ['Pediatric', 'Small', 'Medium', 'Large'];
    const dIdx = sizeOrder.indexOf(donor.organSize);
    const rIdx = sizeOrder.indexOf(recipient.organSize);
    if (dIdx !== -1 && rIdx !== -1) {
      const diff = Math.abs(dIdx - rIdx);
      if (diff === 0) {
        reasons.push(`Optimal organ size match (${donor.organSize})`);
      } else if (diff === 1) {
        score -= 5;
        reasons.push(`Acceptable size variance (${donor.organSize} ➔ ${recipient.organSize})`);
      } else {
        score -= 18;
        reasons.push(`Significant volumetric size mismatch (${donor.organSize} vs ${recipient.organSize})`);
      }
    }
  }

  return {
    score: Math.max(30, score),
    detail: reasons.length > 0 ? reasons.join('; ') : 'Optimal donor-recipient clinical pairing',
  };
}

/**
 * Evaluate single pair with hard constraints and multi-criteria weighted scoring.
 */
export function evaluatePair(
  donor: Donor,
  recipient: Recipient,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): CompatibilityResult {
  const ruleResults: RuleEvaluation[] = [];
  const hardFailures: string[] = [];
  const warnings: string[] = [];
  const explanations: string[] = [];

  // 1. HARD CONSTRAINT: Availability
  const isAvailable = donor.availability === 'Available';
  ruleResults.push({
    name: 'Donor Availability',
    isHardConstraint: true,
    passed: isAvailable,
    severity: isAvailable ? 'PASS' : 'FAIL',
    code: isAvailable ? 'AVAILABILITY_CONFIRMED' : 'DONOR_UNAVAILABLE',
    message: isAvailable
      ? 'Donor is currently certified active and available for procurement.'
      : `Donor availability status is currently '${donor.availability}'.`,
    score: isAvailable ? 100 : 0,
  });
  if (!isAvailable) {
    hardFailures.push(`Donor status '${donor.availability}' blocks allocation.`);
  }

  // 2. HARD CONSTRAINT: Organ Alignment
  const organMatches = donor.organ.toLowerCase().trim() === recipient.organNeeded.toLowerCase().trim();
  ruleResults.push({
    name: 'Organ Anatomical Match',
    isHardConstraint: true,
    passed: organMatches,
    severity: organMatches ? 'PASS' : 'FAIL',
    code: organMatches ? 'ORGAN_MATCH' : 'ORGAN_MISMATCH',
    message: organMatches
      ? `Organ match confirmed: Offered ${donor.organ} aligns with requested ${recipient.organNeeded}.`
      : `Anatomical mismatch: Donor offers ${donor.organ}, but recipient requires ${recipient.organNeeded}.`,
    score: organMatches ? 100 : 0,
  });
  if (!organMatches) {
    hardFailures.push(`Organ mismatch (${donor.organ} vs ${recipient.organNeeded}).`);
  }

  // 3. HARD CONSTRAINT: Blood Compatibility
  const bloodCompatible = checkBloodCompatibility(donor.bloodGroup, recipient.bloodGroup);
  const exactBloodMatch = donor.bloodGroup === recipient.bloodGroup;
  const bloodScore = exactBloodMatch ? 100 : bloodCompatible ? 85 : 0;

  ruleResults.push({
    name: 'ABO / Rh Blood Compatibility',
    isHardConstraint: true,
    passed: bloodCompatible,
    severity: bloodCompatible ? 'PASS' : 'FAIL',
    code: bloodCompatible ? (exactBloodMatch ? 'ABO_EXACT_MATCH' : 'ABO_COMPATIBLE_CROSS') : 'ABO_INCOMPATIBLE',
    message: bloodCompatible
      ? exactBloodMatch
        ? `Identical blood type match: ${donor.bloodGroup} ➔ ${recipient.bloodGroup} (Optimal).`
        : `Compatible blood transfer: ${donor.bloodGroup} ➔ ${recipient.bloodGroup} (Permissible under UNOS rules).`
      : `Blood incompatibility: Donor ${donor.bloodGroup} cannot donate to Recipient ${recipient.bloodGroup} due to isoagglutinin agglutination risk.`,
    score: bloodScore,
  });
  if (!bloodCompatible) {
    hardFailures.push(`Incompatible blood group (${donor.bloodGroup} into ${recipient.bloodGroup}).`);
  }

  // Calculate Soft Component Scores
  const { score: hlaScore, lociMatches } = calculateHlaMatch(donor, recipient);
  ruleResults.push({
    name: 'HLA Histocompatibility',
    isHardConstraint: false,
    passed: hlaScore >= 50,
    severity: hlaScore >= 70 ? 'PASS' : 'WARN',
    code: 'HLA_ANALYSIS',
    message: `${lociMatches}/6 major HLA loci matched (A, B, C, DR, DQ estimation).`,
    score: hlaScore,
  });
  if (hlaScore < 50) {
    warnings.push(`Sub-optimal HLA match (${lociMatches}/6 loci). Crossmatch assay advised.`);
  }

  // Urgency Score (0 - 100)
  const urgencyMap: Record<string, number> = { Critical: 100, High: 75, Medium: 50, Low: 25 };
  const urgencyScore = urgencyMap[recipient.urgency] ?? 50;
  ruleResults.push({
    name: 'Clinical Urgency Priority',
    isHardConstraint: false,
    passed: true,
    severity: 'PASS',
    code: 'URGENCY_ASSESSMENT',
    message: `Waitlist tier: ${recipient.urgency} (Weight score: ${urgencyScore}/100).`,
    score: urgencyScore,
  });

  // Waiting Time Score (normalized to 100 based on 365+ days cap)
  const waitingTimeScore = Math.min(100, Math.round((recipient.waitingTimeDays / 365) * 100));
  ruleResults.push({
    name: 'Waitlist Tenure',
    isHardConstraint: false,
    passed: true,
    severity: 'PASS',
    code: 'WAITLIST_TENURE',
    message: `Cumulative wait time: ${recipient.waitingTimeDays} days (${waitingTimeScore}/100 tier).`,
    score: waitingTimeScore,
  });

  // Geographic / Logistics Score
  const { score: geographicScore, detail: geoDetail } = calculateGeographicScore(donor, recipient);
  ruleResults.push({
    name: 'Logistical Feasibility & Cold Ischemia',
    isHardConstraint: false,
    passed: true,
    severity: geographicScore >= 80 ? 'PASS' : 'WARN',
    code: 'LOGISTICS_SCORE',
    message: geoDetail,
    score: geographicScore,
  });

  // Clinical Viability Score
  const { score: clinicalScore, detail: clinicalDetail } = calculateClinicalScore(donor, recipient);
  ruleResults.push({
    name: 'Clinical Risk & Parity',
    isHardConstraint: false,
    passed: clinicalScore >= 70,
    severity: clinicalScore >= 70 ? 'PASS' : 'WARN',
    code: 'CLINICAL_VIABILITY',
    message: clinicalDetail,
    score: clinicalScore,
  });
  if (clinicalScore < 70) {
    warnings.push(clinicalDetail);
  }

  // Organ Size & Volumetric Compatibility Evaluation
  let organSizeScore = 100;
  let sizeMessage = 'Organ size compatibility evaluated as standard';
  let sizeSeverity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  if (donor.organSize && recipient.organSize) {
    if (donor.organSize === recipient.organSize) {
      organSizeScore = 100;
      sizeMessage = `Optimal volumetric match: Both donor and recipient specified ${donor.organSize} organ size.`;
    } else {
      const sizeOrder = ['Pediatric', 'Small', 'Medium', 'Large'];
      const dIdx = sizeOrder.indexOf(donor.organSize);
      const rIdx = sizeOrder.indexOf(recipient.organSize);
      const diff = Math.abs(dIdx - rIdx);
      if (diff === 1) {
        organSizeScore = 85;
        sizeSeverity = 'PASS';
        sizeMessage = `Acceptable size variance: Donor ${donor.organSize} paired with Recipient ${recipient.organSize}.`;
      } else {
        organSizeScore = 50;
        sizeSeverity = 'WARN';
        sizeMessage = `Volumetric disparity alert: Donor ${donor.organSize} vs Recipient ${recipient.organSize}. Graft size mismatch requires surgical consultation.`;
        warnings.push(`Organ size disparity (${donor.organSize} vs ${recipient.organSize})`);
      }
    }
  } else if (donor.organSize || recipient.organSize) {
    organSizeScore = 90;
    sizeMessage = `Single-sided size specification: ${donor.organSize ? `Donor ${donor.organSize}` : `Recipient target ${recipient.organSize}`}.`;
  }

  ruleResults.push({
    name: 'Organ Size & Volumetric Compatibility',
    isHardConstraint: false,
    passed: sizeSeverity === 'PASS',
    severity: sizeSeverity,
    code: 'ORGAN_SIZE_ASSESSMENT',
    message: sizeMessage,
    score: organSizeScore,
  });

  // Determine Final Status and Weighted Score
  let overallScore = 0;
  let status: CompatibilityResult['status'] = 'INCOMPATIBLE';

  if (hardFailures.length > 0) {
    overallScore = 0;
    status = 'INCOMPATIBLE';
    explanations.push(
      `Allocation rejected due to ${hardFailures.length} hard constraint failure(s): ${hardFailures.join(' ')}`
    );
  } else {
    const totalWeight =
      weights.urgency +
      weights.waitingTime +
      weights.bloodScore +
      weights.hlaScore +
      weights.geographicScore +
      weights.clinicalViability;

    const weightedSum =
      urgencyScore * weights.urgency +
      waitingTimeScore * weights.waitingTime +
      bloodScore * weights.bloodScore +
      hlaScore * weights.hlaScore +
      geographicScore * weights.geographicScore +
      clinicalScore * weights.clinicalViability;

    overallScore = Math.round((weightedSum / (totalWeight || 100)) * 10) / 10;

    if (overallScore >= 72 && warnings.length === 0) {
      status = 'POTENTIAL_CANDIDATE';
      explanations.push(
        `High-compatibility allocation candidate with robust overall match index (${overallScore.toFixed(
          1
        )}/100). All hard constraints passed with ${lociMatches}/6 HLA loci concordance.`
      );
    } else {
      status = 'REQUIRES_REVIEW';
      explanations.push(
        `Hard constraints satisfied (${overallScore.toFixed(
          1
        )}/100), but clinical team review required due to: ${
          warnings.length > 0 ? warnings.join('; ') : 'moderate score profile'
        }.`
      );
    }
  }

  return {
    id: `pair-${donor.id}-${recipient.id}`,
    donorId: donor.id,
    recipientId: recipient.id,
    donor,
    recipient,
    status,
    overallScore,
    bloodScore,
    organScore: organMatches ? 100 : 0,
    clinicalScore,
    urgencyScore,
    waitingTimeScore,
    hlaScore,
    geographicScore,
    hardFailures,
    warnings,
    explanations,
    ruleResults,
    evaluatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
  };
}

/**
 * Batch evaluates all donor-recipient pairings in the network.
 */
export function evaluateAllPairs(
  donors: Donor[],
  recipients: Recipient[],
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
  filterCompatibleOnly: boolean = false
): CompatibilityResult[] {
  const results: CompatibilityResult[] = [];

  for (const donor of donors) {
    for (const recipient of recipients) {
      const res = evaluatePair(donor, recipient, weights);
      if (!filterCompatibleOnly || res.status !== 'INCOMPATIBLE') {
        results.push(res);
      }
    }
  }

  // Sort descending by overall score, then urgency
  return results.sort((a, b) => {
    if (b.overallScore !== a.overallScore) {
      return b.overallScore - a.overallScore;
    }
    return b.urgencyScore - a.urgencyScore;
  });
}
