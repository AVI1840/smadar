import {
  TravelCrossing, ClaimantInput, AuditResult, ActionType,
  MonthResult, MonthStatus, DecisionTraceEntry, BenefitType,
  SpouseAuditResult, TREATY_COUNTRIES,
} from '../types/types';

// ============================================================
// CONSTANTS
// ============================================================

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function daysBetweenInclusive(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffMs = b.getTime() - a.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function crossingTouchesMonth(crossing: TravelCrossing, year: number, monthIndex: number): boolean {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const dep = new Date(crossing.departureDate);
  const ret = new Date(crossing.returnDate);
  return dep <= monthEnd && ret >= monthStart;
}

function crossingFullMonthAbroad(crossing: TravelCrossing, year: number, monthIndex: number): boolean {
  // The claimant was abroad THE ENTIRE calendar month (no day in Israel)
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const dep = new Date(crossing.departureDate);
  const ret = new Date(crossing.returnDate);
  // Departure day and return day are "in Israel" per rules
  // So for full-month abroad: departure must be before month start, AND return must be after month end
  return dep < monthStart && ret > monthEnd;
}

export function isTreatyCountry(country: string): boolean {
  return TREATY_COUNTRIES.includes(country as any);
}

export function isUSA(country: string): boolean {
  const usNames = ['ארה"ב', 'ארצות הברית', 'אמריקה', 'USA', 'United States'];
  return usNames.some(n => country.includes(n));
}

// ============================================================
// STEP 1: Filter 24-hour crossings
// ============================================================

export function is24HourTrip(crossing: TravelCrossing): boolean {
  const dep = new Date(crossing.departureDate);
  const ret = new Date(crossing.returnDate);
  const diffMs = ret.getTime() - dep.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 1;
}

// ============================================================
// STEP 2: Calculate days abroad per crossing
// ============================================================

export function calcDaysAbroad(crossing: TravelCrossing): number {
  const rawDays = daysBetweenInclusive(crossing.departureDate, crossing.returnDate);
  // Departure day + return day = in Israel, so subtract 2
  return Math.max(rawDays - 2, 0);
}

// ============================================================
// STEP 3: Apply exemptions
// ============================================================

export function applyExemptions(crossings: TravelCrossing[]): {
  adjustedCrossings: TravelCrossing[];
  exemptDaysTotal: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const adjustedCrossings: TravelCrossing[] = [];
  let exemptDaysTotal = 0;
  let hajjCount = 0;

  for (const c of crossings) {
    if (c.exemption === 'None') {
      adjustedCrossings.push(c);
      continue;
    }

    const days = calcDaysAbroad(c);

    switch (c.exemption) {
      case 'Mourning': {
        const deducted = Math.min(days, 21);
        exemptDaysTotal += deducted;
        break;
      }
      case 'Hajj': {
        hajjCount++;
        if (hajjCount > 1) {
          warnings.push('חאג\' - נרשמה יותר מפעם אחת. יש לבדוק תקינות.');
        }
        const deducted = Math.min(days, 23);
        exemptDaysTotal += deducted;
        break;
      }
      case 'Medical': {
        const deducted = Math.min(days, 180);
        exemptDaysTotal += deducted;
        warnings.push('נדרש אסמכתא רפואית - הפנה לרפרנט');
        break;
      }
      case 'Employer': {
        // Not counted in crossing count, but income check needed
        adjustedCrossings.push(c); // stays in count per rules, but flagged
        warnings.push('יציאה מטעם המעסיק - יש לבצע מבחן הכנסות (רכיבי אש"ל/נסיעות)');
        break;
      }
    }
  }

  return { adjustedCrossings, exemptDaysTotal, warnings };
}

// ============================================================
// STEP 4: Determine action - INCOME ASSURANCE RETIREMENT
// ============================================================

type ThresholdLevel = 1 | 2 | 3;

function getThresholdFromCrossings(count: number): ThresholdLevel {
  if (count <= 3) return 1;
  if (count === 4) return 2;
  return 3;
}

function getThresholdFromDays(days: number): ThresholdLevel {
  if (days <= 72) return 1;
  if (days <= 100) return 2;
  return 3;
}

export function determineActionRetirement(validCrossings: number, totalDaysAbroad: number): ActionType {
  const crossingLevel = getThresholdFromCrossings(validCrossings);
  const daysLevel = getThresholdFromDays(totalDaysAbroad);
  const maxLevel = Math.max(crossingLevel, daysLevel) as ThresholdLevel;
  if (maxLevel === 1) return 'FullyApproved';
  if (maxLevel === 2) return 'SelectiveDisallowance';
  return 'RetroactiveYearlyDisallowance';
}

// ============================================================
// STEP 4b: Determine action - INCOME ASSURANCE PRE-RETIREMENT
// ============================================================

export function determineActionPreRetirement(validCrossings: number): ActionType {
  if (validCrossings <= 1) return 'FullyApproved';
  return 'FullDisallowance'; // יציאה שנייה ומעלה - שלילה
}

// ============================================================
// STEP 4c: Determine action - OLD AGE (no treaty, not USA)
// ============================================================

export function determineActionOldAge(input: ClaimantInput): ActionType {
  const elig = input.oldAgeEligibility;
  if (!elig) return 'NotEligible';

  // Basic condition: must have one of the "tnaei yesod"
  const hasBasicCondition = elig.receivingPensionBeforeDeparture || elig.isResidentDespiteAbroad;
  if (!hasBasicCondition) return 'NotEligible';

  // Must have 5 years residency before departure
  if (!elig.fiveYearsBeforeDeparture) return 'NotEligible';

  // Housewife without worker insurance - 3 months only
  if (elig.insuredStatus === 'housewife') return 'ThreeMonthLimit';

  // Check 1629 criteria for unlimited:
  // Option A: 25 years residency
  if (elig.yearsResidency >= 25) return 'UnlimitedApproved';

  // Option B: 144 months as worker + 12 of 24 months in Israel
  if (elig.monthsAsWorker >= 144 && elig.had12Of24Months) return 'UnlimitedApproved';

  // If neither - 3 months only (basic entitlement per section 324)
  return 'ThreeMonthLimit';
}

// ============================================================
// STEP 4d: OLD AGE - Treaty country
// ============================================================

export function determineActionOldAgeTreaty(input: ClaimantInput): ActionType {
  const elig = input.oldAgeEligibility;
  if (!elig) return 'NotEligible';

  // In treaty country: if became eligible per law while resident, continues unlimited
  if (elig.receivingPensionBeforeDeparture) return 'UnlimitedApproved';

  // Housewife in treaty country - from Feb 2017 unlimited
  if (elig.insuredStatus === 'housewife' && elig.receivingPensionBeforeDeparture) return 'UnlimitedApproved';
  if (elig.insuredStatus === 'housewife') return 'UnlimitedApproved'; // post Feb 2017 rule

  return 'UnlimitedApproved'; // treaty country = unlimited for eligible
}

// ============================================================
// STEP 4e: OLD AGE - USA
// ============================================================

export function determineActionOldAgeUSA(input: ClaimantInput): ActionType {
  const elig = input.oldAgeEligibility;
  if (!elig) return 'NotEligible';

  if (!elig.receivingPensionBeforeDeparture && !elig.isResidentDespiteAbroad) return 'NotEligible';

  // Housewife without worker insurance - 3 months only in USA
  if (elig.insuredStatus === 'housewife') return 'ThreeMonthLimit';

  // Everyone else - unlimited
  return 'UnlimitedApproved';
}

// ============================================================
// STEP 4f: Special Old Age (גמ"ז)
// ============================================================

export function determineActionSpecialOldAge(): ActionType {
  return 'OneMonthLimit';
}

// ============================================================
// STEP 4g: Survivors - No Treaty (not USA)
// ============================================================

export function determineActionSurvivorsNoTreaty(input: ClaimantInput): ActionType {
  const elig = input.survivorsEligibility;
  if (!elig) return 'NotEligible';

  // Basic condition: deceased was Israeli resident at time of death
  if (!elig.deceasedWasResident) return 'NotEligible';

  // Remarried widow - 3 months only
  if (elig.survivorType === 'remarried_widow') return 'ThreeMonthLimit';

  // Check unlimited conditions
  if (elig.deceasedInsuranceMonths >= 144) {
    // Widow: age 50+
    if (elig.survivorType === 'widow' && elig.survivorAge >= 50) return 'UnlimitedApproved';

    // Widower: age 50+ AND has child
    if (elig.survivorType === 'widower' && elig.survivorAge >= 50 && elig.hasChildWithSurvivor) return 'UnlimitedApproved';

    // Child: under 18, with parent over 50
    if (elig.survivorType === 'child') {
      if ((elig.childAge ?? 99) < 18 && elig.childWithParentOver50) return 'UnlimitedApproved';
      // Child over 18 or without parent over 50 - 3 months only
      return 'ThreeMonthLimit';
    }
  }

  // Check 36-month condition: in 12 months before death, deceased or survivor was in Israel
  if (elig.deceasedOrSurvivorInIsrael12Months) return 'ThirtySixMonthLimit';

  // Default: 3 months only (section 324)
  return 'ThreeMonthLimit';
}

// ============================================================
// STEP 4h: Survivors - Treaty
// ============================================================

export function determineActionSurvivorsTreaty(input: ClaimantInput): ActionType {
  const elig = input.survivorsEligibility;
  if (!elig) return 'NotEligible';

  // Treaty country: eligible per law = continues unlimited
  if (elig.deceasedWasResident || elig.deceasedCompletedAkshara) return 'UnlimitedApproved';

  return 'NotEligible';
}

// ============================================================
// STEP 4i: Survivors - USA
// ============================================================

export function determineActionSurvivorsUSA(input: ClaimantInput): ActionType {
  const elig = input.survivorsEligibility;
  if (!elig) return 'NotEligible';

  // USA: deceased must have been Israeli resident AND completed akshara
  if (!elig.deceasedWasResident) return 'NotEligible';
  if (!elig.deceasedCompletedAkshara) return 'NotEligible';

  // If deceased completed akshara - unlimited in USA
  return 'UnlimitedApproved';
}

// ============================================================
// STEP 5: Tag months
// ============================================================

export function tagMonths(
  calendarYear: number,
  validCrossings: TravelCrossing[],
  allCrossingsAfter24h: TravelCrossing[],
  actionType: ActionType,
  benefitType: BenefitType,
): MonthResult[] {
  const results: MonthResult[] = [];

  for (let m = 0; m < 12; m++) {
    const monthStr = `${calendarYear}-${String(m + 1).padStart(2, '0')}`;
    const monthLabel = HEBREW_MONTHS[m];
    let status: MonthStatus = 'Approved';
    let reason: string | undefined;
    let ruleRef: string | undefined;

    switch (actionType) {
      case 'FullyApproved':
      case 'UnlimitedApproved':
        status = 'Approved';
        ruleRef = benefitType.startsWith('oldAge') ? 'סעיף 324 לחוק / חוזר 1629' : 'סעיף 4(א) לתקנות';
        break;

      case 'SelectiveDisallowance': {
        const touchedBy4Plus = validCrossings.slice(3).some(c => crossingTouchesMonth(c, calendarYear, m));
        if (touchedBy4Plus) {
          status = 'Disqualified';
          reason = 'שלילה עקב יציאה רביעית ומעלה';
          ruleRef = 'סעיף 4(ב) לתקנות';
        } else {
          status = 'Approved';
          ruleRef = 'סעיף 4(א) לתקנות';
        }
        break;
      }

      case 'RetroactiveYearlyDisallowance': {
        const touchedByAny = validCrossings.some(c => crossingTouchesMonth(c, calendarYear, m));
        if (touchedByAny) {
          status = 'Disqualified';
          reason = 'שלילה רטרואקטיבית - חודש שהות בחו"ל';
          ruleRef = 'סעיף 4(ג) לתקנות';
        } else {
          status = 'Approved';
        }
        break;
      }

      case 'FullDisallowance': {
        // Pre-retirement: first trip OK, second+ = disqualified in departure month, return month, and all months abroad
        if (validCrossings.length <= 1) {
          // Check if the single trip has full month abroad
          const fullMonthAbroad = allCrossingsAfter24h.some(c => crossingFullMonthAbroad(c, calendarYear, m));
          if (fullMonthAbroad) {
            status = 'Disqualified';
            reason = 'שהייה בחו"ל חודש קלנדרי מלא';
            ruleRef = 'סעיף 14(א) לחוק הבטחת הכנסה';
          } else {
            status = 'Approved';
          }
        } else {
          // Second crossing onward - disqualify all touched months
          const touchedBy2Plus = validCrossings.slice(1).some(c => crossingTouchesMonth(c, calendarYear, m));
          if (touchedBy2Plus) {
            status = 'Disqualified';
            reason = 'שלילה - יציאה שנייה ומעלה בשנה קלנדרית';
            ruleRef = 'סעיף 14(א)(ב)(1) לחוק הבטחת הכנסה';
          } else {
            // Check full month for first trip
            const fullMonth = allCrossingsAfter24h.some(c => crossingFullMonthAbroad(c, calendarYear, m));
            if (fullMonth) {
              status = 'Disqualified';
              reason = 'שהייה בחו"ל חודש קלנדרי מלא';
              ruleRef = 'סעיף 14(א) לחוק הבטחת הכנסה';
            } else {
              status = 'Approved';
            }
          }
        }
        break;
      }

      case 'ThreeMonthLimit': {
        // First 3 months after departure - approved, then disqualified
        // Find the first crossing that touches this month
        const touchedByAny = allCrossingsAfter24h.some(c => crossingTouchesMonth(c, calendarYear, m));
        if (!touchedByAny) {
          status = 'Approved';
        } else {
          // Need to determine if this month falls within the 3-month window
          // For simplicity: first 3 months after first departure = approved
          if (allCrossingsAfter24h.length > 0) {
            const firstDep = new Date(allCrossingsAfter24h[0].departureDate);
            const depMonth = firstDep.getMonth();
            const depYear = firstDep.getFullYear();
            const monthsSinceDep = (calendarYear - depYear) * 12 + (m - depMonth);
            if (monthsSinceDep >= 0 && monthsSinceDep <= 3) {
              status = 'Approved';
              reason = 'במסגרת 3 חודשים מותרים';
              ruleRef = 'סעיף 324 לחוק';
            } else if (monthsSinceDep > 3) {
              status = 'Disqualified';
              reason = 'חריגה מ-3 חודשים מותרים';
              ruleRef = 'סעיף 324 לחוק';
            } else {
              status = 'Approved';
            }
          }
        }
        break;
      }

      case 'OneMonthLimit': {
        // גמ"ז - one calendar month after departure month
        const touchedByAny = allCrossingsAfter24h.some(c => crossingTouchesMonth(c, calendarYear, m));
        if (!touchedByAny) {
          status = 'Approved';
        } else {
          if (allCrossingsAfter24h.length > 0) {
            const firstDep = new Date(allCrossingsAfter24h[0].departureDate);
            const depMonth = firstDep.getMonth();
            const depYear = firstDep.getFullYear();
            const monthsSinceDep = (calendarYear - depYear) * 12 + (m - depMonth);
            if (monthsSinceDep >= 0 && monthsSinceDep <= 1) {
              status = 'Approved';
              reason = 'חודש קלנדרי מותר לאחר חודש היציאה';
              ruleRef = 'תדריך גמ"ז - שהות בחו"ל';
            } else if (monthsSinceDep > 1) {
              status = 'Disqualified';
              reason = 'חריגה מחודש מותר - גמ"ז';
              ruleRef = 'תדריך גמ"ז - שהות בחו"ל';
            } else {
              status = 'Approved';
            }
          }
        }
        break;
      }

      case 'ThirtySixMonthLimit': {
        // Survivors 36 months: first 3 months approved, then up to 36 additional months
        const touchedByAny = allCrossingsAfter24h.some(c => crossingTouchesMonth(c, calendarYear, m));
        if (!touchedByAny) {
          status = 'Approved';
        } else {
          if (allCrossingsAfter24h.length > 0) {
            const firstDep = new Date(allCrossingsAfter24h[0].departureDate);
            const depMonth = firstDep.getMonth();
            const depYear = firstDep.getFullYear();
            const monthsSinceDep = (calendarYear - depYear) * 12 + (m - depMonth);
            if (monthsSinceDep >= 0 && monthsSinceDep <= 39) { // 3 + 36 = 39
              status = 'Approved';
              reason = monthsSinceDep <= 3
                ? 'במסגרת 3 חודשים ראשונים (סעיף 324)'
                : `חודש ${monthsSinceDep - 3} מתוך 36 חודשים נוספים`;
              ruleRef = 'סעיף 324 לחוק + תדריך שאירים 8.5';
            } else {
              status = 'Disqualified';
              reason = 'חריגה מ-39 חודשים מותרים (3+36)';
              ruleRef = 'תדריך שאירים 8.5.2.2 סעיף ו';
            }
          }
        }
        break;
      }

      case 'NotEligible': {
        const touchedByAny = allCrossingsAfter24h.some(c => crossingTouchesMonth(c, calendarYear, m));
        if (touchedByAny) {
          status = 'Disqualified';
          reason = 'אין זכאות להמשך תשלום בחו"ל';
          ruleRef = 'סעיף 324 לחוק / חוזר 1629';
        } else {
          status = 'Approved';
        }
        break;
      }
    }

    results.push({ month: monthStr, monthLabel, status, reason, ruleRef });
  }

  // Additional: full month abroad rule (applies to ALL benefit types)
  // A month where claimant was abroad entire calendar month is always disqualified
  if (actionType === 'FullyApproved' || actionType === 'UnlimitedApproved') {
    for (let m = 0; m < 12; m++) {
      const fullMonthAbroad = allCrossingsAfter24h.some(c => crossingFullMonthAbroad(c, calendarYear, m));
      if (fullMonthAbroad && results[m].status === 'Approved') {
        results[m].status = 'Disqualified';
        results[m].reason = 'שהייה בחו"ל חודש קלנדרי מלא';
        results[m].ruleRef = 'סעיף 14(א) לחוק הבטחת הכנסה';
      }
    }
  }

  return results;
}

// ============================================================
// STEP 6: Spouse Analysis
// ============================================================

function analyzeSpouse(input: ClaimantInput): SpouseAuditResult | undefined {
  if (!input.spouse || !input.spouse.hasSpouse) return undefined;
  const sp = input.spouse;

  if (!sp.spouseAbroad) {
    return {
      supplementStatus: 'continues',
      reason: 'בן/בת הזוג בישראל - אין שינוי',
      ruleRef: 'סעיף 247 לחוק',
    };
  }

  // Spouse abroad
  if (input.benefitType === 'incomeAssurance_retirement' || input.benefitType === 'incomeAssurance_preRetirement') {
    // Income assurance: spouse abroad means pay only to spouse in Israel at single rate
    return {
      supplementStatus: 'suspended',
      reason: 'בן/בת הזוג בחו"ל - גמלה בשיעור יחיד לנשאר בארץ',
      ruleRef: 'סעיף 4(א) לחוק הבטחת הכנסה',
    };
  }

  // Old age: dependent supplement
  if (sp.spouseDependentSupplement) {
    if (sp.spouseCeasedResidency) {
      // If the main claimant is also abroad and eligible for continued payment
      // the supplement continues (section 324)
      if (input.oldAgeEligibility?.receivingPensionBeforeDeparture) {
        return {
          supplementStatus: 'continues',
          reason: 'הזכאי וב"ז שניהם בחו"ל, הזכאי עומד בתנאי המשך - התוספת ממשיכה',
          ruleRef: 'סעיף 324 לחוק (הערה 2 בתדריך)',
        };
      }
      return {
        supplementStatus: 'terminated',
        reason: 'בן/בת הזוג חדל/ה להיות תושב/ת - תוספת תלויים מופסקת',
        ruleRef: 'סעיף 247 (תיקון 60) + סעיף 324(ב) לחוק',
      };
    } else {
      // Still resident but abroad - 24 months limit
      const months = sp.spouseMonthsAbroad || 0;
      if (months > 24) {
        return {
          supplementStatus: 'terminated',
          reason: 'בן/בת הזוג בחו"ל מעל 24 חודשים - תוספת מופסקת',
          ruleRef: 'סעיף 324(ב) לחוק',
        };
      }
      return {
        supplementStatus: 'continues',
        reason: `בן/בת הזוג תושב/ת ובחו"ל ${months} חודשים (מתוך 24 מותרים)`,
        ruleRef: 'סעיף 324(ב) לחוק',
      };
    }
  }

  return {
    supplementStatus: 'continues',
    reason: 'אין תוספת תלויים - אין השפעה',
    ruleRef: '',
  };
}

// ============================================================
// MAIN EXPORT: runAudit
// ============================================================

export function runAudit(input: ClaimantInput): AuditResult {
  const trace: DecisionTraceEntry[] = [];
  let stepNum = 0;

  // --- Step 1: Filter 24-hour crossings ---
  const after24h = input.crossings.filter(c => !is24HourTrip(c));
  const removed24h = input.crossings.length - after24h.length;
  stepNum++;
  trace.push({
    step: stepNum, ruleId: 'A01',
    description: 'סינון יציאות 24 שעות',
    result: `${removed24h} יציאות הוסרו (יציאה וחזרה באותו יום/למחרת)`,
  });

  // --- Step 3: Apply exemptions ---
  const { adjustedCrossings, exemptDaysTotal, warnings } = applyExemptions(after24h);
  stepNum++;
  trace.push({
    step: stepNum, ruleId: 'A02',
    description: 'החלת חריגים (אבל, חאג\', טיפול רפואי, מעסיק)',
    result: `${after24h.length - adjustedCrossings.length} יציאות חריגות הוסרו. ${exemptDaysTotal} ימים הופחתו`,
  });

  // --- Step 2: Calculate total days ---
  let allDaysAbroad = 0;
  for (const c of after24h) {
    allDaysAbroad += calcDaysAbroad(c);
  }
  const totalDaysAbroad = Math.max(allDaysAbroad - exemptDaysTotal, 0);
  const validCrossingsCount = adjustedCrossings.length;

  stepNum++;
  trace.push({
    step: stepNum, ruleId: 'B01',
    description: 'חישוב ימי שהות וספירת יציאות',
    result: `${validCrossingsCount} יציאות תקפות, ${totalDaysAbroad} ימי שהות (${allDaysAbroad} גולמי - ${exemptDaysTotal} חריגים)`,
  });

  // --- Step 4: Determine action based on benefit type ---
  let actionType: ActionType;

  stepNum++;
  switch (input.benefitType) {
    case 'incomeAssurance_retirement':
      actionType = determineActionRetirement(validCrossingsCount, totalDaysAbroad);
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - הבטחת הכנסה גיל פרישה',
        result: `${actionType} (${validCrossingsCount} יציאות, ${totalDaysAbroad} ימים)`,
      });
      break;

    case 'incomeAssurance_preRetirement':
      actionType = determineActionPreRetirement(validCrossingsCount);
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - הבטחת הכנסה טרום פרישה',
        result: `${actionType} (${validCrossingsCount} יציאות)`,
      });
      break;

    case 'oldAge_noTreaty':
      actionType = determineActionOldAge(input);
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - קצבת זקנה ללא אמנה (חוזר 1629)',
        result: `${actionType}`,
      });
      break;

    case 'oldAge_treaty':
      actionType = determineActionOldAgeTreaty(input);
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - קצבת זקנה מדינת אמנה',
        result: `${actionType}`,
      });
      break;

    case 'oldAge_usa':
      actionType = determineActionOldAgeUSA(input);
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - קצבת זקנה ארה"ב',
        result: `${actionType}`,
      });
      break;

    case 'specialOldAge':
      actionType = determineActionSpecialOldAge();
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - גמלה מיוחדת (גמ"ז)',
        result: `חודש אחד בלבד`,
      });
      break;

    case 'survivors_noTreaty':
      actionType = determineActionSurvivorsNoTreaty(input);
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - קצבת שאירים ללא אמנה',
        result: `${actionType}`,
      });
      break;

    case 'survivors_treaty':
      actionType = determineActionSurvivorsTreaty(input);
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - קצבת שאירים מדינת אמנה',
        result: `${actionType}`,
      });
      break;

    case 'survivors_usa':
      actionType = determineActionSurvivorsUSA(input);
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'קביעת סף - קצבת שאירים ארה"ב',
        result: `${actionType}`,
      });
      break;

    default:
      actionType = 'NotEligible';
      trace.push({
        step: stepNum, ruleId: 'B02',
        description: 'סוג גמלה לא מזוהה',
        result: 'NotEligible',
      });
  }

  // --- Step 5: Tag months ---
  const monthResults = tagMonths(input.calendarYear, adjustedCrossings, after24h, actionType, input.benefitType);
  stepNum++;
  trace.push({
    step: stepNum, ruleId: 'C01',
    description: 'תיוג חודשים',
    result: `${monthResults.filter(m => m.status === 'Disqualified').length} חודשים נשללו, ${monthResults.filter(m => m.status === 'Approved').length} מאושרים`,
  });

  // --- Step 6: Spouse ---
  const spouseResult = analyzeSpouse(input);
  if (spouseResult) {
    stepNum++;
    trace.push({
      step: stepNum, ruleId: 'D01',
      description: 'בדיקת בן/בת זוג',
      result: spouseResult.reason,
    });
  }

  // --- Step 7: Secondary benefit (e.g., old-age + income supplement) ---
  let secondaryResult: AuditResult['secondaryResult'] = undefined;
  if (input.secondBenefitType) {
    const secondInput = { ...input, benefitType: input.secondBenefitType, secondBenefitType: undefined };
    const secResult = runAudit(secondInput);
    secondaryResult = {
      benefitType: input.secondBenefitType,
      actionType: secResult.actionType,
      monthResults: secResult.monthResults,
      decisionTrace: secResult.decisionTrace,
    };
    stepNum++;
    trace.push({
      step: stepNum, ruleId: 'E01',
      description: `בדיקת קצבה משנית (${input.secondBenefitType})`,
      result: `${secResult.actionType}`,
    });
  }

  return {
    benefitType: input.benefitType,
    rawCrossingsCount: input.crossings.length,
    validCrossingsCount,
    exemptDaysDeducted: exemptDaysTotal,
    totalDaysAbroad,
    actionType,
    monthResults,
    warnings,
    decisionTrace: trace,
    spouseResult,
    secondaryResult: secondaryResult || undefined,
  };
}
