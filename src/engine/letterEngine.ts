import { ClaimantInput, AuditResult, BenefitType } from '../types/types';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function today(): string {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`;
}

function getBenefitLabel(bt: BenefitType): string {
  switch (bt) {
    case 'incomeAssurance_retirement': return 'הבטחת הכנסה / השלמת הכנסה (גיל פרישה)';
    case 'incomeAssurance_preRetirement': return 'הבטחת הכנסה (טרום פרישה)';
    case 'oldAge_noTreaty': return 'קצבת אזרח ותיק - מדינה ללא אמנה';
    case 'oldAge_treaty': return 'קצבת אזרח ותיק - מדינת אמנה';
    case 'oldAge_usa': return 'קצבת אזרח ותיק - ארה"ב';
    case 'specialOldAge': return 'גמלה מיוחדת לאזרח ותיק (גמ"ז)';
    case 'survivors_noTreaty': return 'קצבת שאירים - מדינה ללא אמנה';
    case 'survivors_treaty': return 'קצבת שאירים - מדינת אמנה';
    case 'survivors_usa': return 'קצבת שאירים - ארה"ב';
  }
}

function getExemptionLabel(ex: string): string {
  switch (ex) {
    case 'Mourning': return 'אבל';
    case 'Hajj': return 'חאג\'';
    case 'Medical': return 'טיפול רפואי';
    case 'Employer': return 'מטעם המעסיק';
    default: return '';
  }
}

export function generateLetter42(input: ClaimantInput, result: AuditResult): string {
  const L: string[] = [];

  L.push(`לכבוד ${input.fullName}`);
  L.push(`ת.ז. ${input.idNumber}`);
  L.push('');
  L.push(`הנדון: ${getBenefitLabel(input.benefitType)} - הודעה על שינוי זכאות לשנת ${input.calendarYear}`);
  L.push('');
  L.push(`בהמשך לבדיקת תיקך, נמצאו תקופות שהייה מחוץ לישראל בשנת ${input.calendarYear}:`);
  L.push('');

  // List crossings
  const validCrossings = input.crossings.filter(c => {
    const dep = new Date(c.departureDate);
    const ret = new Date(c.returnDate);
    return (ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24) > 1;
  });

  for (const c of validCrossings) {
    const exLabel = c.exemption !== 'None' ? ` (${getExemptionLabel(c.exemption)})` : '';
    L.push(`- יציאה ${formatDate(c.departureDate)} - חזרה ${formatDate(c.returnDate)}${exLabel}`);
  }
  L.push('');
  L.push(`סה"כ יציאות תקפות: ${result.validCrossingsCount} | ימי שהות בחו"ל: ${result.totalDaysAbroad}`);
  L.push('');

  // --- Decision paragraphs ---
  const disqualifiedMonths = result.monthResults
    .filter(m => m.status === 'Disqualified')
    .map(m => m.monthLabel)
    .join(', ');

  switch (result.actionType) {
    case 'FullyApproved':
    case 'UnlimitedApproved':
      if (input.benefitType === 'incomeAssurance_retirement') {
        L.push('בדיקת תיקך העלתה כי שהייתך בחו"ל עומדת במסגרת המותרת לפי');
        L.push('סעיף 4(א) לתקנות הבטחת הכנסה (כללים בדבר יציאה מישראל לגיל פרישה).');
        L.push('אין שינוי בזכאותך.');
      } else if (input.benefitType.startsWith('oldAge')) {
        L.push('בדיקת תיקך העלתה כי אתה עומד/ת בתנאים להמשך תשלום קצבת אזרח ותיק בחו"ל');
        L.push('בהתאם לסעיף 324 לחוק הביטוח הלאומי וחוזר 1629/2021.');
        L.push('הקצבה תמשיך להשתלם ללא הגבלת זמן.');
      } else {
        L.push('בדיקת תיקך העלתה כי שהייתך בחו"ל עומדת במסגרת המותרת. אין שינוי בזכאותך.');
      }
      break;

    case 'SelectiveDisallowance': {
      const nonExempt = validCrossings.filter(c => c.exemption === 'None');
      const fourthDate = nonExempt.length >= 4 ? formatDate(nonExempt[3].departureDate) : '';
      L.push('בהתאם לסעיף 4(ב) לתקנות הבטחת הכנסה (כללים בדבר יציאה מישראל לגיל פרישה),');
      L.push(`מאחר ומספר יציאותיך הגיע ל-4 ביציאה שביצעת בתאריך ${fourthDate},`);
      L.push('הגמלה נשללת בגין חודשי הנסיעה החל מהיציאה הרביעית בשנה הקלנדרית.');
      L.push('');
      L.push(`חודשים הנתונים לשלילה: ${disqualifiedMonths}.`);
      break;
    }

    case 'RetroactiveYearlyDisallowance':
      L.push('בהתאם לסעיף 4(ג) לתקנות הבטחת הכנסה (כללים בדבר יציאה מישראל לגיל פרישה),');
      L.push(`משחצה מספר היציאות את חמש היציאות או סך הימים את 100 ימים`);
      L.push(`(${result.validCrossingsCount} יציאות / ${result.totalDaysAbroad} ימים),`);
      L.push('תישלל הגמלה רטרואקטיבית לכלל חודשי השהות בחו"ל באותה שנה קלנדרית.');
      L.push('');
      L.push(`חודשים הנתונים לשלילה: ${disqualifiedMonths}.`);
      break;

    case 'FullDisallowance':
      L.push('בהתאם לסעיף 14(א)(ב)(1) לחוק הבטחת הכנסה,');
      L.push('מאחר ויצאת לחו"ל יציאה נוספת בשנה קלנדרית (טרום גיל פרישה),');
      L.push('הגמלה אינה משתלמת בתקופת שהותך בחו"ל, כולל חודש היציאה וחודש החזרה.');
      L.push('');
      if (disqualifiedMonths) L.push(`חודשים הנתונים לשלילה: ${disqualifiedMonths}.`);
      break;

    case 'ThreeMonthLimit':
      L.push('בהתאם לסעיף 324 לחוק הביטוח הלאומי,');
      L.push('הקצבה תמשיך להשתלם במשך 3 חודשים בלבד לאחר חודש היציאה מישראל.');
      L.push('לאחר מכן, תשלום הקצבה יופסק עד לשובך לישראל.');
      L.push('');
      if (disqualifiedMonths) L.push(`חודשים הנתונים לשלילה: ${disqualifiedMonths}.`);
      break;

    case 'OneMonthLimit':
      L.push('בהתאם לכללי תשלום גמלה מיוחדת לאזרח ותיק (גמ"ז),');
      L.push('הגמלה תמשיך להשתלם בחודש קלנדרי אחד בלבד לאחר חודש היציאה.');
      L.push('לאחר מכן, תשלום הגמלה יופסק.');
      L.push('');
      if (disqualifiedMonths) L.push(`חודשים הנתונים לשלילה: ${disqualifiedMonths}.`);
      break;

    case 'NotEligible':
      L.push('לאחר בדיקת תיקך נמצא כי אינך עומד/ת בתנאים להמשך תשלום קצבה בחו"ל');
      L.push('בהתאם לסעיף 324 לחוק הביטוח הלאומי וחוזר 1629/2021.');
      L.push('הקצבה תופסק בתום 3 חודשים ממועד היציאה מישראל.');
      L.push('');
      if (disqualifiedMonths) L.push(`חודשים הנתונים לשלילה: ${disqualifiedMonths}.`);
      break;
  }

  L.push('');

  // Spouse note
  if (result.spouseResult && result.spouseResult.supplementStatus !== 'continues') {
    L.push('---');
    L.push(`הערה בנושא בן/בת זוג: ${result.spouseResult.reason}`);
    L.push(`(${result.spouseResult.ruleRef})`);
    L.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    L.push('---');
    L.push('הערות לפקיד:');
    for (const w of result.warnings) {
      L.push(`* ${w}`);
    }
    L.push('');
  }

  // Appeal rights
  L.push('---');
  L.push('בידך הזכות להגיש ערעור על החלטה זו בתוך 12 חודשים מיום קבלת הודעה זו');
  L.push('לבית הדין האזורי לעבודה, לפי סעיף 14 לחוק הבטחת הכנסה.');
  L.push('');
  L.push('לפרטים נוספים, פנה/י לסניף הביטוח הלאומי הקרוב למקום מגוריך.');
  L.push('');
  L.push(`תאריך הפקה: ${today()}`);

  return L.join('\n');
}
