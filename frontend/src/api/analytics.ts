import { mockAccommodationItems } from './accommodation';

export interface RoomTierStats {
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  occupancyRate: number;
  roomNumbers: string;
}

export interface OccupancyStats {
  totalCapacity: number;
  totalOccupied: number;
  occupancyRate: number;
  availableBeds: number;
  byTier: {
    SINGLE_BED: RoomTierStats;
    DOUBLE_BED: RoomTierStats;
    TRIPLE_BED: RoomTierStats;
    QUAD_BED: RoomTierStats;
    SIX_BED: RoomTierStats;
  };
  monthlyTurnover: {
    admissions: number;
    discharges: number;
    temporaryLeaves: number;
  };
}

export interface ClinicalAnalytics {
  careLevelDistribution: {
    level1: { count: number; percentage: number };
    level2: { count: number; percentage: number };
    level3: { count: number; percentage: number };
  };
  vitalSignsOverview: {
    stableCount: number;
    warningCount: number;
    criticalCount: number;
  };
  emarCompliance: {
    totalDosesScheduled: number;
    givenOnTimeRate: number;
    heldRate: number;
    refusedRate: number;
  };
  rehabilitationProgress: {
    totalHoursThisMonth: number;
    adlImprovementRate: number;
    activeRehabResidents: number;
  };
}

export interface FinancialAnalytics {
  projectedRevenue: number;
  collectedRevenue: number;
  outstandingReceivable: number;
  collectionRate: number;
  revenueStreams: {
    carePackages: number;
    accommodation: number;
    nutrition: number;
    consumables: number;
  };
  rlaDeductionSummary: {
    totalDeductionVnd: number;
    totalEligibleDays: number;
    totalLeaveRequests: number;
  };
}

export interface WorkforceAnalytics {
  totalStaffCount: number;
  dayCaregiverRatio: string; // e.g. "1 : 3.2"
  nightCaregiverRatio: string; // e.g. "1 : 5.8"
  shiftAttendanceRate: number;
  totalCareLogsThisMonth: number;
  workDistributionByCareType: Record<string, number>;
}

export interface TrendDataPoint {
  periodKey: string;
  label: string;
  occupancyRate: number;
  occupiedBeds: number;
  capacityBeds: number;
  admissions: number;
  discharges: number;
  temporaryLeaves: number;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  projectedRevenueVnd: number;
  collectedRevenueVnd: number;
  rlaDeductionVnd: number;
}

export type GranularityType = 'MONTH' | 'QUARTER' | 'YEAR';

export interface ExecutiveDashboardData {
  periodKey: string;
  periodLabel: string;
  granularity: GranularityType;
  occupancy: OccupancyStats;
  clinical: ClinicalAnalytics;
  financial: FinancialAnalytics;
  workforce: WorkforceAnalytics;
  trendHistory: TrendDataPoint[];
}

/**
 * Calculates live room and bed occupancy breakdown from mockAccommodationItems
 */
function getLiveOccupancyBreakdown(): OccupancyStats {
  const items = mockAccommodationItems || [];
  const totalCapacity = items.length || 110;
  const occupiedBeds = items.filter(i => i.bedStatus === 'OCCUPIED' || Boolean(i.residentId)).length;
  const availableBeds = items.filter(i => i.bedStatus === 'AVAILABLE').length;
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 1000) / 10 : 85.5;

  const countTier = (type: string) => {
    const tierItems = items.filter(i => i.roomType === type);
    const totalBeds = tierItems.length;
    const occupied = tierItems.filter(i => i.bedStatus === 'OCCUPIED' || Boolean(i.residentId)).length;
    const rate = totalBeds > 0 ? Math.round((occupied / totalBeds) * 1000) / 10 : 0;
    return { totalBeds, occupied, rate };
  };

  const single = countTier('SINGLE');
  const double = countTier('DOUBLE');
  const triple = countTier('TRIPLE');
  const quad = countTier('QUAD');
  const six = countTier('SIX_BED');

  return {
    totalCapacity,
    totalOccupied: occupiedBeds,
    occupancyRate,
    availableBeds,
    byTier: {
      SINGLE_BED: {
        totalRooms: 6,
        totalBeds: single.totalBeds || 6,
        occupiedBeds: single.occupied || 5,
        occupancyRate: single.rate || 83.3,
        roomNumbers: '203, 207, 303, 305, 309, 403',
      },
      DOUBLE_BED: {
        totalRooms: 4,
        totalBeds: double.totalBeds || 8,
        occupiedBeds: double.occupied || 7,
        occupancyRate: double.rate || 87.5,
        roomNumbers: '101, 103, 201, 301',
      },
      TRIPLE_BED: {
        totalRooms: 4,
        totalBeds: triple.totalBeds || 12,
        occupiedBeds: triple.occupied || 10,
        occupancyRate: triple.rate || 83.3,
        roomNumbers: '205, 307, 401, 405',
      },
      QUAD_BED: {
        totalRooms: 3,
        totalBeds: quad.totalBeds || 12,
        occupiedBeds: quad.occupied || 10,
        occupancyRate: quad.rate || 83.3,
        roomNumbers: '206, 402, 406',
      },
      SIX_BED: {
        totalRooms: 12,
        totalBeds: six.totalBeds || 72,
        occupiedBeds: six.occupied || 62,
        occupancyRate: six.rate || 86.1,
        roomNumbers: '102, 104, 202, 204, 208, 209, 302, 304, 306, 308, 310, 404',
      },
    },
    monthlyTurnover: {
      admissions: 4,
      discharges: 1,
      temporaryLeaves: 3,
    },
  };
}

/**
 * Generates historical trend data based on selected granularity (Month, Quarter, Year)
 */
function generateTrendHistory(granularity: GranularityType, activePeriodKey: string): TrendDataPoint[] {
  if (granularity === 'MONTH') {
    const months = [
      { key: '2025-10', label: 'T10/25', baseOcc: 78.2, occBeds: 86, adm: 3, dis: 2, lve: 4, l1: 28, l2: 40, l3: 18, rev: 1720, col: 1310, rla: 19.5 },
      { key: '2025-11', label: 'T11/25', baseOcc: 80.0, occBeds: 88, adm: 4, dis: 1, lve: 3, l1: 29, l2: 41, l3: 18, rev: 1760, col: 1350, rla: 20.0 },
      { key: '2025-12', label: 'T12/25', baseOcc: 81.8, occBeds: 90, adm: 5, dis: 2, lve: 5, l1: 30, l2: 42, l3: 18, rev: 1800, col: 1390, rla: 22.0 },
      { key: '2026-01', label: 'T01/26', baseOcc: 82.7, occBeds: 91, adm: 3, dis: 1, lve: 6, l1: 30, l2: 43, l3: 18, rev: 1820, col: 1400, rla: 24.5 },
      { key: '2026-02', label: 'T02/26', baseOcc: 81.8, occBeds: 90, adm: 2, dis: 3, lve: 7, l1: 29, l2: 43, l3: 18, rev: 1800, col: 1380, rla: 26.0 },
      { key: '2026-03', label: 'T03/26', baseOcc: 83.6, occBeds: 92, adm: 4, dis: 1, lve: 4, l1: 31, l2: 43, l3: 18, rev: 1840, col: 1410, rla: 21.0 },
      { key: '2026-04', label: 'T04/26', baseOcc: 84.5, occBeds: 93, adm: 3, dis: 2, lve: 5, l1: 31, l2: 44, l3: 18, rev: 1850, col: 1415, rla: 23.0 },
      { key: '2026-05', label: 'T05/26', baseOcc: 83.6, occBeds: 92, adm: 2, dis: 1, lve: 4, l1: 30, l2: 44, l3: 18, rev: 1840, col: 1410, rla: 20.5 },
      { key: '2026-06', label: 'T06/26', baseOcc: 84.5, occBeds: 93, adm: 4, dis: 2, lve: 3, l1: 31, l2: 44, l3: 18, rev: 1850, col: 1420, rla: 21.5 },
      { key: '2026-07', label: 'T07/26', baseOcc: 85.5, occBeds: 94, adm: 3, dis: 1, lve: 4, l1: 32, l2: 44, l3: 18, rev: 1860, col: 1420, rla: 22.8 },
      { key: '2026-08', label: 'T08/26', baseOcc: 84.5, occBeds: 93, adm: 2, dis: 2, lve: 5, l1: 31, l2: 44, l3: 18, rev: 1850, col: 1410, rla: 23.5 },
      { key: '2026-09', label: 'T09/26', baseOcc: 85.5, occBeds: 94, adm: 4, dis: 1, lve: 3, l1: 32, l2: 44, l3: 18, rev: 1860, col: 1420, rla: 24.6 },
    ];
    return months.map(m => ({
      periodKey: m.key,
      label: m.label,
      occupancyRate: m.baseOcc,
      occupiedBeds: m.occBeds,
      capacityBeds: 110,
      admissions: m.adm,
      discharges: m.dis,
      temporaryLeaves: m.lve,
      level1Count: m.l1,
      level2Count: m.l2,
      level3Count: m.l3,
      projectedRevenueVnd: m.rev * 1000000,
      collectedRevenueVnd: m.col * 1000000,
      rlaDeductionVnd: m.rla * 1000000,
    }));
  }

  if (granularity === 'QUARTER') {
    const quarters = [
      { key: '2024-Q4', label: 'Q4/2024', baseOcc: 74.5, occBeds: 82, adm: 9, dis: 5, lve: 11, l1: 26, l2: 38, l3: 18, rev: 4950, col: 3750, rla: 52.0 },
      { key: '2025-Q1', label: 'Q1/2025', baseOcc: 76.4, occBeds: 84, adm: 10, dis: 4, lve: 14, l1: 27, l2: 39, l3: 18, rev: 5100, col: 3900, rla: 58.5 },
      { key: '2025-Q2', label: 'Q2/2025', baseOcc: 78.2, occBeds: 86, adm: 8, dis: 3, lve: 12, l1: 28, l2: 40, l3: 18, rev: 5200, col: 3980, rla: 55.0 },
      { key: '2025-Q3', label: 'Q3/2025', baseOcc: 79.1, occBeds: 87, adm: 9, dis: 4, lve: 10, l1: 28, l2: 41, l3: 18, rev: 5250, col: 4020, rla: 54.0 },
      { key: '2025-Q4', label: 'Q4/2025', baseOcc: 80.0, occBeds: 88, adm: 12, dis: 4, lve: 12, l1: 29, l2: 41, l3: 18, rev: 5280, col: 4050, rla: 61.5 },
      { key: '2026-Q1', label: 'Q1/2026', baseOcc: 82.7, occBeds: 91, adm: 9, dis: 5, lve: 17, l1: 30, l2: 43, l3: 18, rev: 5460, col: 4190, rla: 71.5 },
      { key: '2026-Q2', label: 'Q2/2026', baseOcc: 84.2, occBeds: 93, adm: 9, dis: 5, lve: 12, l1: 31, l2: 44, l3: 18, rev: 5540, col: 4245, rla: 65.0 },
      { key: '2026-Q3', label: 'Q3/2026', baseOcc: 85.5, occBeds: 94, adm: 9, dis: 4, lve: 12, l1: 32, l2: 44, l3: 18, rev: 5570, col: 4250, rla: 70.9 },
    ];
    return quarters.map(q => ({
      periodKey: q.key,
      label: q.label,
      occupancyRate: q.baseOcc,
      occupiedBeds: q.occBeds,
      capacityBeds: 110,
      admissions: q.adm,
      discharges: q.dis,
      temporaryLeaves: q.lve,
      level1Count: q.l1,
      level2Count: q.l2,
      level3Count: q.l3,
      projectedRevenueVnd: q.rev * 1000000,
      collectedRevenueVnd: q.col * 1000000,
      rlaDeductionVnd: q.rla * 1000000,
    }));
  }

  // Granularity YEAR
  const years = [
    { key: '2023', label: 'Năm 2023', baseOcc: 68.2, occBeds: 75, adm: 28, dis: 14, lve: 35, l1: 22, l2: 35, l3: 18, rev: 18200, col: 13800, rla: 180.0 },
    { key: '2024', label: 'Năm 2024', baseOcc: 73.6, occBeds: 81, adm: 34, dis: 16, lve: 42, l1: 25, l2: 38, l3: 18, rev: 19800, col: 15100, rla: 210.0 },
    { key: '2025', label: 'Năm 2025', baseOcc: 79.5, occBeds: 87, adm: 38, dis: 15, lve: 48, l1: 29, l2: 41, l3: 18, rev: 21000, col: 16100, rla: 235.0 },
    { key: '2026', label: 'Năm 2026 (Kế hoạch)', baseOcc: 85.5, occBeds: 94, adm: 42, dis: 12, lve: 52, l1: 32, l2: 44, l3: 18, rev: 22320, col: 17040, rla: 280.0 },
  ];

  return years.map(y => ({
    periodKey: y.key,
    label: y.label,
    occupancyRate: y.baseOcc,
    occupiedBeds: y.occBeds,
    capacityBeds: 110,
    admissions: y.adm,
    discharges: y.dis,
    temporaryLeaves: y.lve,
    level1Count: y.l1,
    level2Count: y.l2,
    level3Count: y.l3,
    projectedRevenueVnd: y.rev * 1000000,
    collectedRevenueVnd: y.col * 1000000,
    rlaDeductionVnd: y.rla * 1000000,
  }));
}

export async function fetchExecutiveAnalytics(
  periodKey: string = '2026-09',
  granularity: GranularityType = 'MONTH'
): Promise<ExecutiveDashboardData> {
  await new Promise((r) => setTimeout(r, 120));

  const liveOccupancy = getLiveOccupancyBreakdown();
  const trendHistory = generateTrendHistory(granularity, periodKey);

  // Period label formatting
  let periodLabel = `Tháng ${periodKey.replace('2026-', '')}/2026`;
  if (granularity === 'QUARTER') {
    periodLabel = `Quý ${periodKey.replace('2026-Q', '')}/2026`;
  } else if (granularity === 'YEAR') {
    periodLabel = `Năm ${periodKey}`;
  }

  // Adjust financial & turnover multipliers if Quarterly or Yearly view selected
  const mult = granularity === 'YEAR' ? 12 : granularity === 'QUARTER' ? 3 : 1;

  const projectedRevenue = 1860000000 * mult;
  const collectedRevenue = 1420000000 * mult;
  const outstandingReceivable = projectedRevenue - collectedRevenue;

  return {
    periodKey,
    periodLabel,
    granularity,
    occupancy: {
      ...liveOccupancy,
      monthlyTurnover: {
        admissions: 4 * mult,
        discharges: 1 * mult,
        temporaryLeaves: 3 * mult,
      },
    },
    clinical: {
      careLevelDistribution: {
        level1: { count: 32, percentage: 34.0 },
        level2: { count: 44, percentage: 46.8 },
        level3: { count: 18, percentage: 19.2 },
      },
      vitalSignsOverview: {
        stableCount: 82,
        warningCount: 10,
        criticalCount: 2,
      },
      emarCompliance: {
        totalDosesScheduled: 8460 * mult,
        givenOnTimeRate: 92.4,
        heldRate: 5.8,
        refusedRate: 1.8,
      },
      rehabilitationProgress: {
        totalHoursThisMonth: 284 * mult,
        adlImprovementRate: 74.5,
        activeRehabResidents: 48,
      },
    },
    financial: {
      projectedRevenue,
      collectedRevenue,
      outstandingReceivable,
      collectionRate: Math.round((collectedRevenue / projectedRevenue) * 1000) / 10,
      revenueStreams: {
        carePackages: Math.round(projectedRevenue * 0.6),
        accommodation: Math.round(projectedRevenue * 0.25),
        nutrition: Math.round(projectedRevenue * 0.1),
        consumables: Math.round(projectedRevenue * 0.05),
      },
      rlaDeductionSummary: {
        totalDeductionVnd: 24600000 * mult,
        totalEligibleDays: 205 * mult,
        totalLeaveRequests: 18 * mult,
      },
    },
    workforce: {
      totalStaffCount: 48,
      dayCaregiverRatio: '1 : 3.2',
      nightCaregiverRatio: '1 : 5.8',
      shiftAttendanceRate: 96.8,
      totalCareLogsThisMonth: 3420 * mult,
      workDistributionByCareType: {
        'Vệ sinh & Tắm gội cá nhân': 1140 * mult,
        'Theo dõi sinh hiệu & Uống thuốc': 920 * mult,
        'Hỗ trợ ăn uống & Dinh dưỡng': 680 * mult,
        'Vật lý trị liệu & Tập vận động': 380 * mult,
        'Sinh hoạt tinh thần & Trò chuyện': 300 * mult,
      },
    },
    trendHistory,
  };
}
