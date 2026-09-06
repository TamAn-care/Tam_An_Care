import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { hasCapability } from '../../auth/role-policy';
import { listResidents } from '../../api/residents';
import {
  fetchMedicationOrders,
  createMedicationOrder,
  fetchDailyAdministrations,
  updateAdministrationStatus,
  fetchInventoryItems,
  createInventoryItem,
  recordInventoryTransaction,
  fetchInventoryTransactions,
  MedicationOrder,
  MedicationAdministration,
  MedicalInventoryItem,
  TimingSlot,
  AdministrationStatus,
  MedicationRoute,
  MealInstruction,
  InventoryCategory,
} from '../../api/medication-inventory';
import { LoadingState, ErrorState } from '../../components/feedback/FeedbackStates';

const ROUTE_LABELS: Record<MedicationRoute, string> = {
  ORAL: 'Đường uống (PO)',
  INJECTION: 'Tiêm / Truyền (IV/IM/SC)',
  TOPICAL: 'Bôi da ngoài (Topical)',
  OPHTHALMIC: 'Nhỏ mắt / tai (Drops)',
  INHALATION: 'Xịt / Khí dung (Inhale)',
};

const TIMING_SLOT_CONFIG: Record<TimingSlot, { label: string; icon: string; time: string; color: string }> = {
  MORNING: { label: 'Cữ Sáng', icon: '🌅', time: '07:30', color: '#f59e0b' },
  NOON: { label: 'Cữ Trưa', icon: '☀️', time: '11:30', color: '#10b981' },
  AFTERNOON: { label: 'Cữ Chiều', icon: '🍵', time: '16:30', color: '#3b82f6' },
  EVENING: { label: 'Cữ Tối', icon: '🌙', time: '20:00', color: '#8b5cf6' },
};

const INSTRUCTION_LABELS: Record<MealInstruction, string> = {
  BEFORE_MEAL: 'Trước ăn 30 phút',
  AFTER_MEAL: 'Sau ăn no',
  WITH_MEAL: 'Cùng trong bữa ăn',
  BEDTIME: 'Trước khi đi ngủ',
  ANYTIME: 'Bất kỳ thời điểm nào',
};

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  DIAGNOSTIC: 'Chẩn đoán & Xét nghiệm nhanh',
  HYGIENE: 'Vệ sinh & Tã bỉm người cao tuổi',
  WOUND_CARE: 'Chăm sóc vết thương & Băng gạc',
  CONSUMABLES: 'Vật tư tiêu hao chăm sóc',
  MEDICINE_SUPPLY: 'Dung dịch & Thuốc cấp cứu tủ trực',
};

export default function MedicationInventoryPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'emar' | 'orders' | 'inventory' | 'reports'>('emar');
  const [selectedSlot, setSelectedSlot] = useState<TimingSlot | 'ALL'>('ALL');
  const [selectedResidentId, setSelectedResidentId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [inventoryFilter, setInventoryFilter] = useState<'ALL' | 'LOW_STOCK' | 'EXPIRING'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | 'ALL'>('ALL');

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'IMPORT' | 'EXPORT_RESIDENT'>('IMPORT');
  const [selectedTxItem, setSelectedTxItem] = useState<MedicalInventoryItem | null>(null);
  const [txQuantity, setTxQuantity] = useState<number>(1);
  const [txResidentId, setTxResidentId] = useState<string>('');
  const [txReason, setTxReason] = useState<string>('');

  // Custom Item State for Open Input Mode
  const [isCustomItem, setIsCustomItem] = useState<boolean>(false);
  const [customItemName, setCustomItemName] = useState<string>('');
  const [customItemUnit, setCustomItemUnit] = useState<string>('Cái');
  const [customItemCategory, setCustomItemCategory] = useState<InventoryCategory>('CONSUMABLES');
  const [customItemLocation, setCustomItemLocation] = useState<string>('Kho y tế Tầng 1');

  // Exception modal state for administration
  const [exceptionModalAdmin, setExceptionModalAdmin] = useState<MedicationAdministration | null>(null);
  const [exceptionStatus, setExceptionStatus] = useState<AdministrationStatus>('HELD');
  const [exceptionNote, setExceptionNote] = useState<string>('');

  // New Order Form state
  const [newOrderResidentId, setNewOrderResidentId] = useState<string>('');
  const [newOrderDrugName, setNewOrderDrugName] = useState<string>('');
  const [newOrderBrandName, setNewOrderBrandName] = useState<string>('');
  const [newOrderDosage, setNewOrderDosage] = useState<string>('1 viên');
  const [newOrderRoute, setNewOrderRoute] = useState<MedicationRoute>('ORAL');
  const [newOrderSlots, setNewOrderSlots] = useState<TimingSlot[]>(['MORNING']);
  const [newOrderInstruction, setNewOrderInstruction] = useState<MealInstruction>('AFTER_MEAL');
  const [newOrderDiagnosis, setNewOrderDiagnosis] = useState<string>('');
  const [newOrderAllergy, setNewOrderAllergy] = useState<string>('');

  // Queries
  const residentsQuery = useQuery({
    queryKey: ['residents-list'],
    queryFn: () => listResidents(actor!),
    enabled: Boolean(actor),
  });

  const emarQuery = useQuery({
    queryKey: ['med-daily-admins'],
    queryFn: () => fetchDailyAdministrations(actor!),
    enabled: Boolean(actor),
  });

  const ordersQuery = useQuery({
    queryKey: ['med-orders'],
    queryFn: () => fetchMedicationOrders(actor!),
    enabled: Boolean(actor),
  });

  const inventoryQuery = useQuery({
    queryKey: ['med-inventory-items'],
    queryFn: () => fetchInventoryItems(actor!),
    enabled: Boolean(actor),
  });

  const txQuery = useQuery({
    queryKey: ['med-inventory-tx'],
    queryFn: () => fetchInventoryTransactions(actor!),
    enabled: Boolean(actor),
  });

  // Mutations
  const updateAdminMutation = useMutation({
    mutationFn: ({ adminId, status, notes }: { adminId: string; status: AdministrationStatus; notes?: string }) =>
      updateAdministrationStatus(actor!, adminId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['med-daily-admins'] });
      setExceptionModalAdmin(null);
      setExceptionNote('');
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!newOrderResidentId || !newOrderDrugName) {
        throw new Error('Vui lòng chọn người cao tuổi và nhập tên thuốc.');
      }
      const res = residentsQuery.data?.find((r) => r.resident.residentId === newOrderResidentId);
      const resData = res?.resident;

      return createMedicationOrder(actor!, {
        residentId: newOrderResidentId,
        residentName: resData?.displayName || 'Người cao tuổi',
        room: resData?.room || '101',
        bed: resData?.bed || '101-A',
        drugName: newOrderDrugName,
        brandName: newOrderBrandName || undefined,
        dosage: newOrderDosage,
        route: newOrderRoute,
        timingSlots: newOrderSlots,
        instruction: newOrderInstruction,
        prescribedBy: actor?.displayName || 'BS. Hoàng Quốc Anh',
        startDate: new Date().toISOString().slice(0, 10),
        diagnosisNote: newOrderDiagnosis || undefined,
        allergyWarning: newOrderAllergy || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['med-orders'] });
      queryClient.invalidateQueries({ queryKey: ['med-daily-admins'] });
      setIsNewOrderModalOpen(false);
      // Reset form
      setNewOrderDrugName('');
      setNewOrderBrandName('');
      setNewOrderDiagnosis('');
      setNewOrderAllergy('');
    },
  });

  const recordTxMutation = useMutation({
    mutationFn: async () => {
      let targetItem = selectedTxItem;

      if (isCustomItem) {
        if (!customItemName.trim()) {
          throw new Error('Vui lòng nhập tên vật tư y tế mới.');
        }
        targetItem = await createInventoryItem(actor!, {
          name: customItemName.trim(),
          category: customItemCategory,
          unit: customItemUnit.trim() || 'Cái',
          location: customItemLocation.trim() || 'Kho y tế Tầng 1',
        });
      }

      if (!targetItem) throw new Error('Vui lòng chọn hoặc nhập tên vật tư y tế.');
      if (txQuantity <= 0) throw new Error('Số lượng phải lớn hơn 0.');

      const res = residentsQuery.data?.find((r) => r.resident.residentId === txResidentId);

      return recordInventoryTransaction(actor!, {
        itemId: targetItem.itemId,
        type: txType,
        quantity: txQuantity,
        residentId: txResidentId || undefined,
        residentName: res?.resident.displayName || undefined,
        reason: txReason || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['med-inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['med-inventory-tx'] });
      setIsTxModalOpen(false);
      setSelectedTxItem(null);
      setIsCustomItem(false);
      setCustomItemName('');
      setCustomItemUnit('Cái');
      setTxQuantity(1);
      setTxReason('');
    },
  });

  const canPrescribe = hasCapability(actor?.actorRole, 'canPrescribeMedication'); // Chỉ NURSE
  const canAdminister = hasCapability(actor?.actorRole, 'canAdministerMedication'); // Chỉ NURSE
  const canManageInv = hasCapability(actor?.actorRole, 'canManageInventory'); // NURSE & CARE_MANAGER

  // Filtered eMAR Administrations
  const filteredAdmins = useMemo(() => {
    let list = emarQuery.data || [];
    if (selectedSlot !== 'ALL') {
      list = list.filter((a) => a.timingSlot === selectedSlot);
    }
    if (selectedResidentId !== 'ALL') {
      list = list.filter((a) => a.residentId === selectedResidentId);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (a) =>
          a.residentName.toLowerCase().includes(q) ||
          a.drugName.toLowerCase().includes(q) ||
          a.room.toLowerCase().includes(q)
      );
    }
    return list;
  }, [emarQuery.data, selectedSlot, selectedResidentId, searchTerm]);

  // Filtered Inventory items
  const filteredInventory = useMemo(() => {
    let list = inventoryQuery.data || [];
    if (selectedCategory !== 'ALL') {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (inventoryFilter === 'LOW_STOCK') {
      list = list.filter((i) => i.currentStock <= i.minStockThreshold);
    } else if (inventoryFilter === 'EXPIRING') {
      list = list.filter((i) => {
        const exp = new Date(i.expiryDate).getTime();
        const daysLeft = (exp - Date.now()) / (1000 * 60 * 60 * 24);
        return daysLeft <= 30;
      });
    }
    return list;
  }, [inventoryQuery.data, selectedCategory, inventoryFilter]);

  // eMAR Progress calculation
  const totalDoses = emarQuery.data?.length || 0;
  const givenDoses = emarQuery.data?.filter((a) => a.status === 'GIVEN').length || 0;
  const heldDoses = emarQuery.data?.filter((a) => a.status === 'HELD' || a.status === 'REFUSED').length || 0;
  const completionPercentage = totalDoses > 0 ? Math.round((givenDoses / totalDoses) * 100) : 0;

  // Inventory KPI counts
  const inventoryItemsList = inventoryQuery.data || [];
  const lowStockCount = inventoryItemsList.filter((i) => i.currentStock <= i.minStockThreshold).length;
  const expiringCount = inventoryItemsList.filter((i) => {
    const exp = new Date(i.expiryDate).getTime();
    const now = Date.now();
    const daysLeft = (exp - now) / (1000 * 60 * 60 * 24);
    return daysLeft <= 30;
  }).length;

  if (emarQuery.isLoading || ordersQuery.isLoading || inventoryQuery.isLoading) {
    return <LoadingState title="Đang tải dữ liệu Dược phẩm & Tồn kho y tế..." />;
  }

  if (emarQuery.isError || ordersQuery.isError || inventoryQuery.isError) {
    return <ErrorState title="Lỗi kết nối" description="Không thể tải dữ liệu dược phẩm và vật tư y tế." />;
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <header className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="eyebrow" style={{ color: '#15803d', fontWeight: 700 }}>
          💊 QUẢN LÝ DƯỢC PHẨM & TỒN KHO Y TẾ (SERIES AD)
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ color: '#1e293b' }}>
              Sổ Cấp Phát Thuốc eMAR & Tồn Kho Vật Tư
            </h1>
            <p className="page-description">
              Điểm danh cấp phát thuốc chuẩn 5 Đúng trong y khoa, quản lý y lệnh của Bác sĩ và kiểm soát hạn dùng/tồn kho vật tư tiêu hao.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {canPrescribe && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsNewOrderModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
              >
                ➕ Thêm Y Lệnh Thuốc Mới
              </button>
            )}
            {canManageInv && (
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => {
                  setTxType('IMPORT');
                  setIsTxModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
              >
                📥 Nhập Kho Vật Tư
              </button>
            )}
            {actor?.actorRole === 'SUPERVISOR' && (
              <span className="badge badge-purple" style={{ padding: '0.45rem 0.75rem', fontWeight: 700 }}>
                👑 Ban Giám đốc: Toàn quyền xem quản lý & điều hành
              </span>
            )}
            {actor?.actorRole === 'CARE_MANAGER' && (
              <span className="badge badge-info" style={{ padding: '0.45rem 0.75rem', fontWeight: 700 }}>
                📋 Quản lý: Giám sát y lệnh & Quản lý kho vật tư
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Tabs Header */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('emar')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'emar' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'emar' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          💊 Lịch Cấp Phát eMAR Hôm Nay
          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
            {givenDoses}/{totalDoses} Đã cho uống
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'orders' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'orders' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📋 Sổ Y Lệnh Thuốc Của Cụ
          <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
            {ordersQuery.data?.length || 0} Y lệnh
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'inventory' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'inventory' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📦 Kho Vật Tư Tiêu Hao
          {lowStockCount > 0 && (
            <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
              ⚠️ {lowStockCount} Sắp hết
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'reports' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'reports' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📊 Nhật Ký Sử Dụng & Chi Phí
        </button>
      </div>

      {/* TAB 1: eMAR DAILY ADMINISTRATION */}
      {activeTab === 'emar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Progress & 5 Rights Header Card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
              border: '1px solid #bbf7d0',
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#14532d', fontSize: '1.1rem' }}>
                  Tiến Độ Cấp Phát Thuốc Ngày {new Date().toLocaleDateString('vi-VN')}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.2rem' }}>
                  Đã hoàn thành <b>{givenDoses}/{totalDoses}</b> liều uống • {heldDoses > 0 && <span style={{ color: '#b45309' }}>({heldDoses} liều hoãn/từ chối) • </span>} <b>{completionPercentage}%</b> kế hoạch cữ thuốc
                </div>
              </div>

              {/* 5 Rights Badge Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span className="badge badge-success">1. Đúng Cụ</span>
                <span className="badge badge-success">2. Đúng Thuốc</span>
                <span className="badge badge-success">3. Đúng Liều</span>
                <span className="badge badge-success">4. Đúng Đường Dùng</span>
                <span className="badge badge-success">5. Đúng Thời Gian</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.85rem', overflow: 'hidden' }}>
              <div style={{ width: `${completionPercentage}%`, height: '100%', background: '#16a34a', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Filters Bar */}
          <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            {/* Slot Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className={`btn btn-sm ${selectedSlot === 'ALL' ? 'btn-primary' : 'btn-neutral'}`}
                onClick={() => setSelectedSlot('ALL')}
              >
                Tất cả cữ ({totalDoses})
              </button>

              {(Object.keys(TIMING_SLOT_CONFIG) as TimingSlot[]).map((slot) => {
                const conf = TIMING_SLOT_CONFIG[slot];
                const count = emarQuery.data?.filter((a) => a.timingSlot === slot).length || 0;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`btn btn-sm ${selectedSlot === slot ? 'btn-primary' : 'btn-neutral'}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {conf.icon} {conf.label} ({conf.time}) [{count}]
                  </button>
                );
              })}
            </div>

            {/* Resident Selector Filter & Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="🔍 Tìm tên Cụ, tên thuốc, phòng..."
                className="text-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '220px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
              />

              <select
                className="text-input"
                value={selectedResidentId}
                onChange={(e) => setSelectedResidentId(e.target.value)}
                style={{ minWidth: '170px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
              >
                <option value="ALL">Tất cả người cao tuổi</option>
                {residentsQuery.data?.map((r) => (
                  <option key={r.resident.residentId} value={r.resident.residentId}>
                    {r.resident.displayName} — P.{r.resident.room || '101'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-sm btn-neutral"
                onClick={() => window.print()}
                title="In bảng cấp phát thuốc trực ca"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
              >
                🖨️ In Bảng eMAR
              </button>
            </div>
          </div>

          {/* eMAR Administrations List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredAdmins.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Không có cữ thuốc nào cần cấp phát trong bộ lọc này.
              </div>
            ) : (
              filteredAdmins.map((admin) => {
                const slotConf = TIMING_SLOT_CONFIG[admin.timingSlot];
                const isGiven = admin.status === 'GIVEN';
                const isPending = admin.status === 'PENDING';
                const isHeld = admin.status === 'HELD' || admin.status === 'REFUSED';

                return (
                  <div
                    key={admin.adminId}
                    className="card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem 1.25rem',
                      background: isGiven ? '#f0fdf4' : isHeld ? '#fffbeb' : '#ffffff',
                      border: `1px solid ${isGiven ? '#86efac' : isHeld ? '#fde68a' : '#cbd5e1'}`,
                      borderLeft: `5px solid ${isGiven ? '#16a34a' : isHeld ? '#d97706' : '#3b82f6'}`,
                      borderRadius: '0.5rem',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    {/* Left details */}
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                          👵 {admin.residentName}
                        </span>
                        <span className="badge badge-neutral" style={{ fontSize: '0.8rem' }}>
                          Phòng {admin.room} — Giường {admin.bed}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                          }}
                        >
                          {slotConf.icon} {slotConf.label} ({admin.scheduledTime})
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#166534', fontSize: '1rem' }}>
                          💊 {admin.drugName}
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>
                          Liều: {admin.dosage}
                        </span>
                        <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
                          {ROUTE_LABELS[admin.route] || admin.route}
                        </span>
                        <span className="badge badge-warning" style={{ fontSize: '0.78rem' }}>
                          🍽️ {INSTRUCTION_LABELS[admin.instruction] || admin.instruction}
                        </span>
                      </div>

                      {admin.allergyWarning && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#b91c1c', fontWeight: 700 }}>
                          {admin.allergyWarning}
                        </div>
                      )}

                      {admin.notes && (
                        <div style={{ marginTop: '0.3rem', fontSize: '0.82rem', color: '#4b5563', fontStyle: 'italic' }}>
                          Ghi chú: "{admin.notes}"
                        </div>
                      )}

                      {isGiven && (
                        <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>
                          ✓ Đã cho uống bởi <b>{admin.administeredBy}</b> lúc {new Date(admin.administeredAt || '').toLocaleTimeString('vi-VN')}
                        </div>
                      )}
                    </div>

                    {/* Right actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isGiven ? (
                        <span className="badge badge-success" style={{ padding: '0.5rem 0.8rem', fontSize: '0.88rem' }}>
                          ✅ ĐÃ CHO UỐNG
                        </span>
                      ) : isHeld ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="badge badge-warning" style={{ padding: '0.5rem 0.8rem', fontSize: '0.88rem' }}>
                            ⚠️ {admin.status === 'REFUSED' ? 'TỪ CHỐI UỐNG' : 'TẠM HOÃN'}
                          </span>
                          {canAdminister && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => updateAdminMutation.mutate({ adminId: admin.adminId, status: 'GIVEN' })}
                            >
                              Cho uống lại
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {canAdminister ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={updateAdminMutation.isPending}
                                onClick={() => updateAdminMutation.mutate({ adminId: admin.adminId, status: 'GIVEN' })}
                                style={{ fontWeight: 700 }}
                              >
                                ✅ Ký Đã Cho Uống
                              </button>
                              <button
                                type="button"
                                className="btn btn-neutral"
                                onClick={() => {
                                  setExceptionModalAdmin(admin);
                                  setExceptionStatus('HELD');
                                }}
                              >
                                ⏸️ Hoãn / Từ chối
                              </button>
                            </>
                          ) : (
                            <span className="badge badge-neutral">
                              {actor?.actorRole === 'SUPERVISOR'
                                ? 'BGĐ: Xem giám sát'
                                : actor?.actorRole === 'CARE_MANAGER'
                                ? 'Quản lý: Theo dõi y lệnh'
                                : 'Chờ Điều dưỡng cấp phát'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PRESCRIPTIONS & MEDICATION ORDERS */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>
                  📋 Danh Sách Y Lệnh Thuốc Đang Áp Dụng Cho Người Cao Tuổi
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {canPrescribe
                    ? '🩺 Nhân viên y tế có quyền phân chia thuốc và kê đơn theo y lệnh Bác sĩ'
                    : '👁️ Quyền xem giám sát y lệnh điều trị y khoa của các Cụ'}
                </div>
              </div>

              {canPrescribe ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsNewOrderModalOpen(true)}
                  style={{ fontWeight: 700 }}
                >
                  ➕ Kê Đơn / Thêm Y Lệnh Mới
                </button>
              ) : (
                <span className="badge badge-neutral">
                  Chỉ Nhân viên y tế mới có quyền phân chia thuốc
                </span>
              )}
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Người cao tuổi</th>
                    <th>Vị trí</th>
                    <th>Tên thuốc & Biệt dược</th>
                    <th>Liều lượng</th>
                    <th>Đường dùng</th>
                    <th>Cữ uống trong ngày</th>
                    <th>Thời điểm ăn</th>
                    <th>Bác sĩ chỉ định</th>
                    <th>Chẩn đoán</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersQuery.data?.map((order) => (
                    <tr key={order.orderId}>
                      <td><b>{order.residentName}</b></td>
                      <td>P.{order.room} ({order.bed})</td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#14532d' }}>{order.drugName}</div>
                        {order.brandName && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>({order.brandName})</div>}
                        {order.allergyWarning && (
                          <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>{order.allergyWarning}</div>
                        )}
                      </td>
                      <td><b>{order.dosage}</b></td>
                      <td>{ROUTE_LABELS[order.route]}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {order.timingSlots.map((s) => (
                            <span key={s} className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                              {TIMING_SLOT_CONFIG[s].icon} {TIMING_SLOT_CONFIG[s].label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{INSTRUCTION_LABELS[order.instruction]}</td>
                      <td>{order.prescribedBy}</td>
                      <td style={{ fontSize: '0.82rem', color: '#4b5563' }}>{order.diagnosisNote || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MEDICAL CONSUMABLES INVENTORY */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Inventory KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ background: '#ffffff', padding: '1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TỔNG MẶT HÀNG TRONG KHO</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginTop: '0.2rem' }}>
                {inventoryItemsList.length} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>danh mục</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '0.2rem' }}>Đang quản lý theo số lô & hạn dùng</div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>CẢNH BÁO SẮP HẾT HÀNG</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: lowStockCount > 0 ? '#dc2626' : '#16a34a', marginTop: '0.2rem' }}>
                {lowStockCount} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>mặt hàng</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: lowStockCount > 0 ? '#b91c1c' : '#16a34a', marginTop: '0.2rem' }}>
                {lowStockCount > 0 ? 'Cần làm đề xuất nhập kho gấp' : 'Mức tồn kho an toàn'}
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>VẬT TƯ CẬN HẠN SỬ DỤNG (&lt;30 NGÀY)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: expiringCount > 0 ? '#d97706' : '#16a34a', marginTop: '0.2rem' }}>
                {expiringCount} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>mặt hàng</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: expiringCount > 0 ? '#b45309' : '#16a34a', marginTop: '0.2rem' }}>
                {expiringCount > 0 ? 'Ưu tiên xuất dùng trước' : 'Hạn dùng đạt chuẩn'}
              </div>
            </div>
          </div>

          {/* Inventory Table & Filters */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>
                  📦 Tồn Kho Vật Tư Tiêu Hao & Dụng Cụ Y Tế
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Hiển thị {filteredInventory.length}/{inventoryItemsList.length} mặt hàng
                </div>
              </div>

              {/* Inventory Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${inventoryFilter === 'ALL' ? 'btn-primary' : 'btn-neutral'}`}
                  onClick={() => setInventoryFilter('ALL')}
                >
                  Tất cả ({inventoryItemsList.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${inventoryFilter === 'LOW_STOCK' ? 'btn-danger' : 'btn-neutral'}`}
                  onClick={() => setInventoryFilter('LOW_STOCK')}
                >
                  ⚠️ Sắp hết ({lowStockCount})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${inventoryFilter === 'EXPIRING' ? 'btn-warning' : 'btn-neutral'}`}
                  onClick={() => setInventoryFilter('EXPIRING')}
                >
                  ⌛ Cận hạn ({expiringCount})
                </button>

                <select
                  className="text-input"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as any)}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                >
                  <option value="ALL">Tất cả nhóm vật tư</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              {canManageInv ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setTxType('IMPORT');
                      setIsTxModalOpen(true);
                    }}
                  >
                    📥 Nhập Kho Vật Tư
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => {
                      setTxType('EXPORT_RESIDENT');
                      setIsTxModalOpen(true);
                    }}
                  >
                    📤 Xuất Dùng Cho Cụ
                  </button>
                </div>
              ) : (
                <span className="badge badge-neutral">
                  Chế độ xem tồn kho
                </span>
              )}
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã VT</th>
                    <th>Tên vật tư / Dụng cụ y tế</th>
                    <th>Phân loại</th>
                    <th>Số lượng tồn</th>
                    <th>Ngưỡng tối thiểu</th>
                    <th>Số lô</th>
                    <th>Hạn sử dụng</th>
                    <th>Vị trí tủ thuốc</th>
                    <th>Đơn giá</th>
                    {canManageInv && <th>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const isLow = item.currentStock <= item.minStockThreshold;
                    const expTime = new Date(item.expiryDate).getTime();
                    const daysLeft = (expTime - Date.now()) / (1000 * 60 * 60 * 24);
                    const isExpiring = daysLeft <= 30;

                    return (
                      <tr key={item.itemId}>
                        <td><code>{item.itemCode}</code></td>
                        <td>
                          <b>{item.name}</b>
                          {isLow && (
                            <span className="badge badge-danger" style={{ marginLeft: '0.4rem', fontSize: '0.72rem' }}>
                              ⚠️ Sắp hết
                            </span>
                          )}
                          {isExpiring && (
                            <span className="badge badge-warning" style={{ marginLeft: '0.4rem', fontSize: '0.72rem' }}>
                              ⌛ Cận hạn ({Math.round(daysLeft)} ngày)
                            </span>
                          )}
                        </td>
                        <td>{CATEGORY_LABELS[item.category]}</td>
                        <td>
                          <b style={{ color: isLow ? '#dc2626' : '#15803d', fontSize: '1rem' }}>
                            {item.currentStock} {item.unit}
                          </b>
                        </td>
                        <td>{item.minStockThreshold} {item.unit}</td>
                        <td><code>{item.lotNumber}</code></td>
                        <td style={{ color: isExpiring ? '#b45309' : '#1e293b', fontWeight: isExpiring ? 700 : 400 }}>
                          {item.expiryDate}
                        </td>
                        <td>{item.location}</td>
                        <td>{item.unitPrice.toLocaleString('vi-VN')} đ</td>
                        {canManageInv && (
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-neutral"
                              onClick={() => {
                                setSelectedTxItem(item);
                                setTxType('EXPORT_RESIDENT');
                                setIsTxModalOpen(true);
                              }}
                            >
                              Xuất dùng
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS & REPORTS */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.15rem' }}>
              📊 Nhật Ký Nhập / Xuất Kho & Cấp Phát Vật Tư
            </h3>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Loại giao dịch</th>
                    <th>Tên vật tư</th>
                    <th>Số lượng</th>
                    <th>Người thực hiện</th>
                    <th>Người cao tuổi nhận</th>
                    <th>Lý do / Diễn giải</th>
                  </tr>
                </thead>
                <tbody>
                  {txQuery.data?.map((tx) => (
                    <tr key={tx.transactionId}>
                      <td>{new Date(tx.timestamp).toLocaleString('vi-VN')}</td>
                      <td>
                        <span className={tx.type === 'IMPORT' ? 'badge badge-success' : 'badge badge-info'}>
                          {tx.type === 'IMPORT' ? 'Nhập kho' : 'Xuất dùng cho Cụ'}
                        </span>
                      </td>
                      <td><b>{tx.itemName}</b></td>
                      <td><b>{tx.quantity} {tx.unit}</b></td>
                      <td>{tx.performedBy}</td>
                      <td>{tx.residentName ? <b>{tx.residentName}</b> : '—'}</td>
                      <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{tx.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCEPTION / HOLD REASON */}
      {exceptionModalAdmin && (
        <div className="modal-overlay" onClick={() => setExceptionModalAdmin(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '480px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>
                ⚠️ Ghi Nhận Tạm Hoãn / Từ Chối Uống Thuốc
              </h3>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setExceptionModalAdmin(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.88rem', border: '1px solid #e2e8f0' }}>
              <div>Cụ: <b>{exceptionModalAdmin.residentName}</b> (Phòng {exceptionModalAdmin.room})</div>
              <div>Thuốc: <b>{exceptionModalAdmin.drugName}</b> (Liều: {exceptionModalAdmin.dosage})</div>
            </div>

            <label className="field-group" style={{ marginBottom: '1rem' }}>
              <span className="field-label">Trạng thái ghi nhận *</span>
              <select
                className="text-input"
                value={exceptionStatus}
                onChange={(e) => setExceptionStatus(e.target.value as AdministrationStatus)}
              >
                <option value="HELD">Tạm hoãn do lý do lâm sàng (Hạ HA, sốt, buồn nôn, đang ngủ)</option>
                <option value="REFUSED">Người cao tuổi từ chối uống</option>
              </select>
            </label>

            <label className="field-group" style={{ marginBottom: '1.25rem' }}>
              <span className="field-label">Lý do chi tiết & Diễn giải lâm sàng *</span>
              <textarea
                className="text-input"
                rows={3}
                placeholder="Ví dụ: Đo huyết áp lúc 07:30 là 85/55 mmHg, hoãn uống Amlor chờ báo Bác sĩ..."
                value={exceptionNote}
                onChange={(e) => setExceptionNote(e.target.value)}
                required
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setExceptionModalAdmin(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-warning"
                disabled={!exceptionNote.trim() || updateAdminMutation.isPending}
                onClick={() =>
                  updateAdminMutation.mutate({
                    adminId: exceptionModalAdmin.adminId,
                    status: exceptionStatus,
                    notes: exceptionNote,
                  })
                }
              >
                Xác Nhận Ghi Nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW MEDICATION ORDER */}
      {isNewOrderModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewOrderModalOpen(false)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '660px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                ➕ Thêm Y Lệnh Thuốc & Kê Đơn Mới
              </h3>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setIsNewOrderModalOpen(false)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createOrderMutation.mutate();
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <label className="field-group">
                  <span className="field-label">Chọn Người cao tuổi *</span>
                  <select
                    className="text-input"
                    value={newOrderResidentId}
                    onChange={(e) => setNewOrderResidentId(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn Cụ --</option>
                    {residentsQuery.data?.map((r) => (
                      <option key={r.resident.residentId} value={r.resident.residentId}>
                        {r.resident.displayName} — P.{r.resident.room || '101'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Tên Hoạt Chất Thuốc *</span>
                  <input
                    className="text-input"
                    placeholder="VD: Amlodipine, Metformin, Paracetamol..."
                    value={newOrderDrugName}
                    onChange={(e) => setNewOrderDrugName(e.target.value)}
                    required
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Biệt dược & Hàm lượng</span>
                  <input
                    className="text-input"
                    placeholder="VD: Amlor 5mg, Glucophage 500mg..."
                    value={newOrderBrandName}
                    onChange={(e) => setNewOrderBrandName(e.target.value)}
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Liều lượng mỗi lần uống *</span>
                  <input
                    className="text-input"
                    placeholder="VD: 1 viên, 2 viên, 1 gói..."
                    value={newOrderDosage}
                    onChange={(e) => setNewOrderDosage(e.target.value)}
                    required
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Đường dùng *</span>
                  <select
                    className="text-input"
                    value={newOrderRoute}
                    onChange={(e) => setNewOrderRoute(e.target.value as MedicationRoute)}
                  >
                    {Object.entries(ROUTE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Hướng dẫn dùng bữa *</span>
                  <select
                    className="text-input"
                    value={newOrderInstruction}
                    onChange={(e) => setNewOrderInstruction(e.target.value as MealInstruction)}
                  >
                    {Object.entries(INSTRUCTION_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Timing Slots Checklist */}
              <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <span className="field-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Cữ uống trong ngày * (Tự động sinh lịch eMAR):
                </span>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {(Object.keys(TIMING_SLOT_CONFIG) as TimingSlot[]).map((slot) => {
                    const isChecked = newOrderSlots.includes(slot);
                    return (
                      <label key={slot} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', cursor: 'pointer', background: isChecked ? '#dcfce7' : '#ffffff', padding: '0.35rem 0.65rem', borderRadius: '0.35rem', border: isChecked ? '1px solid #86efac' : '1px solid #e2e8f0' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewOrderSlots([...newOrderSlots, slot]);
                            } else {
                              setNewOrderSlots(newOrderSlots.filter((s) => s !== slot));
                            }
                          }}
                        />
                        {TIMING_SLOT_CONFIG[slot].icon} {TIMING_SLOT_CONFIG[slot].label} ({TIMING_SLOT_CONFIG[slot].time})
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="field-group" style={{ marginBottom: '1rem' }}>
                <span className="field-label">Chẩn đoán / Chỉ định y khoa</span>
                <input
                  className="text-input"
                  placeholder="VD: Điều trị tăng huyết áp độ 2, phòng ngừa tai biến..."
                  value={newOrderDiagnosis}
                  onChange={(e) => setNewOrderDiagnosis(e.target.value)}
                />
              </label>

              <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                <span className="field-label">Cảnh báo dị ứng / Lưu ý đặc biệt</span>
                <input
                  className="text-input"
                  placeholder="VD: Cụ dị ứng Penicillin, uống với nhiều nước..."
                  value={newOrderAllergy}
                  onChange={(e) => setNewOrderAllergy(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => setIsNewOrderModalOpen(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createOrderMutation.isPending || newOrderSlots.length === 0}
                  style={{ fontWeight: 700 }}
                >
                  {createOrderMutation.isPending ? 'Đang lưu...' : 'Lưu Y Lệnh Thuốc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVENTORY TRANSACTION */}
      {isTxModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTxModalOpen(false)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '520px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>
                {txType === 'IMPORT' ? '📥 Nhập Kho Vật Tư Y Tế' : '📤 Xuất Kho Sử Dụng Cho Người Cao Tuổi'}
              </h3>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setIsTxModalOpen(false)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordTxMutation.mutate();
              }}
            >
              <div className="field-group" style={{ marginBottom: '1rem' }}>
                <span className="field-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 700 }}>
                  Chọn Vật Tư Y Tế *
                </span>

                {/* Mode Selector Segmented Tabs */}
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomItem(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.5rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      background: !isCustomItem ? '#ffffff' : 'transparent',
                      color: !isCustomItem ? '#15803d' : '#64748b',
                      fontWeight: 700,
                      fontSize: '0.83rem',
                      cursor: 'pointer',
                      boxShadow: !isCustomItem ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    📋 Chọn từ danh mục kho
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomItem(true);
                      setSelectedTxItem(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.5rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      background: isCustomItem ? '#ffffff' : 'transparent',
                      color: isCustomItem ? '#15803d' : '#64748b',
                      fontWeight: 700,
                      fontSize: '0.83rem',
                      cursor: 'pointer',
                      boxShadow: isCustomItem ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    ✍️ Nhập thủ công (Vật tư khác)
                  </button>
                </div>

                {!isCustomItem ? (
                  <select
                    className="text-input"
                    value={selectedTxItem?.itemId || ''}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomItem(true);
                        setSelectedTxItem(null);
                      } else {
                        const item = inventoryItemsList.find((i) => i.itemId === e.target.value);
                        setSelectedTxItem(item || null);
                      }
                    }}
                    required={!isCustomItem}
                  >
                    <option value="">-- Chọn mặt hàng có sẵn --</option>
                    {inventoryItemsList.map((item) => (
                      <option key={item.itemId} value={item.itemId}>
                        {item.name} ({item.currentStock} {item.unit} khả dụng)
                      </option>
                    ))}
                    <option value="__CUSTOM__" style={{ fontWeight: 700, color: '#15803d' }}>
                      ✍️ ➕ Nhập thủ công vật tư y tế khác (Chưa có trong danh mục)...
                    </option>
                  </select>
                ) : (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.85rem', marginTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      ✍️ Nhập thủ công thông tin vật tư y tế khác (Tự động cập nhật vào danh mục kho)
                    </div>
                    
                    <label className="field-group" style={{ marginBottom: '0.75rem' }}>
                      <span className="field-label">Tên vật tư y tế khác (Nhập thủ công) *</span>
                      <input
                        className="text-input"
                        placeholder="VD: Băng cá nhân, Oxy y tế, Kim tiêm 10ml, Dung dịch Povidone..."
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        required={isCustomItem}
                        autoFocus
                      />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <label className="field-group">
                        <span className="field-label">Đơn vị tính *</span>
                        <input
                          className="text-input"
                          placeholder="VD: Hộp, Cái, Cuộn, Gói, Chai..."
                          value={customItemUnit}
                          onChange={(e) => setCustomItemUnit(e.target.value)}
                          required={isCustomItem}
                        />
                      </label>

                      <label className="field-group">
                        <span className="field-label">Phân loại vật tư *</span>
                        <select
                          className="text-input"
                          value={customItemCategory}
                          onChange={(e) => setCustomItemCategory(e.target.value as InventoryCategory)}
                        >
                          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <label className="field-group">
                  <span className="field-label">Số lượng *</span>
                  <input
                    type="number"
                    min="1"
                    className="text-input"
                    value={txQuantity}
                    onChange={(e) => setTxQuantity(Number(e.target.value))}
                    required
                  />
                </label>

                {txType === 'EXPORT_RESIDENT' && (
                  <label className="field-group">
                    <span className="field-label">Cấp phát cho Cụ *</span>
                    <select
                      className="text-input"
                      value={txResidentId}
                      onChange={(e) => setTxResidentId(e.target.value)}
                      required
                    >
                      <option value="">-- Chọn Cụ --</option>
                      {residentsQuery.data?.map((r) => (
                        <option key={r.resident.residentId} value={r.resident.residentId}>
                          {r.resident.displayName} — P.{r.resident.room || '101'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                <span className="field-label">Lý do & Diễn giải</span>
                <input
                  className="text-input"
                  placeholder={txType === 'IMPORT' ? 'VD: Nhập bổ sung đầu tuần...' : 'VD: Thay băng vết thương, kiểm tra đường huyết...'}
                  value={txReason}
                  onChange={(e) => setTxReason(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => {
                    setIsTxModalOpen(false);
                    setIsCustomItem(false);
                    setSelectedTxItem(null);
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={recordTxMutation.isPending || (!selectedTxItem && (!isCustomItem || !customItemName.trim()))}
                  style={{ fontWeight: 700 }}
                >
                  {recordTxMutation.isPending ? 'Đang lưu...' : 'Xác Nhận Giao Dịch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
