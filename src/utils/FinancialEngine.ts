export type SpendingCurve = 'front-loaded' | 'back-loaded' | 'peak-valley' | 'uniform';

export interface TravelDNA {
  paceIndex:          number;
  culinaryAffinity:   number;
  accommodationTier:  number;
  experienceWeight:   number;
  flexibilityScore:   number;
  spendingCurve:      SpendingCurve;
  diningSelections:   string[];
  activitySelections: string[];
}

export interface DayBurnAllocation {
  dayId:         string;
  baseAllowance: number;
  throttled:     number;
  isConstrained: boolean;
}

export interface BurnSchedule {
  dailyAllocations: DayBurnAllocation[];
  throttleCoeff:    number;
  burnPressure:     number;
  severity:         'none' | 'watch' | 'critical';
  projectedTotal:   number;
  optimalDailyBase: number;
}

function buildDNACurve(dna: TravelDNA, n: number): number[] {
  const weights: number[] = [];

  for (let i = 0; i < n; i++) {
    let w: number;

    switch (dna.spendingCurve) {
      case 'uniform':
        w = 1.0;
        break;
      case 'front-loaded':
        w = Math.max(0.4, 1.6 - (i / (n - 1)) * 1.2);
        break;
      case 'back-loaded':
        w = Math.max(0.4, 0.4 + (i / (n - 1)) * 1.2);
        break;
      case 'peak-valley':
        w = n === 1 ? 1.0 : 0.6 + 0.9 * Math.sin(Math.PI * i / (n - 1));
        break;
    }

    // luxury mid-trip amplifier
    w *= 1 + dna.paceIndex * 0.35 * Math.sin(Math.PI * i / (n - 1));

    // culinary day-of-week boost (every 3rd day, 0-indexed day 2, 5, 8 …)
    if (dna.culinaryAffinity > 0.6) {
      w += dna.culinaryAffinity * 0.15 * (i % 3 === 2 ? 1 : 0);
    }

    weights.push(w);
  }

  const mean = weights.reduce((a, b) => a + b, 0) / n;
  return weights.map(w => w / mean);
}

export function computeOptimalBurnSchedule(params: {
  dna:         TravelDNA;
  dayIds:      string[];
  totalBudget: number;
  fixedCosts:  number;
}): BurnSchedule {
  const n = params.dayIds.length;
  const spendable = params.totalBudget - params.fixedCosts;
  const optimalDailyBase = spendable / n;
  const curve = buildDNACurve(params.dna, n);

  const dailyAllocations: DayBurnAllocation[] = params.dayIds.map((dayId, i) => ({
    dayId,
    baseAllowance: optimalDailyBase * curve[i],
    throttled:     optimalDailyBase * curve[i],
    isConstrained: false,
  }));

  return {
    dailyAllocations,
    throttleCoeff:    1.0,
    burnPressure:     0,
    severity:         'none',
    projectedTotal:   params.totalBudget,
    optimalDailyBase,
  };
}

export function recalibrateAfterPlacement(params: {
  dna:         TravelDNA;
  days:        Array<{ id: string; entities: Array<{ price: number; booked: boolean }> }>;
  totalBudget: number;
  fixedCosts:  number;
}): BurnSchedule {
  const n = params.days.length;
  const spendable = params.totalBudget - params.fixedCosts;
  const optimalDailyBase = spendable / n;
  const curve = buildDNACurve(params.dna, n);

  const baseAllowance = curve.map(c => optimalDailyBase * c);

  const actualSpentPerDay = params.days.map(day =>
    day.entities.reduce((sum, e) => sum + e.price, 0)
  );

  const totalActualSpent = actualSpentPerDay.reduce((a, b) => a + b, 0);

  let lastActiveIndex = -1;
  for (let i = 0; i < n; i++) {
    if (actualSpentPerDay[i] > 0) lastActiveIndex = i;
  }

  if (lastActiveIndex === -1) {
    return computeOptimalBurnSchedule({
      dna:         params.dna,
      dayIds:      params.days.map(d => d.id),
      totalBudget: params.totalBudget,
      fixedCosts:  params.fixedCosts,
    });
  }

  const expectedAtThisPoint = baseAllowance
    .slice(0, lastActiveIndex + 1)
    .reduce((a, b) => a + b, 0);

  const burnPressure = expectedAtThisPoint > 0 ? totalActualSpent / expectedAtThisPoint : 0;

  const remainingBudget = Math.max(0, spendable - totalActualSpent);
  const remainingBaseSum = baseAllowance
    .slice(lastActiveIndex + 1)
    .reduce((a, b) => a + b, 0);

  const rawThrottle = remainingBaseSum > 0 ? remainingBudget / remainingBaseSum : 0;
  const throttleCoeff = Math.min(2.5, Math.max(0, rawThrottle));

  const dailyAllocations: DayBurnAllocation[] = params.days.map((day, i) => {
    if (i <= lastActiveIndex) {
      return {
        dayId:         day.id,
        baseAllowance: baseAllowance[i],
        throttled:     actualSpentPerDay[i],
        isConstrained: false,
      };
    }
    const throttled = baseAllowance[i] * throttleCoeff;
    return {
      dayId:         day.id,
      baseAllowance: baseAllowance[i],
      throttled,
      isConstrained: throttled < baseAllowance[i] * 0.85,
    };
  });

  const severity: BurnSchedule['severity'] =
    burnPressure >= 1.0 ? 'critical' :
    burnPressure >= 0.85 ? 'watch' :
    'none';

  const futureThrottledSum = dailyAllocations
    .slice(lastActiveIndex + 1)
    .reduce((a, d) => a + d.throttled, 0);

  const projectedTotal = totalActualSpent + futureThrottledSum;

  return {
    dailyAllocations,
    throttleCoeff,
    burnPressure,
    severity,
    projectedTotal,
    optimalDailyBase,
  };
}

export function deriveDNAFromSelections(params: {
  paceIndex:         number;
  diningSelections:  string[];
  basecampSelection: 'boutique' | 'design-hotel' | 'ultra-luxury';
  activitySelections: string[];
}): TravelDNA {
  const diningScores: number[] = [0.20];
  if (params.diningSelections.includes('michelin'))     diningScores.push(0.95);
  if (params.diningSelections.includes('fine-dining'))  diningScores.push(0.75);
  if (params.diningSelections.includes('contemporary')) diningScores.push(0.55);
  if (params.diningSelections.includes('local'))        diningScores.push(0.30);
  const culinaryAffinity = Math.min(1, Math.max(0, Math.max(...diningScores)));

  const accommodationTierMap: Record<'boutique' | 'design-hotel' | 'ultra-luxury', number> = {
    'boutique':      0.2,
    'design-hotel':  0.55,
    'ultra-luxury':  0.95,
  };
  const accommodationTier = accommodationTierMap[params.basecampSelection];

  const experienceWeight = Math.min(1, params.activitySelections.length / 4) + 0.1 * params.paceIndex;

  const flexibilityScore = 1.0 - params.paceIndex * 0.4;

  let spendingCurve: SpendingCurve;
  if (params.paceIndex < 0.3) {
    spendingCurve = 'front-loaded';
  } else if (params.paceIndex < 0.65) {
    spendingCurve = 'uniform';
  } else if (culinaryAffinity > 0.6) {
    spendingCurve = 'peak-valley';
  } else {
    spendingCurve = 'back-loaded';
  }

  return {
    paceIndex:          params.paceIndex,
    culinaryAffinity,
    accommodationTier,
    experienceWeight,
    flexibilityScore,
    spendingCurve,
    diningSelections:   params.diningSelections,
    activitySelections: params.activitySelections,
  };
}

export const FinancialEngine = {
  computeOptimalBurnSchedule,
  recalibrateAfterPlacement,
  deriveDNAFromSelections,
};
