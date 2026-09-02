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

export interface ExecutiveDashboardData {
  period: string;
  occupancy: OccupancyStats;
  clinical: ClinicalAnalytics;
  financial: FinancialAnalytics;
  workforce: WorkforceAnalytics;
}

export const MOCK_EXECUTIVE_DATA: ExecutiveDashboardData = {
  period: 'Tháng 09/2026',
  occupancy: {
    totalCapacity: 110,
    totalOccupied: 94,
    occupancyRate: 85.5,
    availableBeds: 16,
    byTier: {
      SINGLE_BED: { totalRooms: 6, totalBeds: 6, occupiedBeds: 5, occupancyRate: 83.3, roomNumbers: '203, 207, 303, 305, 309, 403' },
      DOUBLE_BED: { totalRooms: 4, totalBeds: 8, occupiedBeds: 7, occupancyRate: 87.5, roomNumbers: '101, 103, 201, 301' },
      TRIPLE_BED: { totalRooms: 4, totalBeds: 12, occupiedBeds: 10, occupancyRate: 83.3, roomNumbers: '205, 307, 401, 405' },
      QUAD_BED: { totalRooms: 3, totalBeds: 12, occupiedBeds: 10, occupancyRate: 83.3, roomNumbers: '206, 402, 406' },
      SIX_BED: { totalRooms: 12, totalBeds: 72, occupiedBeds: 62, occupancyRate: 86.1, roomNumbers: '102, 104, 202, 204, 208, 209, 302, 304, 306, 308, 310, 404' },
    },
    monthlyTurnover: {
      admissions: 4,
      discharges: 1,
      temporaryLeaves: 3,
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
      totalDosesScheduled: 8460,
      givenOnTimeRate: 92.4,
      heldRate: 5.8,
      refusedRate: 1.8,
    },
    rehabilitationProgress: {
      totalHoursThisMonth: 284,
      adlImprovementRate: 74.5,
      activeRehabResidents: 48,
    },
  },
  financial: {
    projectedRevenue: 1860000000,
    collectedRevenue: 1420000000,
    outstandingReceivable: 440000000,
    collectionRate: 76.3,
    revenueStreams: {
      carePackages: 1116000000, // 60%
      accommodation: 465000000, // 25%
      nutrition: 186000000, // 10%
      consumables: 93000000, // 5%
    },
    rlaDeductionSummary: {
      totalDeductionVnd: 24600000,
      totalEligibleDays: 205,
      totalLeaveRequests: 18,
    },
  },
  workforce: {
    totalStaffCount: 48,
    dayCaregiverRatio: '1 : 3.2',
    nightCaregiverRatio: '1 : 5.8',
    shiftAttendanceRate: 96.8,
    totalCareLogsThisMonth: 3420,
    workDistributionByCareType: {
      'Vệ sinh & Tắm gội cá nhân': 1140,
      'Theo dõi sinh hiệu & Uống thuốc': 920,
      'Hỗ trợ ăn uống & Dinh dưỡng': 680,
      'Vật lý trị liệu & Tập vận động': 380,
      'Sinh hoạt tinh thần & Trò chuyện': 300,
    },
  },
};

export async function fetchExecutiveAnalytics(period: string = '2026-09'): Promise<ExecutiveDashboardData> {
  await new Promise((r) => setTimeout(r, 150));
  return {
    ...MOCK_EXECUTIVE_DATA,
    period: period === '2026-09' ? 'Tháng 09/2026' : `Kỳ ${period}`,
  };
}
