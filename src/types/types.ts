// --- Benefit Types (simplified for user) ---
export type BenefitType =
  | 'incomeAssurance_retirement'     // הבטחת הכנסה / השלמת הכנסה - גיל פרישה
  | 'incomeAssurance_preRetirement'  // הבטחת הכנסה - טרום פרישה
  | 'oldAge_noTreaty'               // קצבת זקנה - מדינה ללא אמנה (לא ארה"ב)
  | 'oldAge_treaty'                 // קצבת זקנה - מדינת אמנה
  | 'oldAge_usa'                    // קצבת זקנה - ארה"ב
  | 'specialOldAge'                 // גמלה מיוחדת (גמ"ז)
  | 'survivors_noTreaty'            // קצבת שאירים - מדינה ללא אמנה
  | 'survivors_treaty'              // קצבת שאירים - מדינת אמנה
  | 'survivors_usa';                // קצבת שאירים - ארה"ב

// What the user actually selects (high-level category)
export type UserBenefitChoice =
  | 'incomeAssurance_retirement'
  | 'incomeAssurance_preRetirement'
  | 'oldAge'                         // קצבת זקנה (מדינה תיקבע אוטומטית)
  | 'specialOldAge'
  | 'survivors';                     // קצבת שאירים (מדינה תיקבע אוטומטית)

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
  | 'NotEligible'                   // אין זכאות כלל
  | 'ThirtySixMonthLimit';           // 36 חודשים (שאירים)

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

// --- Survivors Eligibility ---
export type SurvivorType = 'widow' | 'widower' | 'child' | 'remarried_widow';

export interface SurvivorsEligibility {
  survivorType: SurvivorType;
  deceasedWasResident: boolean;          // המנוח היה תושב ישראל בעת פטירתו
  deceasedInsuranceMonths: number;       // חודשי ביטוח של המנוח/ה
  deceasedCompletedAkshara: boolean;     // המנוח השלים תקופת אכשרה
  survivorAge: number;                   // גיל האלמן/ה בצאתו לחו"ל
  hasChildWithSurvivor: boolean;         // יש ילד עם האלמן (רלוונטי לאלמן)
  childAge?: number;                     // גיל הילד (רלוונטי לילד שאיר)
  childWithParentOver50?: boolean;       // הילד עם הורה בן 50+
  deceasedOrSurvivorInIsrael12Months: boolean; // ב-12 חודשים לפני הפטירה - המנוח או שאיר בישראל
}

// --- Multi-benefit selection ---
export interface ClaimantInput {
  fullName: string;
  idNumber: string;
  calendarYear: number;
  benefitType: BenefitType;
  secondBenefitType?: BenefitType;       // אפשרות לבחור קצבה נוספת (זקנה + השלמת הכנסה)
  crossings: TravelCrossing[];
  // Old-age specific
  oldAgeEligibility?: OldAgeEligibility;
  // Survivors specific
  survivorsEligibility?: SurvivorsEligibility;
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
  // Secondary benefit (e.g. income supplement alongside old-age)
  secondaryResult?: {
    benefitType: BenefitType;
    actionType: ActionType;
    monthResults: MonthResult[];
    decisionTrace: DecisionTraceEntry[];
  };
}

export interface SpouseAuditResult {
  supplementStatus: 'continues' | 'suspended' | 'terminated';
  suspensionMonths?: string[];
  reason: string;
  ruleRef: string;
}
