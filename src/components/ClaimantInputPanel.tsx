import { useState } from 'react';
import { ClaimantInput, TravelCrossing, ExemptionType, BenefitType, OldAgeEligibility, OldAgeInsuredStatus, SpouseInfo, TREATY_COUNTRIES } from '../types/types';

interface Props {
  onRunAudit: (input: ClaimantInput) => void;
}

const BENEFIT_OPTIONS: { value: BenefitType; label: string }[] = [
  { value: 'incomeAssurance_retirement', label: 'הבטחת הכנסה - גיל פרישה' },
  { value: 'incomeAssurance_preRetirement', label: 'הבטחת הכנסה - טרום פרישה' },
  { value: 'oldAge_noTreaty', label: 'קצבת זקנה - מדינה ללא אמנה' },
  { value: 'oldAge_treaty', label: 'קצבת זקנה - מדינת אמנה' },
  { value: 'oldAge_usa', label: 'קצבת זקנה - ארה"ב' },
  { value: 'specialOldAge', label: 'גמ"ז - גמלה מיוחדת' },
];

export function ClaimantInputPanel({ onRunAudit }: Props) {
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [benefitType, setBenefitType] = useState<BenefitType>('incomeAssurance_retirement');
  const [crossings, setCrossings] = useState<TravelCrossing[]>([]);
  const [destinationCountry, setDestinationCountry] = useState('');

  // Old Age fields
  const [insuredStatus, setInsuredStatus] = useState<OldAgeInsuredStatus>('worker_insured');
  const [yearsResidency, setYearsResidency] = useState(0);
  const [monthsAsWorker, setMonthsAsWorker] = useState(0);
  const [had12Of24, setHad12Of24] = useState(true);
  const [fiveYears, setFiveYears] = useState(true);
  const [receivingPension, setReceivingPension] = useState(true);
  const [isResident, setIsResident] = useState(false);

  // Spouse
  const [hasSpouse, setHasSpouse] = useState(false);
  const [spouseAbroad, setSpouseAbroad] = useState(false);
  const [spouseDependentSupplement, setSpouseDependentSupplement] = useState(false);
  const [spouseCeasedResidency, setSpouseCeasedResidency] = useState(false);
  const [spouseMonthsAbroad, setSpouseMonthsAbroad] = useState(0);

  function addCrossing() {
    setCrossings([...crossings, {
      id: crypto.randomUUID(),
      departureDate: '',
      returnDate: '',
      exemption: 'None',
    }]);
  }

  function removeCrossing(id: string) {
    setCrossings(crossings.filter(c => c.id !== id));
  }

  function updateCrossing(id: string, field: keyof TravelCrossing, value: string) {
    setCrossings(crossings.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  function handleSubmit() {
    const oldAgeEligibility: OldAgeEligibility | undefined = benefitType.startsWith('oldAge') ? {
      insuredStatus,
      yearsResidency,
      monthsAsWorker,
      had12Of24Months: had12Of24,
      fiveYearsBeforeDeparture: fiveYears,
      receivingPensionBeforeDeparture: receivingPension,
      isResidentDespiteAbroad: isResident,
    } : undefined;

    const spouse: SpouseInfo | undefined = hasSpouse ? {
      hasSpouse: true,
      spouseAbroad,
      spouseDependentSupplement,
      spouseCeasedResidency,
      spouseMonthsAbroad,
    } : undefined;

    onRunAudit({
      fullName: fullName.trim(),
      idNumber: idNumber.trim(),
      calendarYear,
      benefitType,
      crossings,
      oldAgeEligibility,
      spouse,
      destinationCountry,
    });
  }

  const isOldAge = benefitType.startsWith('oldAge');
  const isTreaty = benefitType === 'oldAge_treaty';
  const isValid = fullName.trim() && idNumber.trim() && crossings.length > 0 &&
    crossings.every(c => c.departureDate && c.returnDate);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-[#1E3A5F] mb-4 text-right">קלט תובע</h2>

      {/* Basic Info */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 text-right">שם מלא</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-right text-sm focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none" dir="rtl" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 text-right">תעודת זהות</label>
          <input type="text" value={idNumber} onChange={e => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 9))} maxLength={9}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-right text-sm focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none" dir="rtl" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-right">שנת בדיקה</label>
            <input type="number" value={calendarYear} onChange={e => setCalendarYear(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-right text-sm focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none" dir="rtl" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-right">סוג גמלה</label>
            <select value={benefitType} onChange={e => setBenefitType(e.target.value as BenefitType)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-right text-sm focus:ring-2 focus:ring-[#1E3A5F] outline-none" dir="rtl">
              {BENEFIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {isTreaty && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-right">מדינת אמנה</label>
            <select value={destinationCountry} onChange={e => setDestinationCountry(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-right text-sm" dir="rtl">
              <option value="">בחר מדינה</option>
              {TREATY_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Old Age Eligibility */}
      {isOldAge && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-sm font-bold text-blue-800 mb-2 text-right">נתוני זכאות - קצבת זקנה</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-blue-700 mb-1 text-right">מעמד ביטוחי</label>
              <select value={insuredStatus} onChange={e => setInsuredStatus(e.target.value as OldAgeInsuredStatus)}
                className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-right" dir="rtl">
                <option value="worker_insured">עובד/ת מבוטח/ת (צבר/ה תקופת אכשרה)</option>
                <option value="housewife">עקרת בית (ללא אכשרה כעובדת)</option>
                <option value="exempt_housewife">עקרת בית פטורה מאכשרה</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-blue-700 mb-1 text-right">שנות תושבות</label>
                <input type="number" value={yearsResidency} onChange={e => setYearsResidency(Number(e.target.value))}
                  className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-right" />
              </div>
              <div>
                <label className="block text-xs text-blue-700 mb-1 text-right">חודשי ביטוח כעובד/ת</label>
                <input type="number" value={monthsAsWorker} onChange={e => setMonthsAsWorker(Number(e.target.value))}
                  className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-right" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="flex items-center justify-end gap-2 text-xs text-blue-700 cursor-pointer">
                <span>ישב בארץ 12 מתוך 24 חודשים לפני יציאה/זכאות</span>
                <input type="checkbox" checked={had12Of24} onChange={e => setHad12Of24(e.target.checked)} className="rounded" />
              </label>
              <label className="flex items-center justify-end gap-2 text-xs text-blue-700 cursor-pointer">
                <span>תושב 5 שנים לפחות לפני היציאה</span>
                <input type="checkbox" checked={fiveYears} onChange={e => setFiveYears(e.target.checked)} className="rounded" />
              </label>
              <label className="flex items-center justify-end gap-2 text-xs text-blue-700 cursor-pointer">
                <span>קיבל/ה קצבה לפני שיצא/ה לחו"ל</span>
                <input type="checkbox" checked={receivingPension} onChange={e => setReceivingPension(e.target.checked)} className="rounded" />
              </label>
              <label className="flex items-center justify-end gap-2 text-xs text-blue-700 cursor-pointer">
                <span>תושב/ת ישראל למרות שהות בחו"ל</span>
                <input type="checkbox" checked={isResident} onChange={e => setIsResident(e.target.checked)} className="rounded" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Spouse */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <label className="flex items-center justify-end gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <span>בן/בת זוג</span>
          <input type="checkbox" checked={hasSpouse} onChange={e => setHasSpouse(e.target.checked)} className="rounded" />
        </label>
        {hasSpouse && (
          <div className="mt-2 space-y-1">
            <label className="flex items-center justify-end gap-2 text-xs text-gray-600 cursor-pointer">
              <span>בן/בת הזוג בחו"ל</span>
              <input type="checkbox" checked={spouseAbroad} onChange={e => setSpouseAbroad(e.target.checked)} className="rounded" />
            </label>
            {spouseAbroad && (
              <>
                <label className="flex items-center justify-end gap-2 text-xs text-gray-600 cursor-pointer">
                  <span>מקבל/ת תוספת תלויים</span>
                  <input type="checkbox" checked={spouseDependentSupplement} onChange={e => setSpouseDependentSupplement(e.target.checked)} className="rounded" />
                </label>
                <label className="flex items-center justify-end gap-2 text-xs text-gray-600 cursor-pointer">
                  <span>חדל/ה להיות תושב/ת</span>
                  <input type="checkbox" checked={spouseCeasedResidency} onChange={e => setSpouseCeasedResidency(e.target.checked)} className="rounded" />
                </label>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 text-right">חודשי שהות בחו"ל</label>
                  <input type="number" value={spouseMonthsAbroad} onChange={e => setSpouseMonthsAbroad(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Crossings */}
      <h3 className="text-sm font-bold text-gray-700 mb-2 text-right">נסיעות ({crossings.length})</h3>
      {crossings.length > 0 && (
        <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
          {crossings.map((c, idx) => (
            <div key={c.id} className="border border-gray-200 rounded-md p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => removeCrossing(c.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">מחק</button>
                <span className="text-xs text-gray-500 font-medium">#{idx + 1}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1 text-right">תאריך יציאה</label>
                  <input type="date" value={c.departureDate} onChange={e => updateCrossing(c.id, 'departureDate', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 text-right">תאריך חזרה</label>
                  <input type="date" value={c.returnDate} onChange={e => updateCrossing(c.id, 'returnDate', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 text-right">סוג חריג</label>
                <select value={c.exemption} onChange={e => updateCrossing(c.id, 'exemption', e.target.value as ExemptionType)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right" dir="rtl">
                  <option value="None">רגיל</option>
                  <option value="Mourning">אבל - פטירת בן משפחה</option>
                  <option value="Hajj">חאג' - פעם ראשונה בחיים</option>
                  <option value="Medical">טיפול רפואי (אישור קופ"ח)</option>
                  <option value="Employer">מטעם המעסיק</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={addCrossing}
        className="w-full border-2 border-dashed border-gray-300 rounded-md py-2 text-sm text-gray-600 hover:border-[#1E3A5F] hover:text-[#1E3A5F] transition-colors mb-4">
        + הוסף נסיעה
      </button>

      <button onClick={handleSubmit} disabled={!isValid}
        className="w-full py-3 rounded-md text-white font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
        style={{ backgroundColor: isValid ? '#1E3A5F' : '#94a3b8' }}>
        בצע ביקורת
      </button>
    </div>
  );
}
