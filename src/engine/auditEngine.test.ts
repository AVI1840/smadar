import { describe, it, expect } from 'vitest';
import { is24HourTrip, calcDaysAbroad, determineActionRetirement, runAudit } from './auditEngine';
import { TravelCrossing, ClaimantInput } from '../types/types';

function makeCrossing(dep: string, ret: string, exemption: 'None' | 'Mourning' | 'Hajj' | 'Medical' | 'Employer' = 'None'): TravelCrossing {
  return { id: `${dep}-${ret}`, departureDate: dep, returnDate: ret, exemption };
}

function makeRetirementInput(crossings: TravelCrossing[], year = 2026): ClaimantInput {
  return { fullName: 'טסט', idNumber: '123456789', calendarYear: year, benefitType: 'incomeAssurance_retirement', crossings };
}

describe('auditEngine - Income Assurance Retirement', () => {
  it('TEST 1: 24-hour trip filtered out', () => {
    const result = runAudit(makeRetirementInput([makeCrossing('2026-09-10', '2026-09-11')]));
    expect(result.validCrossingsCount).toBe(0);
    expect(result.totalDaysAbroad).toBe(0);
  });

  it('TEST 2: 3 crossings, 60 days = FullyApproved', () => {
    const result = runAudit(makeRetirementInput([
      makeCrossing('2026-02-01', '2026-02-22'),
      makeCrossing('2026-04-01', '2026-04-22'),
      makeCrossing('2026-06-01', '2026-06-22'),
    ]));
    expect(result.validCrossingsCount).toBe(3);
    expect(result.totalDaysAbroad).toBe(60);
    expect(result.actionType).toBe('FullyApproved');
  });

  it('TEST 3: 4 crossings = SelectiveDisallowance', () => {
    const result = runAudit(makeRetirementInput([
      makeCrossing('2026-02-01', '2026-02-18'),
      makeCrossing('2026-04-01', '2026-04-18'),
      makeCrossing('2026-06-01', '2026-06-18'),
      makeCrossing('2026-09-01', '2026-09-19'),
    ]));
    expect(result.validCrossingsCount).toBe(4);
    expect(result.actionType).toBe('SelectiveDisallowance');
    expect(result.monthResults.find(m => m.month === '2026-09')?.status).toBe('Disqualified');
    expect(result.monthResults.find(m => m.month === '2026-02')?.status).toBe('Approved');
  });

  it('TEST 4: 5 crossings = RetroactiveYearlyDisallowance', () => {
    const result = runAudit(makeRetirementInput([
      makeCrossing('2026-01-10', '2026-01-20'),
      makeCrossing('2026-03-05', '2026-03-15'),
      makeCrossing('2026-05-01', '2026-05-12'),
      makeCrossing('2026-07-01', '2026-07-12'),
      makeCrossing('2026-09-01', '2026-09-12'),
    ]));
    expect(result.actionType).toBe('RetroactiveYearlyDisallowance');
    expect(result.monthResults.find(m => m.month === '2026-01')?.status).toBe('Disqualified');
    expect(result.monthResults.find(m => m.month === '2026-02')?.status).toBe('Approved');
  });

  it('TEST 5: day calculation - depart 01/06, return 15/07 = 43 days', () => {
    expect(calcDaysAbroad(makeCrossing('2026-06-01', '2026-07-15'))).toBe(43);
  });

  it('TEST 6: mourning exemption removes from count and deducts days', () => {
    const result = runAudit(makeRetirementInput([
      makeCrossing('2026-02-01', '2026-02-12'),
      makeCrossing('2026-04-01', '2026-04-12'),
      makeCrossing('2026-06-01', '2026-06-12'),
      makeCrossing('2026-08-01', '2026-08-17', 'Mourning'),
    ]));
    expect(result.validCrossingsCount).toBe(3);
    expect(result.totalDaysAbroad).toBe(30);
    expect(result.actionType).toBe('FullyApproved');
  });

  it('TEST 7: crossing spanning full months tags both', () => {
    const result = runAudit(makeRetirementInput([
      makeCrossing('2026-01-05', '2026-01-15'),
      makeCrossing('2026-03-05', '2026-03-15'),
      makeCrossing('2026-04-05', '2026-04-15'),
      makeCrossing('2026-05-05', '2026-05-15'),
      makeCrossing('2026-06-01', '2026-07-31'),
    ]));
    expect(result.monthResults.find(m => m.month === '2026-06')?.status).toBe('Disqualified');
    expect(result.monthResults.find(m => m.month === '2026-07')?.status).toBe('Disqualified');
  });

  it('Tie-break: 3 crossings + 75 days = SelectiveDisallowance', () => {
    expect(determineActionRetirement(3, 75)).toBe('SelectiveDisallowance');
  });

  it('Tie-break: 4 crossings + 102 days = RetroactiveYearlyDisallowance', () => {
    expect(determineActionRetirement(4, 102)).toBe('RetroactiveYearlyDisallowance');
  });

  it('Tie-break: 5 crossings + 60 days = RetroactiveYearlyDisallowance', () => {
    expect(determineActionRetirement(5, 60)).toBe('RetroactiveYearlyDisallowance');
  });
});

describe('auditEngine - Pre-Retirement', () => {
  it('1 crossing = FullyApproved', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'incomeAssurance_preRetirement',
      crossings: [makeCrossing('2026-03-01', '2026-03-15')],
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('FullyApproved');
  });

  it('2 crossings = FullDisallowance, second trip months disqualified', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'incomeAssurance_preRetirement',
      crossings: [
        makeCrossing('2026-03-01', '2026-03-15'),
        makeCrossing('2026-06-01', '2026-06-20'),
      ],
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('FullDisallowance');
    expect(result.monthResults.find(m => m.month === '2026-06')?.status).toBe('Disqualified');
    expect(result.monthResults.find(m => m.month === '2026-03')?.status).toBe('Approved');
  });
});

describe('auditEngine - Old Age No Treaty (Circular 1629)', () => {
  it('25 years residency + basic condition = UnlimitedApproved', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'oldAge_noTreaty',
      crossings: [makeCrossing('2026-03-01', '2026-09-15')],
      oldAgeEligibility: {
        insuredStatus: 'worker_insured',
        yearsResidency: 30,
        monthsAsWorker: 200,
        had12Of24Months: true,
        fiveYearsBeforeDeparture: true,
        receivingPensionBeforeDeparture: true,
        isResidentDespiteAbroad: false,
      },
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('UnlimitedApproved');
  });

  it('144 months worker + 12/24 = UnlimitedApproved', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'oldAge_noTreaty',
      crossings: [makeCrossing('2026-03-01', '2026-12-15')],
      oldAgeEligibility: {
        insuredStatus: 'worker_insured',
        yearsResidency: 15,
        monthsAsWorker: 150,
        had12Of24Months: true,
        fiveYearsBeforeDeparture: true,
        receivingPensionBeforeDeparture: true,
        isResidentDespiteAbroad: false,
      },
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('UnlimitedApproved');
  });

  it('Housewife = ThreeMonthLimit', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'oldAge_noTreaty',
      crossings: [makeCrossing('2026-03-01', '2026-09-15')],
      oldAgeEligibility: {
        insuredStatus: 'housewife',
        yearsResidency: 30,
        monthsAsWorker: 0,
        had12Of24Months: true,
        fiveYearsBeforeDeparture: true,
        receivingPensionBeforeDeparture: true,
        isResidentDespiteAbroad: false,
      },
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('ThreeMonthLimit');
  });

  it('No 5 years before departure = NotEligible', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'oldAge_noTreaty',
      crossings: [makeCrossing('2026-03-01', '2026-09-15')],
      oldAgeEligibility: {
        insuredStatus: 'worker_insured',
        yearsResidency: 30,
        monthsAsWorker: 200,
        had12Of24Months: true,
        fiveYearsBeforeDeparture: false,
        receivingPensionBeforeDeparture: true,
        isResidentDespiteAbroad: false,
      },
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('NotEligible');
  });
});

describe('auditEngine - Old Age Treaty', () => {
  it('Treaty country = UnlimitedApproved', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'oldAge_treaty',
      crossings: [makeCrossing('2026-01-01', '2026-12-31')],
      destinationCountry: 'צרפת',
      oldAgeEligibility: {
        insuredStatus: 'worker_insured',
        yearsResidency: 20,
        monthsAsWorker: 100,
        had12Of24Months: false,
        fiveYearsBeforeDeparture: true,
        receivingPensionBeforeDeparture: true,
        isResidentDespiteAbroad: false,
      },
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('UnlimitedApproved');
  });
});

describe('auditEngine - Old Age USA', () => {
  it('Worker insured in USA = UnlimitedApproved', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'oldAge_usa',
      crossings: [makeCrossing('2026-01-01', '2026-12-31')],
      oldAgeEligibility: {
        insuredStatus: 'worker_insured',
        yearsResidency: 20,
        monthsAsWorker: 100,
        had12Of24Months: false,
        fiveYearsBeforeDeparture: true,
        receivingPensionBeforeDeparture: true,
        isResidentDespiteAbroad: false,
      },
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('UnlimitedApproved');
  });

  it('Housewife in USA = ThreeMonthLimit', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'oldAge_usa',
      crossings: [makeCrossing('2026-01-01', '2026-12-31')],
      oldAgeEligibility: {
        insuredStatus: 'housewife',
        yearsResidency: 20,
        monthsAsWorker: 0,
        had12Of24Months: false,
        fiveYearsBeforeDeparture: true,
        receivingPensionBeforeDeparture: true,
        isResidentDespiteAbroad: false,
      },
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('ThreeMonthLimit');
  });
});

describe('auditEngine - Special Old Age (גמ"ז)', () => {
  it('Always OneMonthLimit', () => {
    const input: ClaimantInput = {
      fullName: 'טסט', idNumber: '123456789', calendarYear: 2026,
      benefitType: 'specialOldAge',
      crossings: [makeCrossing('2026-05-01', '2026-08-15')],
    };
    const result = runAudit(input);
    expect(result.actionType).toBe('OneMonthLimit');
  });
});
