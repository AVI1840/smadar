// --- Benefit Types ---
export type BenefitType =
  | 'incomeAssurance_retirement'     // הבטחת הכנסה / השלמת הכנסה - גיל פרישה
  | 'incomeAssurance_preRetirement'  // הבטחת הכנסה - טרום פרישה
  | 'oldAge_noTreaty'               // קצבת זקנה - מדינה ללא אמנה (לא ארה"ב)
  | 'oldAge_treaty'                 // קצבת זקנה - מדינת אמנה
  | 'oldAge_usa'                    // קצבת זקנה - ארה"ב
  | 'specialOldAge';                // גמלה מיוחדת (גמ"ז)

// --- Exemptions ---
export type ExemptionType = 'None' | 'Mourning' | 'Hajj' | 'Medical' | 'Employer';

// --- Action Types ---
export type ActionType =
  | 'FullyApproved'
  | 'SelectiveDisallowance'
  | 'RetroactiveYearlyDisallowance'
  | 'FullDisallowance'              // שלילה מלאה (טרום פרישה - יציאה שנייה+)
  | 'ThreeMonthLimit'               // 3 חודשים בלבד (עקרת בית / גמ"ז)
  | 'OneMonthLimit'                 // חודש אחד בלבד (גמ"ז)
  | 'UnlimitedApproved'             // ללא הגבלת זמן (אמנה / ארה"ב / 25 שנים / 144 חודשים)
  | 'NotEligible';                  // אין זכאות כלל

export type MonthStatus = 'Approved' | 'Disqualified' | 'ReviewRequired';

// --- Treaty Countries ---
export const TREATY_COUNTRIES = [
  'אוסטריה', 'אורוגואי', 'איטליה', 'ארגנטינה', 'בולגריה',
  'בלגיה', 'בריטניה', 'גרמניה', 'דנמרק', 'הולנד',
  'נורבגיה', 'סלובקיה', 'פולין', 'פינלנד', 'צ\'כיה',
  'צרפת', 'רומניה', 'רוסיה', 'שבדיה', 'שוויץ',
] as const;

// --- Crossing ---
export interface TravelCrossing {
  id: string;
  departureDate: string;   // "YYYY-MM-DD"
  returnDate: string;      // "YYYY-MM-DD"
  exemption: ExemptionType;
  destination?: string;    // destination country (for treaty logic)
}

// --- Old-Age Eligibility ---
export type OldAgeInsuredStatus =
  | 'worker_insured'       // עובד/ת מבוטח/ת (צבר/ה תקופת אכשרה)
  | 'housewife'            // עקרת בית (ללא תקופת אכשרה כעובדת)
  | 'exempt_housewife';    // עקרת בית פטורה מאכשרה (גרושה/אלמנה וכו')

export interface OldAgeEligibility {
  insuredStatus: OldAgeInsuredStatus;
  yearsResidency: number;         // שנות תושבות בישראל
  monthsAsWorker: number;         // חודשי ביטוח כעובד/ת מבוטח/ת
  had12Of24Months: boolean;       // ישב בארץ 12 מתוך 24 חודשים לפני יציאה/זכאות
  fiveYearsBeforeDeparture: boolean; // תושב 5 שנים לפחות לפני היציאה
  receivingPensionBeforeDeparture: boolean; // קיבל קצבה לפני שיצא
  isResidentDespiteAbroad: boolean; // תושב ישראל למרות שהות בחו"ל
}

// --- Spouse ---
export interface SpouseInfo {
  hasSpouse: boolean;
  spouseName?: string;
  spouseIdNumber?: string;
  spouseAbroad?: boolean;          // בן/בת זוג בחו"ל
  spouseCrossings?: TravelCrossing[];
  spouseDependentSupplement?: boolean; // מקבל תוספת תלויים
  spouseCeasedResidency?: boolean; // בן/בת זוג חדל/ה להיות תושב/ת
  spouseMonthsAbroad?: number;     // מספר חודשים בחו"ל
}

// --- Claimant Input ---
export interface ClaimantInput {
  fullName: string;
  idNumber: string;
  calendarYear: number;
  benefitType: BenefitType;
  crossings: TravelCrossing[];
  // Old-age specific
  oldAgeEligibility?: OldAgeEligibility;
  // Spouse
  spouse?: SpouseInfo;
  // Destination country (for treaty/USA detection)
  destinationCountry?: string;
}

// --- Month Result ---
export interface MonthResult {
  month: string;          // "YYYY-MM"
  monthLabel: string;     // Hebrew month name
  status: MonthStatus;
  reason?: string;
  ruleRef?: string;
}

// --- Decision Trace ---
export interface DecisionTraceEntry {
  step: number;
  ruleId: string;
  description: string;
  result: string;
}

// --- Audit Result ---
export interface AuditResult {
  benefitType: BenefitType;
  rawCrossingsCount: number;
  validCrossingsCount: number;
  exemptDaysDeducted: number;
  totalDaysAbroad: number;
  actionType: ActionType;
  monthResults: MonthResult[];
  warnings: string[];
  decisionTrace: DecisionTraceEntry[];
  // Spouse result
  spouseResult?: SpouseAuditResult;
}

export interface SpouseAuditResult {
  supplementStatus: 'continues' | 'suspended' | 'terminated';
  suspensionMonths?: string[];
  reason: string;
  ruleRef: string;
}
