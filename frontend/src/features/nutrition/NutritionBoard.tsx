import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { listResidents } from '../../api/residents';
import { fetchLeaveRequests } from '../../api/resident-leave';
import { listResidentAccessAssignments } from '../../api/resident-access-administration';
import { listStaffActors } from '../../api/staff-actors';
import { getAssignedResidentIdsForActor } from '../../auth/role-policy';

export interface ExtraMeal {
  id: string;
  mealTime: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  guestType: 'FAMILY_GUEST' | 'STAFF_DUTY' | 'OTHER';
  guestName: string;
  residentRelation?: string;
  quantity: number;
  dietType: string;
  note?: string;
}

export interface ResidentDietProfile {
  residentId: string;
  prepType: 'REGULAR_SOFT' | 'MASHED_SOFT' | 'PUREED_SOUP' | 'TUBE_FEEDING';
  medicalDiets: string[];
  allergies: string[];
  caregiverNotes: string;
  mealsPerDay: number;
  reportedByCaregiver?: string;
  updatedAt?: string;
}

const STORAGE_KEY_DIET = 'taman_nutrition_diet_profiles';
const STORAGE_KEY_EXTRA = 'taman_nutrition_extra_meals';

const INITIAL_DIET_PROFILES: Record<string, ResidentDietProfile> = {
  'res-demo-008': {
    residentId: 'res-demo-008',
    prepType: 'TUBE_FEEDING',
    medicalDiets: ['Tiểu đường', 'Suy thận nhẹ (Giảm đạm)'],
    allergies: ['Không dung nạp lactose'],
    caregiverNotes: 'Ăn qua ống Sonde 5 cữ/ngày (mỗi cữ 250ml súp chuyên biệt). Bơm chậm, kiểm tra vị trí ống trước ăn.',
    mealsPerDay: 5,
    reportedByCaregiver: 'Đặng Thị Hoa',
    updatedAt: '06:15 - 02/09/2026',
  },
  'res-demo-001': {
    residentId: 'res-demo-001',
    prepType: 'PUREED_SOUP',
    medicalDiets: ['Tăng huyết áp (Ăn nhạt)', 'Tiểu đường type 2'],
    allergies: [],
    caregiverNotes: 'Cụ khó nuốt, cần cháo xay nhuyễn mịn kèm thịt nạc/cá băm nhỏ. Bổ sung 1 ly sữa dinh dưỡng lúc 15:00.',
    mealsPerDay: 4,
    reportedByCaregiver: 'Trần Thị Mai',
    updatedAt: '06:30 - 02/09/2026',
  },
  'res-demo-002': {
    residentId: 'res-demo-002',
    prepType: 'MASHED_SOFT',
    medicalDiets: ['Bệnh tim mạch (Hạn chế mỡ động vật)'],
    allergies: ['Dị ứng hải sản (tôm, cua)'],
    caregiverNotes: 'Đang tạm vắng điều trị tim mạch tại BV 108. Gia đình báo dự kiến về ngày 3/9.',
    mealsPerDay: 3,
    reportedByCaregiver: 'Trần Thị Mai',
    updatedAt: '07:00 - 02/09/2026',
  },
  'res-demo-003': {
    residentId: 'res-demo-003',
    prepType: 'PUREED_SOUP',
    medicalDiets: ['Đái tháo đường', 'Tiêu hóa kém'],
    allergies: [],
    caregiverNotes: 'Cụ yếu liệt nửa người, ăn chậm, cần đút từng thìa nhỏ. Uống đủ 1.5L nước ấm/ngày.',
    mealsPerDay: 4,
    reportedByCaregiver: 'Trần Thị Mai',
    updatedAt: '06:45 - 02/09/2026',
  },
  'res-demo-004': {
    residentId: 'res-demo-004',
    prepType: 'REGULAR_SOFT',
    medicalDiets: ['Tăng huyết áp (Ăn nhạt < 3g muối/ngày)'],
    allergies: [],
    caregiverNotes: 'Cụ tự xúc cơm tốt, thích rau củ luộc mềm, tráng miệng hoa quả ngọt nhẹ.',
    mealsPerDay: 3,
    reportedByCaregiver: 'Hoàng Văn Tuấn',
    updatedAt: '07:10 - 02/09/2026',
  },
  'res-demo-005': {
    residentId: 'res-demo-005',
    prepType: 'REGULAR_SOFT',
    medicalDiets: ['Tiểu đường (Dùng gạo lứt/yến mạch)'],
    allergies: ['Kiêng đậu phộng'],
    caregiverNotes: 'Khẩu vị tốt, NV Chăm sóc đã nhắc uống thuốc hạ đường huyết trước bữa ăn 30 phút.',
    mealsPerDay: 3,
    reportedByCaregiver: 'Hoàng Văn Tuấn',
    updatedAt: '07:15 - 02/09/2026',
  },
  'res-demo-006': {
    residentId: 'res-demo-006',
    prepType: 'MASHED_SOFT',
    medicalDiets: ['Tăng huyết áp', 'Răng yếu (Khó nhai)'],
    allergies: [],
    caregiverNotes: 'Cơm nấu thật nát hoặc cháo sườn băm nhỏ, thịt kho mềm nhừ, canh nấu kỹ.',
    mealsPerDay: 4,
    reportedByCaregiver: 'Đặng Thị Hoa',
    updatedAt: '06:20 - 02/09/2026',
  },
  'res-demo-007': {
    residentId: 'res-demo-007',
    prepType: 'REGULAR_SOFT',
    medicalDiets: [],
    allergies: [],
    caregiverNotes: 'Sức khỏe ổn định, ăn uống bình thường theo thực đơn chung của Tâm An.',
    mealsPerDay: 3,
    reportedByCaregiver: 'Hoàng Văn Tuấn',
    updatedAt: '07:20 - 02/09/2026',
  },
  'resident-vw9ec-20260828-153826': {
    residentId: 'resident-vw9ec-20260828-153826',
    prepType: 'MASHED_SOFT',
    medicalDiets: ['Tăng huyết áp (Ăn nhạt)'],
    allergies: [],
    caregiverNotes: 'Cụ thích ăn cháo cá hồi hạt sen vào buổi sáng, bữa trưa cơm mềm chan canh bí.',
    mealsPerDay: 3,
    reportedByCaregiver: 'Đặng Thị Hoa',
    updatedAt: '06:40 - 02/09/2026',
  },
};

const PREP_LABELS: Record<string, { label: string; badge: string; icon: string }> = {
  REGULAR_SOFT: { label: 'Cơm mềm / Cơm thường', badge: 'badge badge-success', icon: '🍚' },
  MASHED_SOFT: { label: 'Nấu nhừ / Băm nhỏ / Cháo', badge: 'badge badge-info', icon: '🥣' },
  PUREED_SOUP: { label: 'Xay nhuyễn / Súp loãng', badge: 'badge badge-purple', icon: '🍲' },
  TUBE_FEEDING: { label: 'Ăn qua ống Sonde', badge: 'badge badge-danger', icon: '🧪' },
};

const INITIAL_EXTRA_MEALS: ExtraMeal[] = [
  {
    id: 'extra-001',
    mealTime: 'LUNCH',
    guestType: 'FAMILY_GUEST',
    guestName: 'Nguyễn Văn Tuấn (Con trai Cụ Tuyết)',
    residentRelation: 'Cụ Phạm Thị Tuyết - P201',
    quantity: 1,
    dietType: 'Cơm thường theo tiêu chuẩn',
    note: 'Đến thăm cụ và đăng ký dùng cơm trưa cùng mẹ (Quản lý duyệt)',
  },
  {
    id: 'extra-002',
    mealTime: 'LUNCH',
    guestType: 'STAFF_DUTY',
    guestName: 'Nhân viên trực ca trưa (Lê Thị Lan, Trần Thị Mai)',
    quantity: 2,
    dietType: 'Suất ăn ca nhân viên y tế/chăm sóc',
    note: 'Suất ăn theo ca trực (Quản lý phân bổ)',
  },
];

export function NutritionBoard() {
  const { actor } = useActor();
  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';
  const actorName = actor?.displayName || 'Nhân viên';

  // Role permissions
  const isCaregiver = actorRole === 'CAREGIVER';
  const isManager = actorRole === 'CARE_MANAGER' || actorRole === 'SUPERVISOR';
  const isNutritionist = actorRole === 'NUTRITIONIST';
  const isNurse = actorRole === 'NURSE';
  const canAccessNutrition = isManager || isCaregiver || isNurse || isNutritionist;

  // State with localStorage persistence
  const [dietProfiles, setDietProfiles] = useState<Record<string, ResidentDietProfile>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DIET);
      return saved ? JSON.parse(saved) : INITIAL_DIET_PROFILES;
    } catch {
      return INITIAL_DIET_PROFILES;
    }
  });

  const [extraMeals, setExtraMeals] = useState<ExtraMeal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXTRA);
      return saved ? JSON.parse(saved) : INITIAL_EXTRA_MEALS;
    } catch {
      return INITIAL_EXTRA_MEALS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DIET, JSON.stringify(dietProfiles));
  }, [dietProfiles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXTRA, JSON.stringify(extraMeals));
  }, [extraMeals]);

  const [selectedFilterPrep, setSelectedFilterPrep] = useState<string>('ALL');
  const [selectedFilterCaregiver, setSelectedFilterCaregiver] = useState<string>('ALL');
  
  // Modals
  const [showAddExtraModal, setShowAddExtraModal] = useState<boolean>(false);
  const [showCaregiverReportModal, setShowCaregiverReportModal] = useState<boolean>(false);
  const [editingResidentId, setEditingResidentId] = useState<string>('');

  // Form State for Caregiver Report
  const [formResidentId, setFormResidentId] = useState<string>('');
  const [formPrepType, setFormPrepType] = useState<'REGULAR_SOFT' | 'MASHED_SOFT' | 'PUREED_SOUP' | 'TUBE_FEEDING'>('REGULAR_SOFT');
  const [formDiets, setFormDiets] = useState<string[]>([]);
  const [formAllergies, setFormAllergies] = useState<string[]>([]);
  const [formCaregiverNotes, setFormCaregiverNotes] = useState<string>('');
  const [formMealsPerDay, setFormMealsPerDay] = useState<number>(3);

  // Form State for Extra Meal (Manager)
  const [newMealTime, setNewMealTime] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER'>('LUNCH');
  const [newGuestType, setNewGuestType] = useState<'FAMILY_GUEST' | 'STAFF_DUTY' | 'OTHER'>('FAMILY_GUEST');
  const [newGuestName, setNewGuestName] = useState<string>('');
  const [newResidentRelation, setNewResidentRelation] = useState<string>('');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newDietType, setNewDietType] = useState<string>('Cơm thường theo tiêu chuẩn');
  const [newNote, setNewNote] = useState<string>('');

  // Queries
  const { data: residents } = useQuery({
    queryKey: ['nutrition-residents', actorId],
    queryFn: () => listResidents(actor),
    enabled: Boolean(actor),
  });

  const { data: leaveRequests } = useQuery({
    queryKey: ['nutrition-leave-requests', actorId],
    queryFn: () => fetchLeaveRequests(actorId, actorRole, { limit: 100 }),
    enabled: Boolean(actorId),
  });

  const { data: assignments } = useQuery({
    queryKey: ['nutrition-assignments', actorId],
    queryFn: () => listResidentAccessAssignments(actor!),
    enabled: Boolean(actor),
  });

  const { data: staffList } = useQuery({
    queryKey: ['nutrition-staff-list', actorId],
    queryFn: () => listStaffActors(actor!),
    enabled: Boolean(actor),
  });

  // Calculate active leaves set
  const activeLeaveResidentIds = useMemo(() => {
    const set = new Set<string>();
    leaveRequests?.items?.forEach(x => {
      if (x.status === 'ACTIVE_LEAVE') {
        set.add(x.residentId);
      }
    });
    return set;
  }, [leaveRequests]);

  // Caregiver mapping: residentId -> Caregiver Name & Code
  const caregiverMap = useMemo(() => {
    const map = new Map<string, { staffName: string; staffCode: string; actorId: string }>();
    if (assignments && staffList) {
      assignments.forEach(a => {
        if (a.status === 'ACTIVE' && a.actorRole === 'CAREGIVER') {
          const staff = staffList.find(s => s.actorId === a.actorId);
          if (staff) {
            map.set(a.residentId, { staffName: staff.displayName, staffCode: staff.staffCode, actorId: a.actorId });
          }
        }
      });
    }
    return map;
  }, [assignments, staffList]);

  // Unified resident rows
  const residentRows = useMemo(() => {
    if (!residents) return [];
    return residents.map(item => {
      const res = item.resident;
      const isAbsent = activeLeaveResidentIds.has(res.residentId);
      const diet = dietProfiles[res.residentId] || {
        residentId: res.residentId,
        prepType: 'REGULAR_SOFT',
        medicalDiets: [],
        allergies: [],
        caregiverNotes: 'Chưa có ghi chú đặc biệt.',
        mealsPerDay: 3,
        reportedByCaregiver: 'Nhân viên chăm sóc',
        updatedAt: 'Mới cập nhật',
      };
      const defaultCgMap: Record<string, { staffName: string; staffCode: string; actorId: string }> = {
        'res-demo-004': { staffName: 'Hoàng Văn Tuấn', staffCode: 'STAFF-CG-002', actorId: 'cg-tuan-002' },
        'res-demo-005': { staffName: 'Hoàng Văn Tuấn', staffCode: 'STAFF-CG-002', actorId: 'cg-tuan-002' },
        'res-demo-007': { staffName: 'Hoàng Văn Tuấn', staffCode: 'STAFF-CG-002', actorId: 'cg-tuan-002' },
        'res-demo-001': { staffName: 'Trần Thị Mai', staffCode: 'STAFF-CG-001', actorId: 'cg-mai-001' },
        'res-demo-002': { staffName: 'Trần Thị Mai', staffCode: 'STAFF-CG-001', actorId: 'cg-mai-001' },
        'res-demo-003': { staffName: 'Trần Thị Mai', staffCode: 'STAFF-CG-001', actorId: 'cg-mai-001' },
        'res-demo-008': { staffName: 'Đặng Thị Hoa', staffCode: 'STAFF-CG-003', actorId: 'cg-hoa-003' },
        'res-demo-006': { staffName: 'Đặng Thị Hoa', staffCode: 'STAFF-CG-003', actorId: 'cg-hoa-003' },
        'resident-vw9ec-20260828-153826': { staffName: 'Đặng Thị Hoa', staffCode: 'STAFF-CG-003', actorId: 'cg-hoa-003' },
      };

      const cg = caregiverMap.get(res.residentId) || defaultCgMap[res.residentId] || { staffName: 'Chưa phân công', staffCode: '—', actorId: '' };
      const myAssignedIds = new Set(getAssignedResidentIdsForActor(actorId, actorName));
      const isMyResident = myAssignedIds.has(res.residentId) || cg.actorId === actorId || cg.staffName === actorName;

      return {
        ...res,
        isAbsent,
        diet,
        caregiver: cg,
        isMyResident,
      };
    });
  }, [residents, activeLeaveResidentIds, dietProfiles, caregiverMap, actorId, actorName]);

  // My assigned residents if caregiver
  const myAssignedResidents = useMemo(() => {
    return residentRows.filter(r => r.isMyResident);
  }, [residentRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return residentRows.filter(row => {
      if (selectedFilterPrep !== 'ALL' && row.diet.prepType !== selectedFilterPrep) return false;
      if (selectedFilterCaregiver !== 'ALL' && row.caregiver.staffName !== selectedFilterCaregiver) return false;
      return true;
    });
  }, [residentRows, selectedFilterPrep, selectedFilterCaregiver]);

  // Aggregated KPIs
  const kpis = useMemo(() => {
    const totalResidentCount = residentRows.length;
    const absentCount = residentRows.filter(r => r.isAbsent).length;
    const activeEaters = totalResidentCount - absentCount;

    let regularSoftCount = 0;
    let mashedSoftCount = 0;
    let pureedSoupCount = 0;
    let tubeFeedingCount = 0;

    let diabetesCount = 0;
    let hypertensionCount = 0;
    let renalCount = 0;
    let allergyCount = 0;

    residentRows.forEach(r => {
      if (!r.isAbsent) {
        if (r.diet.prepType === 'REGULAR_SOFT') regularSoftCount++;
        else if (r.diet.prepType === 'MASHED_SOFT') mashedSoftCount++;
        else if (r.diet.prepType === 'PUREED_SOUP') pureedSoupCount++;
        else if (r.diet.prepType === 'TUBE_FEEDING') tubeFeedingCount++;
      }

      if (r.diet.medicalDiets.some(d => d.toLowerCase().includes('tiểu đường') || d.toLowerCase().includes('đái tháo đường'))) {
        diabetesCount++;
      }
      if (r.diet.medicalDiets.some(d => d.toLowerCase().includes('huyết áp') || d.toLowerCase().includes('ăn nhạt'))) {
        hypertensionCount++;
      }
      if (r.diet.medicalDiets.some(d => d.toLowerCase().includes('thận') || d.toLowerCase().includes('tiêu hóa'))) {
        renalCount++;
      }
      if (r.diet.allergies.length > 0) {
        allergyCount++;
      }
    });

    const totalExtraMeals = extraMeals.reduce((sum, m) => sum + m.quantity, 0);
    const totalKitchenPrep = activeEaters + totalExtraMeals;

    return {
      totalResidentCount,
      absentCount,
      activeEaters,
      totalExtraMeals,
      totalKitchenPrep,
      regularSoftCount,
      mashedSoftCount,
      pureedSoupCount,
      tubeFeedingCount,
      diabetesCount,
      hypertensionCount,
      renalCount,
      allergyCount,
    };
  }, [residentRows, extraMeals]);
  // Caregivers list for filter
  const uniqueCaregivers = useMemo(() => {
    const names = new Set<string>();
    residentRows.forEach(r => {
      if (r.caregiver.staffName && r.caregiver.staffName !== 'Chưa phân công') {
        names.add(r.caregiver.staffName);
      }
    });
    return Array.from(names);
  }, [residentRows]);

  // Open Edit Modal for a resident
  const handleOpenEditDiet = (residentId: string) => {
    const target = residentRows.find(r => r.residentId === residentId);
    if (!target) return;

    // Strict Scope: Caregivers can only edit their assigned residents
    if (isCaregiver && !target.isMyResident) {
      alert('Bạn chỉ có quyền cập nhật suất ăn đối với người cao tuổi do mình phụ trách.');
      return;
    }

    setFormResidentId(target.residentId);
    setFormPrepType(target.diet.prepType);
    setFormDiets([...target.diet.medicalDiets]);
    setFormAllergies([...target.diet.allergies]);
    setFormCaregiverNotes(target.diet.caregiverNotes);
    setFormMealsPerDay(target.diet.mealsPerDay || 3);
    setShowCaregiverReportModal(true);
  };

  // Submit Caregiver Dietary Update
  const handleSaveCaregiverDiet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formResidentId) return;

    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTimestamp = `${timeStr} - ${dateStr}`;

    setDietProfiles(prev => ({
      ...prev,
      [formResidentId]: {
        residentId: formResidentId,
        prepType: formPrepType,
        medicalDiets: formDiets,
        allergies: formAllergies,
        caregiverNotes: formCaregiverNotes.trim() || 'Sức khỏe ổn định, ăn uống theo chỉ định.',
        mealsPerDay: formMealsPerDay,
        reportedByCaregiver: actorName,
        updatedAt: formattedTimestamp,
      },
    }));

    setShowCaregiverReportModal(false);
  };

  // Submit Extra Meal (Manager)
  const handleAddExtraMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) return;

    const newEntry: ExtraMeal = {
      id: `extra-${Date.now()}`,
      mealTime: newMealTime,
      guestType: newGuestType,
      guestName: newGuestName.trim(),
      residentRelation: newResidentRelation.trim() || undefined,
      quantity: Number(newQuantity) || 1,
      dietType: newDietType,
      note: newNote.trim() ? `${newNote.trim()} (Duyệt bởi ${actorName})` : `Duyệt bởi ${actorName}`,
    };

    setExtraMeals(prev => [newEntry, ...prev]);
    setShowAddExtraModal(false);
    setNewGuestName('');
    setNewResidentRelation('');
    setNewQuantity(1);
    setNewNote('');
  };

  const toggleDietTag = (tag: string) => {
    setFormDiets(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleAllergyTag = (tag: string) => {
    setFormAllergies(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  if (!canAccessNutrition) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
          color: '#ffffff',
          padding: '1.25rem 1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
            HỆ THỐNG ĐIỀU PHỐI DINH DƯỠNG & BẾP ĂN TÂM AN
          </div>
          <h2 style={{ margin: '0.25rem 0 0.25rem 0', fontSize: '1.4rem', color: '#ffffff' }}>
            Tổng Hợp Suất Ăn & Đăng Ký Dinh Dưỡng Hàng Ngày
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', opacity: 0.95 }}>
            {isCaregiver && `Bạn đang đăng nhập vai trò Nhân viên chăm sóc (${actorName}) — Báo cáo & đăng ký suất ăn cho các cụ phụ trách.`}
            {isManager && `Bạn đang đăng nhập vai trò Quản lý / BGĐ (${actorName}) — Phê duyệt và đăng ký suất ăn bổ sung cho khách & thân nhân.`}
            {isNutritionist && `Bạn đang đăng nhập vai trò Nhân viên dinh dưỡng (${actorName}) — Nắm bắt tổng hợp suất ăn từ toàn bộ NV Chăm sóc & Quản lý.`}
            {isNurse && `Bạn đang đăng nhập vai trò Nhân viên y tế (${actorName}) — Nắm bắt chế độ ăn kiêng khem, dạng chế biến đặc biệt (sonde, xay nhuyễn) theo dõi y lệnh.`}
          </p>
        </div>

        {/* Action Buttons based on Role */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Caregiver Registration Button */}
          {isCaregiver && (
            <button
              type="button"
              onClick={() => {
                const firstId = myAssignedResidents[0]?.residentId || residentRows[0]?.residentId || '';
                if (firstId) handleOpenEditDiet(firstId);
              }}
              style={{
                background: '#fef08a',
                color: '#854d0e',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📝</span> Báo cáo & Đăng ký suất ăn cụ phụ trách ({myAssignedResidents.length} cụ)
            </button>
          )}

          {/* Manager Extra Meal Button */}
          {isManager && (
            <button
              type="button"
              onClick={() => setShowAddExtraModal(true)}
              style={{
                background: '#ffffff',
                color: '#166534',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>➕</span> Đăng ký suất ăn bổ sung / Khách (Quản lý)
            </button>
          )}
        </div>
      </div>

      {/* Caregiver Assigned Quick Notice Card */}
      {isCaregiver && myAssignedResidents.length > 0 && (
        <div
          className="alert-card alert-info"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
          }}
        >
          <div>
            <b>📋 Phân công phụ trách của bạn ({actorName}):</b> Hiện đang trực tiếp chăm sóc <b>{myAssignedResidents.length} người cao tuổi</b>: {' '}
            {myAssignedResidents.map(r => `${r.displayName} (P${r.room})`).join(', ')}.
          </div>
          <span style={{ fontSize: '0.8rem', color: '#0369a1' }}>
            👉 Bấm <b>"Chỉnh sửa suất ăn"</b> ở từng dòng dưới bảng để cập nhật cho bếp.
          </span>
        </div>
      )}

      {/* KPI Cards: Tổng hợp số lượng suất ăn & Tình trạng */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="card" style={{ borderLeft: '4px solid #15803d', padding: '1rem' }}>
          <div className="kpi-label">Tổng suất ăn chuẩn bị</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#15803d', margin: '0.2rem 0' }}>
            {kpis.totalKitchenPrep} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#607067' }}>suất</span>
          </div>
          <div className="kpi-sub">
            {kpis.activeEaters} nội trú + {kpis.totalExtraMeals} bổ sung (Quản lý duyệt)
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #d97706', padding: '1rem' }}>
          <div className="kpi-label">Người cao tuổi tại Tâm An</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#d97706', margin: '0.2rem 0' }}>
            {kpis.activeEaters}/{kpis.totalResidentCount} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#607067' }}>cụ</span>
          </div>
          <div className="kpi-sub" style={{ color: '#d97706' }}>
            Đã trừ {kpis.absentCount} cụ đang tạm vắng (RLA-BR-01)
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #2563eb', padding: '1rem' }}>
          <div className="kpi-label">Phân loại dạng chế biến</div>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.45', marginTop: '0.4rem' }}>
            <div>🍚 Cơm mềm/thường: <b>{kpis.regularSoftCount}</b></div>
            <div>🥣 Nấu nhừ/băm nhỏ: <b>{kpis.mashedSoftCount}</b></div>
            <div>🍲 Xay nhuyễn/súp: <b>{kpis.pureedSoupCount}</b></div>
            <div>🧪 Ăn qua Sonde: <b>{kpis.tubeFeedingCount}</b></div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #7c3aed', padding: '1rem' }}>
          <div className="kpi-label">Chế độ bệnh lý & Dị ứng</div>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.45', marginTop: '0.4rem' }}>
            <div>🩺 Tiểu đường: <b>{kpis.diabetesCount} cụ</b></div>
            <div>🧂 Ăn nhạt (HA cao): <b>{kpis.hypertensionCount} cụ</b></div>
            <div>🥩 Giảm đạm (Thận): <b>{kpis.renalCount} cụ</b></div>
            <div>⚠️ Dị ứng thức ăn: <b>{kpis.allergyCount} cụ</b></div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '0.85rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4b5563', marginRight: '0.4rem' }}>
                Dạng chế biến:
              </span>
              <select
                className="form-select"
                value={selectedFilterPrep}
                onChange={e => setSelectedFilterPrep(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
              >
                <option value="ALL">Tất cả dạng chế biến ({kpis.activeEaters})</option>
                <option value="REGULAR_SOFT">🍚 Cơm mềm / Cơm thường ({kpis.regularSoftCount})</option>
                <option value="MASHED_SOFT">🥣 Nấu nhừ / Băm nhỏ / Cháo ({kpis.mashedSoftCount})</option>
                <option value="PUREED_SOUP">🍲 Xay nhuyễn / Súp loãng ({kpis.pureedSoupCount})</option>
                <option value="TUBE_FEEDING">🧪 Ăn qua Sonde ({kpis.tubeFeedingCount})</option>
              </select>
            </div>

            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4b5563', marginRight: '0.4rem' }}>
                NV Chăm sóc phụ trách:
              </span>
              <select
                className="form-select"
                value={selectedFilterCaregiver}
                onChange={e => setSelectedFilterCaregiver(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
              >
                <option value="ALL">Tất cả nhân viên chăm sóc</option>
                {uniqueCaregivers.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
            Hiển thị <b>{filteredRows.length}</b> / {residentRows.length} người cao tuổi
          </div>
        </div>
      </div>

      {/* Main Resident Dietary & Caregiver Sync Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#1f2937', fontWeight: 700 }}>
            📋 Báo Cáo & Đăng Ký Suất Ăn Chi Tiết Theo Từng Người Cao Tuổi
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            Cập nhật bởi NV Chăm sóc phụ trách & Quản lý
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left', fontSize: '0.82rem', color: '#4b5563' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Người cao tuổi & Phòng</th>
                <th style={{ padding: '0.75rem 1rem' }}>Trạng thái hôm nay</th>
                <th style={{ padding: '0.75rem 1rem' }}>NV Chăm sóc phụ trách</th>
                <th style={{ padding: '0.75rem 1rem' }}>Dạng suất ăn</th>
                <th style={{ padding: '0.75rem 1rem' }}>Bệnh lý & Dị ứng cần kiêng</th>
                <th style={{ padding: '0.75rem 1rem' }}>Ghi chú báo cáo</th>
                <th style={{ padding: '0.75rem 1rem' }}>Thời điểm gửi bếp</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => {
                const prepInfo = PREP_LABELS[row.diet.prepType] || PREP_LABELS.REGULAR_SOFT;

                return (
                  <tr
                    key={row.residentId}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      background: row.isMyResident ? '#f0fdf4' : row.isAbsent ? '#fffbeb' : '#ffffff',
                      opacity: row.isAbsent ? 0.75 : 1,
                    }}
                  >
                    {/* Column 1: Resident Name & Room */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
                        {row.displayName}
                        {row.isMyResident && (
                          <span className="badge badge-success" style={{ marginLeft: '0.4rem', fontSize: '0.68rem' }}>
                            Cụ bạn phụ trách
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>
                        {row.residentCode} • <b>Phòng {row.room}</b> (Giường {row.bed})
                      </div>
                    </td>

                    {/* Column 2: Status Today */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {row.isAbsent ? (
                        <div>
                          <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                            ✈️ Đang tạm vắng
                          </span>
                          <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '0.2rem' }}>
                            Không chuẩn bị suất ăn
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                            ✅ Tại Tâm An ({row.diet.mealsPerDay || 3} cữ)
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Column 3: Assigned Caregiver */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.85rem' }}>
                        🤲 {row.caregiver.staffName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                        {row.caregiver.staffCode}
                      </div>
                    </td>

                    {/* Column 4: Food Prep Texture */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={prepInfo.badge} style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>{prepInfo.icon}</span> {prepInfo.label}
                      </span>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>
                        {row.diet.mealsPerDay} cữ/ngày
                      </div>
                    </td>

                    {/* Column 5: Medical Diets & Allergies */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {row.diet.medicalDiets.map((m, idx) => (
                          <span key={idx} style={{ fontSize: '0.75rem', color: '#0369a1', background: '#e0f2fe', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', width: 'fit-content' }}>
                            🩺 {m}
                          </span>
                        ))}
                        {row.diet.allergies.map((a, idx) => (
                          <span key={idx} style={{ fontSize: '0.75rem', color: '#b91c1c', background: '#fee2e2', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', width: 'fit-content' }}>
                            ⚠️ {a}
                          </span>
                        ))}
                        {row.diet.medicalDiets.length === 0 && row.diet.allergies.length === 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Không có bệnh lý kiêng khem</span>
                        )}
                      </div>
                    </td>

                    {/* Column 6: Caregiver Updates & Feeding Notes */}
                    <td style={{ padding: '0.75rem 1rem', maxWidth: '240px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#374151', lineHeight: '1.4' }}>
                        {row.diet.caregiverNotes}
                      </div>
                    </td>

                    {/* Column 7: Submission Time to Kitchen */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: '#166534', fontSize: '0.82rem' }}>
                        <span>🕒</span> {row.diet.updatedAt || '07:00 - 02/09/2026'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#4b5563', marginTop: '0.15rem' }}>
                        Bởi: <b>{row.diet.reportedByCaregiver || row.caregiver.staffName}</b>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem', marginTop: '0.2rem', padding: '0.1rem 0.35rem', display: 'inline-block' }}>
                        ✅ Đã gửi dữ liệu bếp
                      </span>
                    </td>

                    {/* Column 8: Action */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {isCaregiver ? (
                        row.isMyResident ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEditDiet(row.residentId)}
                            className="btn btn-sm btn-primary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                          >
                            ✏️ Cập nhật suất ăn
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Chỉ xem</span>
                        )
                      ) : isManager ? (
                        <button
                          type="button"
                          onClick={() => handleOpenEditDiet(row.residentId)}
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        >
                          Sửa suất ăn
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Chỉ xem</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Suất Ăn Bổ Sung / Khách (Quản lý) & Thực Đơn Trong Ngày */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Section 1: Suất Ăn Bổ Sung / Khách Đăng Ký (Quản lý duyệt) */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#1f2937', fontWeight: 700 }}>
                👥 Suất Ăn Bổ Sung & Khách Thăm ({kpis.totalExtraMeals} suất)
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Thực hiện và phê duyệt bởi Nhân viên Quản lý
              </div>
            </div>

            {isManager && (
              <button
                type="button"
                onClick={() => setShowAddExtraModal(true)}
                className="btn btn-sm btn-primary"
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
              >
                + Đăng ký
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {extraMeals.map(item => (
              <div
                key={item.id}
                style={{
                  background: '#f8faf8',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827' }}>
                    {item.guestName}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#4b5563', marginTop: '0.15rem' }}>
                    {item.dietType} • <b>Bữa {item.mealTime === 'BREAKFAST' ? 'Sáng' : item.mealTime === 'LUNCH' ? 'Trưa' : 'Tối'}</b>
                  </div>
                  {item.note && (
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontStyle: 'italic', marginTop: '0.15rem' }}>
                      "{item.note}"
                    </div>
                  )}
                </div>
                <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                  {item.quantity} suất
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Thực Đơn Chuẩn Dinh Dưỡng Hôm Nay */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1f2937', fontWeight: 700 }}>
              🥗 Thực Đơn 4 Cữ Dinh Dưỡng Hôm Nay
            </h3>
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
              Bếp Tâm An
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
            <div style={{ background: '#fdfbf7', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', borderLeft: '3px solid #f59e0b' }}>
              <b style={{ color: '#b45309' }}>🌅 Bữa Sáng (06:30 - 07:30):</b> Cháo gà hạt sen / Súp rau củ xay nhuyễn / Sữa hạt dinh dưỡng ngũ cốc.
            </div>

            <div style={{ background: '#f6fbf7', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', borderLeft: '3px solid #10b981' }}>
              <b style={{ color: '#047857' }}>☀️ Bữa Trưa (11:00 - 12:00):</b> Cơm mềm/cháo hạt, Cá hồi hấp thì là, Canh bí đao thịt nạc, Rau củ luộc nhừ, Tráng miệng thanh long.
            </div>

            <div style={{ background: '#f8f9fc', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', borderLeft: '3px solid #6366f1' }}>
              <b style={{ color: '#4338ca' }}>🍵 Bữa Phụ Chiều (14:30 - 15:00):</b> Sữa chua không đường / Sinh tố bơ chuối / Sữa canxi chuyên biệt cho người cao tuổi.
            </div>

            <div style={{ background: '#faf5ff', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', borderLeft: '3px solid #a855f7' }}>
              <b style={{ color: '#7e22ce' }}>🌙 Bữa Tối (17:30 - 18:30):</b> Cháo sườn đậu xanh / Súp thịt bò bí đỏ xay nhuyễn, Rau mồng tơi luộc, Nước ép táo tươi.
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Caregiver Báo Cáo & Đăng Ký Suất Ăn Cho Cụ Phụ Trách */}
      {showCaregiverReportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ maxWidth: '560px', width: '100%', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827' }}>
                📝 Báo Cáo & Đăng Ký Suất Ăn Của Cư Dân
              </h3>
              <button
                type="button"
                onClick={() => setShowCaregiverReportModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCaregiverDiet} style={{ display: 'grid', gap: '1rem' }}>
              {/* Resident Selector */}
              <div>
                <label className="form-label">Chọn Người cao tuổi phụ trách *</label>
                <select
                  className="form-select"
                  value={formResidentId}
                  onChange={e => {
                    const id = e.target.value;
                    const r = residentRows.find(x => x.residentId === id);
                    if (r) {
                      setFormResidentId(r.residentId);
                      setFormPrepType(r.diet.prepType);
                      setFormDiets([...r.diet.medicalDiets]);
                      setFormAllergies([...r.diet.allergies]);
                      setFormCaregiverNotes(r.diet.caregiverNotes);
                      setFormMealsPerDay(r.diet.mealsPerDay || 3);
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  {(isCaregiver ? myAssignedResidents : residentRows).map(r => (
                    <option key={r.residentId} value={r.residentId}>
                      {r.displayName} ({r.residentCode}) — Phòng {r.room} (NV: {r.caregiver.staffName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Prep Texture */}
              <div>
                <label className="form-label">Dạng chế biến suất ăn cho cụ *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {Object.entries(PREP_LABELS).map(([key, item]) => {
                    const isSelected = formPrepType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormPrepType(key as any)}
                        style={{
                          padding: '0.6rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: isSelected ? '2px solid #15803d' : '1px solid #d1d5db',
                          background: isSelected ? '#f0fdf4' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.82rem',
                        }}
                      >
                        <span>{item.icon}</span> {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Number of meals per day */}
              <div>
                <label className="form-label">Số cữ ăn trong ngày *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormMealsPerDay(num)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        border: formMealsPerDay === num ? '2px solid #15803d' : '1px solid #d1d5db',
                        background: formMealsPerDay === num ? '#dcfce7' : '#ffffff',
                        fontWeight: formMealsPerDay === num ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {num} cữ/ngày
                    </button>
                  ))}
                </div>
              </div>

              {/* Medical Diets & Restrictions */}
              <div>
                <label className="form-label">Chế độ bệnh lý & Kiêng khem y khoa</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {[
                    'Tiểu đường',
                    'Tăng huyết áp (Ăn nhạt)',
                    'Suy thận nhẹ (Giảm đạm)',
                    'Tiêu hóa kém',
                    'Bệnh tim mạch (Hạn chế mỡ)',
                    'Răng yếu (Khó nhai)',
                  ].map(tag => {
                    const active = formDiets.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleDietTag(tag)}
                        style={{
                          padding: '0.3rem 0.6rem',
                          borderRadius: '1rem',
                          border: active ? '1px solid #0284c7' : '1px solid #d1d5db',
                          background: active ? '#e0f2fe' : '#f9fafb',
                          color: active ? '#0369a1' : '#4b5563',
                          fontSize: '0.78rem',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {active ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Allergies */}
              <div>
                <label className="form-label">Dị ứng thức ăn</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {[
                    'Dị ứng hải sản (tôm, cua)',
                    'Kiêng đậu phộng',
                    'Không dung nạp lactose',
                    'Kiêng đồ cay nóng',
                  ].map(tag => {
                    const active = formAllergies.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleAllergyTag(tag)}
                        style={{
                          padding: '0.3rem 0.6rem',
                          borderRadius: '1rem',
                          border: active ? '1px solid #dc2626' : '1px solid #d1d5db',
                          background: active ? '#fee2e2' : '#f9fafb',
                          color: active ? '#b91c1c' : '#4b5563',
                          fontSize: '0.78rem',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {active ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Caregiver Notes */}
              <div>
                <label className="form-label">
                  Ghi chú chi tiết từ NV Chăm sóc gửi Bếp *
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  required
                  placeholder="Ví dụ: Cụ mệt ăn ít, cần chia nhỏ làm 4 bữa, bổ sung 1 ly sữa canxi lúc 15:00..."
                  value={formCaregiverNotes}
                  onChange={e => setFormCaregiverNotes(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCaregiverReportModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Lưu & Gửi Bếp ăn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Quản lý Đăng Ký Suất Ăn Bổ Sung / Khách */}
      {showAddExtraModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827' }}>
                ➕ Đăng Ký Suất Ăn Bổ Sung / Khách (Quản lý)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddExtraModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExtraMeal} style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Bữa ăn trong ngày *</label>
                <select
                  className="form-select"
                  value={newMealTime}
                  onChange={e => setNewMealTime(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="BREAKFAST">🌅 Bữa Sáng (06:30)</option>
                  <option value="LUNCH">☀️ Bữa Trưa (11:00)</option>
                  <option value="DINNER">🌙 Bữa Tối (17:30)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Đối tượng hưởng suất *</label>
                <select
                  className="form-select"
                  value={newGuestType}
                  onChange={e => setNewGuestType(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="FAMILY_GUEST">Thân nhân / Khách đến thăm cụ</option>
                  <option value="STAFF_DUTY">Nhân viên trực ca y tế/chăm sóc</option>
                  <option value="OTHER">Khách ngoài / Khác</option>
                </select>
              </div>

              <div>
                <label className="form-label">Họ tên người đăng ký / Thân nhân *</label>
                <input
                  className="form-input"
                  type="text"
                  required
                  placeholder="Ví dụ: Anh Nguyễn Văn Tuấn (Con trai Cụ Tuyết)"
                  value={newGuestName}
                  onChange={e => setNewGuestName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Số lượng suất *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={newQuantity}
                    onChange={e => setNewQuantity(parseInt(e.target.value) || 1)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="form-label">Dạng chế biến</label>
                  <select
                    className="form-select"
                    value={newDietType}
                    onChange={e => setNewDietType(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Cơm thường theo tiêu chuẩn">Cơm thường tiêu chuẩn</option>
                    <option value="Cơm mềm / Cháo hạt">Cơm mềm / Cháo hạt</option>
                    <option value="Cháo xay nhuyễn / Súp dinh dưỡng">Cháo xay nhuyễn / Súp</option>
                    <option value="Ăn chay / Kiêng mỡ">Ăn chay / Kiêng mỡ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Ghi chú khẩu vị / Bàn giao bếp</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ví dụ: Dùng cơm cùng cụ tại phòng 201..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddExtraModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Xác nhận phê duyệt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
