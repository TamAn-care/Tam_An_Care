export interface VitalRecord {
  id: string;
  residentId: string;
  sysBP?: number;
  diaBP?: number;
  heartRate?: number;
  temp?: number;
  spo2?: number;
  respRate?: number;
  weight?: number;
  bloodGlucose?: number;
  measuredAt: string;
  recordedBy: string;
  recordedByRole: string;
  note?: string;
}

export interface VitalMinMaxSummary {
  pulseMinMax: string;
  pulseEval: 'NORMAL' | 'SLOW' | 'FAST';
  bpMinMax: string;
  bpEval: 'NORMAL' | 'HIGH' | 'LOW';
  tempMinMax: string;
  tempEval: 'NORMAL' | 'FEVER' | 'HYPOTHERMIA';
  spo2MinMax: string;
  spo2Eval: 'NORMAL' | 'DYSPNEA';
  weightMinMax: string;
  weightRecords: { id: string; date: string; value: string }[];
  glucoseMinMax: string;
  glucoseRecords: { id: string; date: string; value: string }[];
  totalMeasurementsCount: number;
}

export interface ADLEvaluation {
  eating: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
  bathing: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
  dressing: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
  toileting: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
  mobility: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
  excretion?: 'AUTONOMOUS' | 'INCONTINENT' | 'CATHETER_DIAPER';
  mobilitySupport?: 'NONE' | 'CANE_WALKER' | 'WHEELCHAIR';
  assessedBy?: string;
  assessedByRole?: string;
  updatedAt?: string;
}

const STORAGE_KEY_PREFIX = 'taman_care_mock_vitals_history_';
const ADL_STORAGE_PREFIX = 'taman_care_mock_adl_';

export function getResidentADL(residentId: string): ADLEvaluation {
  if (!residentId) {
    return {
      eating: 'INDEPENDENT',
      bathing: 'FULL_DEPEND',
      dressing: 'INDEPENDENT',
      toileting: 'PARTIAL_ASSIST',
      mobility: 'INDEPENDENT',
      excretion: 'AUTONOMOUS',
      mobilitySupport: 'NONE',
    };
  }
  try {
    const raw = localStorage.getItem(`${ADL_STORAGE_PREFIX}${residentId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    eating: 'INDEPENDENT',
    bathing: 'FULL_DEPEND',
    dressing: 'INDEPENDENT',
    toileting: 'PARTIAL_ASSIST',
    mobility: 'INDEPENDENT',
    excretion: 'AUTONOMOUS',
    mobilitySupport: 'NONE',
  };
}

export function saveResidentADL(
  residentId: string,
  adl: Partial<ADLEvaluation>,
  actorName?: string,
  actorRole?: string,
): ADLEvaluation {
  const current = getResidentADL(residentId);
  const updated: ADLEvaluation = {
    ...current,
    ...adl,
    assessedBy: actorName || current.assessedBy || 'Nhân viên chăm sóc',
    assessedByRole: actorRole || current.assessedByRole || 'CAREGIVER',
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(`${ADL_STORAGE_PREFIX}${residentId}`, JSON.stringify(updated));
  } catch {}
  return updated;
}

/**
 * Fallback mock records when a resident has no saved history yet
 */
function getMockInitialHistory(residentId: string): VitalRecord[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return [
    {
      id: `vrec-${residentId}-1`,
      residentId,
      sysBP: 118,
      diaBP: 75,
      heartRate: 72,
      temp: 36.2,
      spo2: 98,
      respRate: 17,
      weight: 47.0,
      bloodGlucose: 6.2,
      measuredAt: `${year}-${month}-05T07:30:00Z`,
      recordedBy: 'ĐD. Lê Thị Mai',
      recordedByRole: 'NURSE',
      note: 'Sinh hiệu đầu tháng ổn định, tâm trạng vui vẻ.',
    },
    {
      id: `vrec-${residentId}-2`,
      residentId,
      sysBP: 126,
      diaBP: 80,
      heartRate: 78,
      temp: 36.5,
      spo2: 97,
      respRate: 18,
      weight: 48.3,
      bloodGlucose: 7.2,
      measuredAt: `${year}-${month}-15T08:00:00Z`,
      recordedBy: 'NVCS. Nguyễn Văn Hùng',
      recordedByRole: 'CAREGIVER',
      note: 'Huyết áp tăng nhẹ sau tập thể dục nhẹ ca sáng.',
    },
    {
      id: `vrec-${residentId}-3`,
      residentId,
      sysBP: 134,
      diaBP: 88,
      heartRate: 85,
      temp: 36.8,
      spo2: 95,
      respRate: 19,
      weight: 49.5,
      bloodGlucose: 8.5,
      measuredAt: `${year}-${month}-25T07:45:00Z`,
      recordedBy: 'ĐD. Phạm Thu Hà',
      recordedByRole: 'NURSE',
      note: 'Đã uống thuốc theo đơn bác sĩ, kiểm tra lại sau 2h.',
    },
  ];
}

export function getResidentVitalHistory(residentId: string): VitalRecord[] {
  if (!residentId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${residentId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[VitalsCalculator] Failed to read vital history from localStorage:', err);
  }

  // Fallback to initial mock set if empty
  const initial = getMockInitialHistory(residentId);
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${residentId}`, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function saveVitalRecord(residentId: string, record: Partial<VitalRecord>): VitalRecord {
  const history = getResidentVitalHistory(residentId);

  const newRecord: VitalRecord = {
    id: record.id || `vrec-${residentId}-${Date.now()}`,
    residentId,
    sysBP: record.sysBP !== undefined && record.sysBP !== null && !isNaN(Number(record.sysBP)) ? Number(record.sysBP) : undefined,
    diaBP: record.diaBP !== undefined && record.diaBP !== null && !isNaN(Number(record.diaBP)) ? Number(record.diaBP) : undefined,
    heartRate: record.heartRate !== undefined && record.heartRate !== null && !isNaN(Number(record.heartRate)) ? Number(record.heartRate) : undefined,
    temp: record.temp !== undefined && record.temp !== null && !isNaN(Number(record.temp)) ? Number(record.temp) : undefined,
    spo2: record.spo2 !== undefined && record.spo2 !== null && !isNaN(Number(record.spo2)) ? Number(record.spo2) : undefined,
    respRate: record.respRate !== undefined && record.respRate !== null && !isNaN(Number(record.respRate)) ? Number(record.respRate) : undefined,
    weight: record.weight !== undefined && record.weight !== null && !isNaN(Number(record.weight)) ? Number(record.weight) : undefined,
    bloodGlucose: record.bloodGlucose !== undefined && record.bloodGlucose !== null && !isNaN(Number(record.bloodGlucose)) ? Number(record.bloodGlucose) : undefined,
    measuredAt: record.measuredAt || new Date().toISOString(),
    recordedBy: record.recordedBy || 'Nhân viên chăm sóc',
    recordedByRole: record.recordedByRole || 'CAREGIVER',
    note: record.note || '',
  };

  const updatedHistory = [newRecord, ...history];
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${residentId}`, JSON.stringify(updatedHistory));
    // Also update single latest item key for legacy compatibility
    localStorage.setItem(
      `taman_care_mock_vitals_${residentId}`,
      JSON.stringify({
        sysBP: newRecord.sysBP,
        diaBP: newRecord.diaBP,
        heartRate: newRecord.heartRate,
        temp: newRecord.temp,
        spo2: newRecord.spo2,
        respRate: newRecord.respRate,
        weight: newRecord.weight,
        bloodGlucose: newRecord.bloodGlucose,
        updatedAt: newRecord.measuredAt,
      }),
    );
  } catch (err) {
    console.warn('[VitalsCalculator] Failed to write vital history to localStorage:', err);
  }

  return newRecord;
}

export function calculateMonthlyVitalMinMax(
  residentId: string,
  targetMonthStr?: string, // Format YYYY-MM or undefined for current month
): VitalMinMaxSummary {
  const history = getResidentVitalHistory(residentId);

  // Filter records by month if provided, else use all available records
  let filtered = history;
  if (targetMonthStr) {
    filtered = history.filter((r) => r.measuredAt && r.measuredAt.startsWith(targetMonthStr));
  }
  if (filtered.length === 0 && history.length > 0) {
    filtered = history;
  }

  if (filtered.length === 0) {
    return {
      pulseMinMax: '70 – 85',
      pulseEval: 'NORMAL',
      bpMinMax: '118/75 – 134/88',
      bpEval: 'HIGH',
      tempMinMax: '36.2 – 36.8',
      tempEval: 'NORMAL',
      spo2MinMax: '95 – 99',
      spo2Eval: 'NORMAL',
      weightMinMax: '47.0 – 49.5',
      weightRecords: [
        { id: '1', date: '07/07/2026', value: '47 kg' },
        { id: '2', date: '16/07/2026', value: '48.3 kg' },
        { id: '3', date: '12/08/2026', value: '49.5 kg' },
      ],
      glucoseMinMax: '6.2 – 8.5',
      glucoseRecords: [
        { id: '1', date: '07/07/2026', value: '6.2 mmol/L' },
        { id: '2', date: '16/07/2026', value: '7.2 mmol/L' },
        { id: '3', date: '12/08/2026', value: '8.5 mmol/L' },
      ],
      totalMeasurementsCount: 0,
    };
  }

  // Calculate Heart Rate (Pulse)
  const pulses = filtered.map((r) => r.heartRate).filter((v): v is number => typeof v === 'number' && !isNaN(v));
  let pulseMinMax = '72 – 82';
  let pulseEval: 'NORMAL' | 'SLOW' | 'FAST' = 'NORMAL';
  if (pulses.length > 0) {
    const minP = Math.min(...pulses);
    const maxP = Math.max(...pulses);
    pulseMinMax = minP === maxP ? `${minP}` : `${minP} – ${maxP}`;
    pulseEval = maxP > 90 ? 'FAST' : minP < 60 ? 'SLOW' : 'NORMAL';
  }

  // Calculate Blood Pressure (Sys / Dia)
  const sysList = filtered.map((r) => r.sysBP).filter((v): v is number => typeof v === 'number' && !isNaN(v));
  const diaList = filtered.map((r) => r.diaBP).filter((v): v is number => typeof v === 'number' && !isNaN(v));
  let bpMinMax = '118/75 – 134/88';
  let bpEval: 'NORMAL' | 'HIGH' | 'LOW' = 'NORMAL';
  if (sysList.length > 0 && diaList.length > 0) {
    const minSys = Math.min(...sysList);
    const maxSys = Math.max(...sysList);
    const minDia = Math.min(...diaList);
    const maxDia = Math.max(...diaList);
    bpMinMax =
      minSys === maxSys && minDia === maxDia
        ? `${minSys}/${minDia}`
        : `${minSys}/${minDia} – ${maxSys}/${maxDia}`;
    bpEval = maxSys > 120 || maxDia > 80 ? 'HIGH' : minSys < 90 || minDia < 60 ? 'LOW' : 'NORMAL';
  }

  // Calculate Temperature
  const temps = filtered.map((r) => r.temp).filter((v): v is number => typeof v === 'number' && !isNaN(v));
  let tempMinMax = '36.2 – 36.8';
  let tempEval: 'NORMAL' | 'FEVER' | 'HYPOTHERMIA' = 'NORMAL';
  if (temps.length > 0) {
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    tempMinMax = minT === maxT ? `${minT}` : `${minT.toFixed(1)} – ${maxT.toFixed(1)}`;
    tempEval = maxT > 37.5 ? 'FEVER' : minT < 36.0 ? 'HYPOTHERMIA' : 'NORMAL';
  }

  // Calculate SpO2
  const spo2s = filtered.map((r) => r.spo2).filter((v): v is number => typeof v === 'number' && !isNaN(v));
  let spo2MinMax = '95 – 99';
  let spo2Eval: 'NORMAL' | 'DYSPNEA' = 'NORMAL';
  if (spo2s.length > 0) {
    const minS = Math.min(...spo2s);
    const maxS = Math.max(...spo2s);
    spo2MinMax = minS === maxS ? `${minS}` : `${minS} – ${maxS}`;
    spo2Eval = minS < 95 ? 'DYSPNEA' : 'NORMAL';
  }

  // Calculate Weight
  const weights = filtered.filter((r) => typeof r.weight === 'number' && !isNaN(r.weight as number));
  let weightMinMax = '47.0 – 49.5';
  const weightRecords: { id: string; date: string; value: string }[] = [];
  if (weights.length > 0) {
    const wVals = weights.map((r) => r.weight as number);
    const minW = Math.min(...wVals);
    const maxW = Math.max(...wVals);
    weightMinMax = minW === maxW ? `${minW.toFixed(1)}` : `${minW.toFixed(1)} – ${maxW.toFixed(1)}`;
    weights.slice(0, 5).forEach((r, idx) => {
      const dateStr = new Date(r.measuredAt).toLocaleDateString('vi-VN');
      weightRecords.push({
        id: String(idx + 1),
        date: dateStr,
        value: `${r.weight} kg`,
      });
    });
  }

  // Calculate Glucose
  const glucoses = filtered.filter((r) => typeof r.bloodGlucose === 'number' && !isNaN(r.bloodGlucose as number));
  let glucoseMinMax = '6.2 – 8.5';
  const glucoseRecords: { id: string; date: string; value: string }[] = [];
  if (glucoses.length > 0) {
    const gVals = glucoses.map((r) => r.bloodGlucose as number);
    const minG = Math.min(...gVals);
    const maxG = Math.max(...gVals);
    glucoseMinMax = minG === maxG ? `${minG.toFixed(1)}` : `${minG.toFixed(1)} – ${maxG.toFixed(1)}`;
    glucoses.slice(0, 5).forEach((r, idx) => {
      const dateStr = new Date(r.measuredAt).toLocaleDateString('vi-VN');
      glucoseRecords.push({
        id: String(idx + 1),
        date: dateStr,
        value: `${r.bloodGlucose} mmol/L`,
      });
    });
  }

  return {
    pulseMinMax,
    pulseEval,
    bpMinMax,
    bpEval,
    tempMinMax,
    tempEval,
    spo2MinMax,
    spo2Eval,
    weightMinMax,
    weightRecords: weightRecords.length > 0 ? weightRecords : [
      { id: '1', date: '07/07/2026', value: '47 kg' },
      { id: '2', date: '16/07/2026', value: '48.3 kg' },
      { id: '3', date: '12/08/2026', value: '49.5 kg' },
    ],
    glucoseMinMax,
    glucoseRecords: glucoseRecords.length > 0 ? glucoseRecords : [
      { id: '1', date: '07/07/2026', value: '6.2 mmol/L' },
      { id: '2', date: '16/07/2026', value: '7.2 mmol/L' },
      { id: '3', date: '12/08/2026', value: '8.5 mmol/L' },
    ],
    totalMeasurementsCount: filtered.length,
  };
}
