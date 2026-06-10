import { AuditResult, ActionType, BenefitType } from '../types/types';

interface Props {
  result: AuditResult;
}

function getActionDisplay(actionType: ActionType): { label: string; cls: string } {
  switch (actionType) {
    case 'FullyApproved': return { label: 'מאושר', cls: 'bg-green-100 text-green-800 border-green-300' };
    case 'UnlimitedApproved': return { label: 'מאושר ללא הגבלה', cls: 'bg-green-100 text-green-800 border-green-300' };
    case 'SelectiveDisallowance': return { label: 'שלילה ממוקדת', cls: 'bg-orange-100 text-orange-800 border-orange-300' };
    case 'RetroactiveYearlyDisallowance': return { label: 'שלילה רטרואקטיבית', cls: 'bg-red-100 text-red-800 border-red-300' };
    case 'FullDisallowance': return { label: 'שלילה מלאה', cls: 'bg-red-100 text-red-800 border-red-300' };
    case 'ThreeMonthLimit': return { label: '3 חודשים בלבד', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'OneMonthLimit': return { label: 'חודש אחד בלבד', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'NotEligible': return { label: 'אין זכאות', cls: 'bg-red-100 text-red-800 border-red-300' };
    default: return { label: '', cls: '' };
  }
}

function getBenefitLabel(bt: BenefitType): string {
  switch (bt) {
    case 'incomeAssurance_retirement': return 'הבטחת הכנסה - גיל פרישה';
    case 'incomeAssurance_preRetirement': return 'הבטחת הכנסה - טרום פרישה';
    case 'oldAge_noTreaty': return 'קצבת זקנה - ללא אמנה';
    case 'oldAge_treaty': return 'קצבת זקנה - מדינת אמנה';
    case 'oldAge_usa': return 'קצבת זקנה - ארה"ב';
    case 'specialOldAge': return 'גמ"ז';
  }
}

export function ResultCalendar({ result }: Props) {
  const action = getActionDisplay(result.actionType);
  const disqualified = result.monthResults.filter(m => m.status === 'Disqualified').length;
  const approved = result.monthResults.filter(m => m.status === 'Approved').length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-[#1E3A5F] mb-3 text-right">תוצאות ביקורת</h2>

      {/* Benefit type badge */}
      <div className="mb-3 text-right">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#1E3A5F] text-white">
          {getBenefitLabel(result.benefitType)}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-gray-50 rounded-md">
          <p className="text-lg font-bold text-gray-800">{result.validCrossingsCount}</p>
          <p className="text-[10px] text-gray-500">יציאות תקפות</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-md">
          <p className="text-lg font-bold text-gray-800">{result.totalDaysAbroad}</p>
          <p className="text-[10px] text-gray-500">ימי שהות</p>
        </div>
        <div className={`text-center p-2 rounded-md border ${action.cls}`}>
          <p className="text-xs font-bold">{action.label}</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-1 mb-4 h-2 rounded-full overflow-hidden">
        {approved > 0 && <div className="bg-green-400" style={{ flex: approved }}></div>}
        {disqualified > 0 && <div className="bg-red-400" style={{ flex: disqualified }}></div>}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mb-4">
        <span>{disqualified} נשללו</span>
        <span>{approved} מאושרים</span>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-md text-right">
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700">- {w}</p>
          ))}
        </div>
      )}

      {/* Spouse */}
      {result.spouseResult && result.spouseResult.supplementStatus !== 'continues' && (
        <div className="mb-4 p-2 bg-purple-50 border border-purple-200 rounded-md text-right">
          <p className="text-xs font-bold text-purple-800">בן/בת זוג:</p>
          <p className="text-xs text-purple-700">{result.spouseResult.reason}</p>
          <p className="text-[10px] text-purple-500">{result.spouseResult.ruleRef}</p>
        </div>
      )}

      {/* 12-month grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {result.monthResults.map(m => {
          const isDisq = m.status === 'Disqualified';
          const isReview = m.status === 'ReviewRequired';
          const cellCls = isDisq ? 'bg-red-50 border-r-4 border-red-500' :
            isReview ? 'bg-amber-50 border-r-4 border-amber-500' :
              'bg-green-50 border-r-4 border-green-500';

          return (
            <div key={m.month} className={`rounded-md p-1.5 ${cellCls}`}
              title={`${m.reason || ''} | ${m.ruleRef || ''}`}>
              <p className="text-[11px] font-bold text-gray-800 text-right">{m.monthLabel}</p>
              <p className="text-[10px] text-right mt-0.5">
                {isDisq ? '❌' : isReview ? '⚠️' : '✅'}
                <span className="mr-1">{isDisq ? 'נשלל' : isReview ? 'לבדיקה' : 'מאושר'}</span>
              </p>
              {m.reason && <p className="text-[9px] text-gray-500 text-right leading-tight mt-0.5">{m.reason}</p>}
            </div>
          );
        })}
      </div>

      {/* Decision Trace */}
      <details className="border-t pt-2">
        <summary className="text-sm font-bold text-gray-700 text-right cursor-pointer">מעקב החלטות ({result.decisionTrace.length} שלבים)</summary>
        <div className="mt-2 space-y-1">
          {result.decisionTrace.map(t => (
            <div key={t.step} className="text-xs text-gray-600 text-right py-1 border-b border-gray-100">
              <span className="font-mono text-[10px] bg-gray-100 px-1 rounded ml-1">{t.ruleId}</span>
              <span className="font-medium">{t.description}: </span>
              <span>{t.result}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
