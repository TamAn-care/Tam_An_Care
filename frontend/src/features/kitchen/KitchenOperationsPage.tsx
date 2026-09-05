import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { hasCapability } from '../../auth/role-policy';
import {
  fetchFoodReceivingBatches,
  createFoodReceivingBatch,
  fetchFoodInventory,
  dispatchFoodForCooking,
  fetchFoodSamples,
  createFoodSampleRecord,
  destroyFoodSampleRecord,
  downloadKitchenInventoryCSV,
  fetchDailyDispatches,
  fetchVendors,
  FOOD_CATEGORY_META,
  STORAGE_ZONE_META,
  StorageZone,
  InspectionStatus,
  FoodReceivingBatch,
  FoodReceivingItem,
} from '../../api/kitchen-operations';

export default function KitchenOperationsPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'RECEIVING' | 'INVENTORY' | 'SAMPLES' | 'AUDIT'>('RECEIVING');

  // Permissions
  const isNutritionist = actor?.actorRole === 'NUTRITIONIST';
  const isDirector = actor?.actorRole === 'SUPERVISOR';
  const isManager = actor?.actorRole === 'CARE_MANAGER';
  const canManageKitchen = hasCapability(actor?.actorRole, 'canManageKitchenOperations');

  // Queries
  const batchesQuery = useQuery({ queryKey: ['kitchen-batches'], queryFn: fetchFoodReceivingBatches });
  const inventoryQuery = useQuery({ queryKey: ['kitchen-inventory'], queryFn: fetchFoodInventory });
  const samplesQuery = useQuery({ queryKey: ['kitchen-samples'], queryFn: fetchFoodSamples });
  const dispatchesQuery = useQuery({ queryKey: ['kitchen-dispatches'], queryFn: fetchDailyDispatches });
  const vendorsQuery = useQuery({ queryKey: ['kitchen-vendors'], queryFn: fetchVendors });

  const batches = batchesQuery.data || [];
  const inventory = inventoryQuery.data || [];
  const samples = samplesQuery.data || [];
  const dispatches = dispatchesQuery.data || [];
  const vendors = vendorsQuery.data || [];

  // Modal States
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [showDetailBatchModal, setShowDetailBatchModal] = useState<FoodReceivingBatch | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showNewSampleModal, setShowNewSampleModal] = useState(false);

  // Filters for Receiving Tab
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Inventory Filter
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalMonthCost = batches.reduce((acc, b) => acc + b.totalValue, 0);
    const totalBatches = batches.length;
    const acceptedBatches = batches.filter((b) => b.overallStatus === 'ACCEPTED').length;
    const acceptanceRate = totalBatches > 0 ? Math.round((acceptedBatches / totalBatches) * 100) : 100;
    const totalInventoryItems = inventory.length;
    const lowStockItems = inventory.filter((i) => i.currentStock <= i.minSafetyStock).length;
    const activeSamples = samples.filter((s) => s.status === 'ACTIVE_STORAGE').length;

    return {
      totalMonthCost,
      totalBatches,
      acceptanceRate,
      totalInventoryItems,
      lowStockItems,
      activeSamples,
    };
  }, [batches, inventory, samples]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (vendorFilter !== 'ALL' && b.vendorId !== vendorFilter) return false;
      if (statusFilter !== 'ALL' && b.overallStatus !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          b.batchId.toLowerCase().includes(q) ||
          b.vendorName.toLowerCase().includes(q) ||
          b.deliveryNoteNumber.toLowerCase().includes(q) ||
          b.receiverName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [batches, vendorFilter, statusFilter, searchTerm]);

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter((i) => {
      if (zoneFilter !== 'ALL' && i.storageZone !== zoneFilter) return false;
      if (categoryFilter !== 'ALL' && i.category !== categoryFilter) return false;
      return true;
    });
  }, [inventory, zoneFilter, categoryFilter]);

  // Form State for New Receiving Batch
  const [newBatchVendorId, setNewBatchVendorId] = useState(vendors[0]?.id || 'VND-001');
  const [newBatchVendorName, setNewBatchVendorName] = useState(vendors[0]?.vendorName || 'Công ty Thực Phẩm Sạch Vissan Care');
  const [isCustomVendor, setIsCustomVendor] = useState(false);
  const [newBatchNoteNumber, setNewBatchNoteNumber] = useState('');
  const [newBatchPlate, setNewBatchPlate] = useState('');
  const [newBatchDeliverer, setNewBatchDeliverer] = useState('');
  const [newBatchDelivererPhone, setNewBatchDelivererPhone] = useState('');
  const [newBatchNotes, setNewBatchNotes] = useState('');
  const [newBatchOverallStatus, setNewBatchOverallStatus] = useState<InspectionStatus>('ACCEPTED');

  const [newBatchItems, setNewBatchItems] = useState<FoodReceivingItem[]>([
    {
      itemId: 'ITEM-NEW-1',
      itemName: 'Thịt heo nạc dăm VietGAP',
      category: 'MEAT_SEAFOOD',
      orderedQuantity: 15.0,
      actualQuantity: 15.0,
      unit: 'kg',
      variance: 0.0,
      variancePercent: 0.0,
      unitPrice: 135000,
      totalPrice: 2025000,
      deliveryTemp: -19.0,
      expiryDate: '2026-09-12',
      sensoryQuality: 'FRESH_PRISTINE',
      packagingCondition: 'INTACT_SEALED',
      status: 'ACCEPTED',
      storageZone: 'FREEZER',
      note: 'Bao bì nguyên vẹn, màu tươi hồng',
    },
  ]);

  const handleAddItemToNewBatch = () => {
    setNewBatchItems([
      ...newBatchItems,
      {
        itemId: `ITEM-NEW-${newBatchItems.length + 1}`,
        itemName: '',
        category: 'VEGETABLES_FRUITS',
        orderedQuantity: 10,
        actualQuantity: 10,
        unit: 'kg',
        variance: 0,
        variancePercent: 0,
        unitPrice: 30000,
        totalPrice: 300000,
        deliveryTemp: 4.0,
        expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        sensoryQuality: 'FRESH_PRISTINE',
        packagingCondition: 'INTACT_SEALED',
        status: 'ACCEPTED',
        storageZone: 'CHILLER',
      },
    ]);
  };

  const handleUpdateNewBatchItem = (index: number, updates: Partial<FoodReceivingItem>) => {
    const updated = [...newBatchItems];
    const current = updated[index];
    const next = { ...current, ...updates };

    // Auto-calculate variance & price
    if ('actualQuantity' in updates || 'orderedQuantity' in updates || 'unitPrice' in updates) {
      const ordered = Number(next.orderedQuantity) || 0;
      const actual = Number(next.actualQuantity) || 0;
      const price = Number(next.unitPrice) || 0;
      next.variance = Number((actual - ordered).toFixed(2));
      next.variancePercent = ordered > 0 ? Number((((actual - ordered) / ordered) * 100).toFixed(2)) : 0;
      next.totalPrice = Math.round(actual * price);
    }

    updated[index] = next;
    setNewBatchItems(updated);
  };

  const handleRemoveItemFromNewBatch = (index: number) => {
    if (newBatchItems.length <= 1) return;
    setNewBatchItems(newBatchItems.filter((_, i) => i !== index));
  };

  // Create Batch Mutation
  const createBatchMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Yêu cầu đăng nhập');
      const matchingVendor = vendors.find((v) => v.id === newBatchVendorId || v.vendorName.toLowerCase() === newBatchVendorName.trim().toLowerCase());
      const finalVendorId = isCustomVendor ? `VND-CUSTOM-${Date.now().toString().slice(-6)}` : (matchingVendor?.id || 'VND-001');
      const finalVendorName = (isCustomVendor ? newBatchVendorName.trim() : (matchingVendor?.vendorName || newBatchVendorName.trim())) || 'Nhà cung cấp mới';

      return createFoodReceivingBatch(actor, {
        vendorId: finalVendorId,
        vendorName: finalVendorName,
        deliveryNoteNumber: newBatchNoteNumber || `PGH-${Date.now().toString().slice(-6)}`,
        vehiclePlate: newBatchPlate || '29C-123.45',
        delivererName: newBatchDeliverer || 'Nguyễn Văn Giao',
        delivererPhone: newBatchDelivererPhone || '0901234567',
        receiverId: actor.actorId || 'STAFF-NUT-007',
        receiverName: `${actor.displayName || 'Nhân viên'} (${actor.actorRole === 'NUTRITIONIST' ? 'Dinh dưỡng' : actor.actorRole})`,
        totalItems: newBatchItems.length,
        overallStatus: newBatchOverallStatus,
        notes: newBatchNotes,
        signatureConfirmed: true,
        items: newBatchItems,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-batches'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setShowNewBatchModal(false);
      // Reset form
      setIsCustomVendor(false);
      setNewBatchVendorName(vendors[0]?.vendorName || '');
      setNewBatchNoteNumber('');
      setNewBatchPlate('');
      setNewBatchDeliverer('');
      setNewBatchNotes('');
    },
  });

  // State for Food Dispatch
  const [dispatchMealType, setDispatchMealType] = useState<'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER'>('LUNCH');
  const [dispatchMenuName, setDispatchMenuName] = useState('Bò hầm củ quả & Canh bí đỏ thịt bằm');
  const [dispatchResidentCount, setDispatchResidentCount] = useState(78);
  const [dispatchItems, setDispatchItems] = useState<Array<{ itemId: string; itemName: string; quantity: number; unit: string }>>([
    { itemId: 'INV-F02', itemName: 'Thịt bò phi lê Úc', quantity: 8.0, unit: 'kg' },
    { itemId: 'INV-F05', itemName: 'Bí đỏ hồ lô hạt sen', quantity: 10.0, unit: 'kg' },
  ]);

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Yêu cầu đăng nhập');
      const mealLabels = {
        BREAKFAST: 'Bữa Sáng',
        LUNCH: 'Bữa Trưa',
        AFTERNOON_SNACK: 'Bữa Xế chiều',
        DINNER: 'Bữa Tối',
      };
      return dispatchFoodForCooking(actor, {
        dispatchDate: new Date().toISOString().split('T')[0],
        mealType: dispatchMealType,
        mealTypeLabel: mealLabels[dispatchMealType],
        menuName: dispatchMenuName,
        residentCount: dispatchResidentCount,
        dispatchedBy: `${actor.displayName || 'Nhân viên'} (Dinh dưỡng)`,
        items: dispatchItems,
        status: 'COOKED',
        notes: 'Đã cân đúng định mức khẩu phần dinh dưỡng dưỡng lão',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setShowDispatchModal(false);
    },
  });

  // State for Food Sample Creation
  const [sampleDishName, setSampleDishName] = useState('');
  const [sampleMealType, setSampleMealType] = useState<'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER'>('LUNCH');
  const [sampleWeight, setSampleWeight] = useState('150g');
  const [sampleContainer, setSampleContainer] = useState('Hộp thủy tinh Borosilicate niêm phong');
  const [sampleLocation, setSampleLocation] = useState('Tủ lưu mẫu số 01 - Ngăn 2');
  const [sampleTemp, setSampleTemp] = useState('+3.8°C');
  const [sampleSensory, setSampleSensory] = useState('Màu sắc tươi, mùi vị đặc trưng thơm ngon, nhiệt độ bảo quản chuẩn y khoa');

  const createSampleMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Yêu cầu đăng nhập');
      const mealLabels = {
        BREAKFAST: 'Bữa Sáng',
        LUNCH: 'Bữa Trưa',
        AFTERNOON_SNACK: 'Bữa Xế chiều',
        DINNER: 'Bữa Tối',
      };
      return createFoodSampleRecord(actor, {
        sampleDate: new Date().toISOString().split('T')[0],
        mealType: sampleMealType,
        mealTypeLabel: `${mealLabels[sampleMealType]} (${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`,
        dishName: sampleDishName,
        sampleWeight,
        containerType: sampleContainer,
        storageLocation: sampleLocation,
        storageTemp: sampleTemp,
        samplerId: actor.actorId || 'STAFF-NUT-007',
        samplerName: `${actor.displayName || 'Nhân viên dinh dưỡng'} (Nhân viên dinh dưỡng)`,
        status: 'ACTIVE_STORAGE',
        sensoryNote: sampleSensory,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-samples'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setShowNewSampleModal(false);
      setSampleDishName('');
    },
  });

  const destroySampleMutation = useMutation({
    mutationFn: async (sampleId: string) => {
      if (!actor) throw new Error('Yêu cầu đăng nhập');
      return destroyFoodSampleRecord(actor, sampleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-samples'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  return (
    <div className="page-container" style={{ padding: '1.25rem 1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.4rem', color: '#166534' }}>
            <span>🥗</span> Quản Lý Bếp Ăn & Tiếp Nhận An Toàn Thực Phẩm
          </h1>
          <p className="page-description" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
            Quy trình tiếp nhận thực phẩm theo hợp đồng, cân đo kiểm đếm đối soát số lượng/khối lượng, đánh giá chất lượng HACCP, phân loại lưu kho và lưu mẫu 24 giờ.
          </p>
        </div>

        {/* Role Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 0.95rem',
            borderRadius: '0.5rem',
            background: isNutritionist ? '#ecfdf5' : '#eff6ff',
            border: `1px solid ${isNutritionist ? '#a7f3d0' : '#bfdbfe'}`,
            fontSize: '0.82rem',
            fontWeight: 700,
            color: isNutritionist ? '#047857' : '#1e40af',
          }}
        >
          <span>{isNutritionist ? '🧑‍🍳' : '🛡️'}</span>
          <span>
            {isNutritionist
              ? 'Vai trò: Nhân viên Dinh dưỡng (Trực tiếp nhận hàng, kiểm đếm & lưu mẫu)'
              : isDirector
              ? 'Vai trò: Ban Giám đốc (Giám sát toàn diện, kiểm toán & đối soát)'
              : 'Vai trò: Quản lý (Theo dõi vận hành & đối soát khối lượng)'}
          </span>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>CHI PHÍ NHẬP THỰC PHẨM (THÁNG)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#166534', margin: '0.2rem 0' }}>
            {metrics.totalMonthCost.toLocaleString('vi-VN')} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>đ</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Đã đối soát {metrics.totalBatches} đợt giao nhận</div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TỶ LỆ ĐẠT CHUẨN HACCP</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', margin: '0.2rem 0' }}>
            {metrics.acceptanceRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#166534' }}>100% nguyên liệu có nguồn gốc rõ ràng</div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TỒN KHO THỰC PHẨM & AN TOÀN</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309', margin: '0.2rem 0' }}>
            {metrics.totalInventoryItems} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>mặt hàng</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: metrics.lowStockItems > 0 ? '#b91c1c' : '#b45309', fontWeight: metrics.lowStockItems > 0 ? 700 : 500 }}>
            {metrics.lowStockItems > 0 ? `⚠️ ${metrics.lowStockItems} mặt hàng dưới mức an toàn` : 'Tất cả đạt định mức an toàn'}
          </div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LƯU MẪU THỨC ĂN 24H (BỘ Y TẾ)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e40af', margin: '0.2rem 0' }}>
            {metrics.activeSamples} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>mẫu đang lưu</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>Tủ chuyên dụng bảo quản +2°C đến +4°C</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '2px' }}>
        <button
          className={`tab-button ${activeTab === 'RECEIVING' ? 'active' : ''}`}
          onClick={() => setActiveTab('RECEIVING')}
          style={{
            padding: '0.6rem 1.1rem',
            fontWeight: 700,
            fontSize: '0.88rem',
            border: 'none',
            borderBottom: activeTab === 'RECEIVING' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'RECEIVING' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'RECEIVING' ? '#166534' : '#64748b',
            cursor: 'pointer',
            borderRadius: '0.4rem 0.4rem 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>🚚</span> 1. Tiếp Nhận & Kiểm Đếm Thực Phẩm
        </button>

        <button
          className={`tab-button ${activeTab === 'INVENTORY' ? 'active' : ''}`}
          onClick={() => setActiveTab('INVENTORY')}
          style={{
            padding: '0.6rem 1.1rem',
            fontWeight: 700,
            fontSize: '0.88rem',
            border: 'none',
            borderBottom: activeTab === 'INVENTORY' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'INVENTORY' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'INVENTORY' ? '#166534' : '#64748b',
            cursor: 'pointer',
            borderRadius: '0.4rem 0.4rem 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>📦</span> 2. Kho Thực Phẩm & Xuất Chế Biến
        </button>

        <button
          className={`tab-button ${activeTab === 'SAMPLES' ? 'active' : ''}`}
          onClick={() => setActiveTab('SAMPLES')}
          style={{
            padding: '0.6rem 1.1rem',
            fontWeight: 700,
            fontSize: '0.88rem',
            border: 'none',
            borderBottom: activeTab === 'SAMPLES' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'SAMPLES' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'SAMPLES' ? '#166534' : '#64748b',
            cursor: 'pointer',
            borderRadius: '0.4rem 0.4rem 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>🍱</span> 3. Sổ Lưu Mẫu Thức Ăn 24 Giờ
        </button>

        <button
          className={`tab-button ${activeTab === 'AUDIT' ? 'active' : ''}`}
          onClick={() => setActiveTab('AUDIT')}
          style={{
            padding: '0.6rem 1.1rem',
            fontWeight: 700,
            fontSize: '0.88rem',
            border: 'none',
            borderBottom: activeTab === 'AUDIT' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'AUDIT' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'AUDIT' ? '#166534' : '#64748b',
            cursor: 'pointer',
            borderRadius: '0.4rem 0.4rem 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>📊</span> 4. Đối Soát Hợp Đồng & Báo Cáo Nhập - Xuất - Tồn
        </button>
      </div>

      {/* TAB 1: TIẾP NHẬN & KIỂM ĐẾM THỰC PHẨM */}
      {activeTab === 'RECEIVING' && (
        <div>
          {/* Controls Bar */}
          <div
            className="card"
            style={{
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                  Nhà cung cấp:
                </label>
                <select
                  className="text-input"
                  style={{ height: '36px', padding: '0 0.6rem', fontSize: '0.84rem' }}
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                >
                  <option value="ALL">-- Tất cả nhà cung cấp --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendorName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                  Kết luận tiếp nhận:
                </label>
                <select
                  className="text-input"
                  style={{ height: '36px', padding: '0 0.6rem', fontSize: '0.84rem' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">-- Tất cả trạng thái --</option>
                  <option value="ACCEPTED">✅ Đạt chuẩn nhập kho</option>
                  <option value="QUARANTINED">⚠️ Tạm cách ly</option>
                  <option value="REJECTED">❌ Từ chối nhận hàng</option>
                </select>
              </div>

              <div style={{ flex: '1', minWidth: '180px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                  Tìm kiếm phiếu giao:
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Tìm theo mã đợt, số phiếu, người nhận..."
                  style={{ height: '36px', padding: '0 0.6rem', width: '100%', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Action button */}
            <button
              className="button-primary"
              onClick={() => setShowNewBatchModal(true)}
              style={{
                background: '#166534',
                color: '#ffffff',
                border: 'none',
                padding: '0.55rem 1.1rem',
                borderRadius: '0.45rem',
                fontWeight: 700,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
              }}
            >
              <span>+</span> Lập Phiếu Tiếp Nhận Thực Phẩm Mới
            </button>
          </div>

          {/* Batches Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Mã Đợt / Giờ Nhận</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Nhà Cung Cấp & Số Phiếu</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Phương Tiện / Người Giao</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Khối Lượng Theo Phiếu</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Cân Thực Tế</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Chênh Lệch $\pm\%$</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Tổng Giá Trị</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Kết Luận Tiếp Nhận</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                        Không tìm thấy đợt tiếp nhận thực phẩm nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => (
                      <tr key={b.batchId} style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{b.batchId}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(b.receivedAt).toLocaleDateString('vi-VN')} {new Date(b.receivedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#166534' }}>{b.vendorName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Số phiếu: <b>{b.deliveryNoteNumber}</b></div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ color: '#0f172a' }}>{b.delivererName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.vehiclePlate}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                          {b.totalOrderedWeight} kg
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {b.totalActualWeight} kg
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.35rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: b.weightVariancePercent === 0 ? '#f1f5f9' : b.weightVariancePercent > 0 ? '#dcfce7' : '#fee2e2',
                              color: b.weightVariancePercent === 0 ? '#475569' : b.weightVariancePercent > 0 ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {b.weightVariancePercent > 0 ? `+${b.weightVariancePercent}%` : `${b.weightVariancePercent}%`}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#166534' }}>
                          {b.totalValue.toLocaleString('vi-VN')} đ
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: b.overallStatus === 'ACCEPTED' ? '#dcfce7' : b.overallStatus === 'QUARANTINED' ? '#fef3c7' : '#fee2e2',
                              color: b.overallStatus === 'ACCEPTED' ? '#15803d' : b.overallStatus === 'QUARANTINED' ? '#b45309' : '#b91c1c',
                            }}
                          >
                            {b.overallStatus === 'ACCEPTED' ? '✅ Đạt chuẩn nhập kho' : b.overallStatus === 'QUARANTINED' ? '⚠️ Tạm cách ly' : '❌ Từ chối nhận hàng'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => setShowDetailBatchModal(b)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.35rem',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: '#1e293b',
                            }}
                          >
                            🔍 Xem Biên Bản
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUẢN LÝ KHO THỰC PHẨM & XUẤT CHẾ BIẾN */}
      {activeTab === 'INVENTORY' && (
        <div>
          {/* Storage Zones Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🧊</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#0284c7', color: '#ffffff', padding: '0.2rem 0.5rem', borderRadius: '0.3rem' }}>
                  -18°C đến -22°C
                </span>
              </div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#0369a1' }}>Kho Đông Sâu (Freezer)</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#0c4a6e' }}>Bảo quản: Thịt heo VietGAP, bò Úc, cá hồi Na Uy, thịt gia cầm</p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 700, color: '#0369a1' }}>
                {inventory.filter((i) => i.storageZone === 'FREEZER').reduce((acc, i) => acc + i.currentStock, 0).toFixed(1)} kg tồn trữ
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🥬</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#16a34a', color: '#ffffff', padding: '0.2rem 0.5rem', borderRadius: '0.3rem' }}>
                  0°C đến +4°C
                </span>
              </div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#15803d' }}>Kho Mát Tươi Sống (Chiller)</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#14532d' }}>Bảo quản: Rau xanh hữu cơ, củ quả Đà Lạt, trứng gà thảo mộc, sữa tươi</p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
                {inventory.filter((i) => i.storageZone === 'CHILLER').length} mặt hàng tươi sống
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🌾</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#d97706', color: '#ffffff', padding: '0.2rem 0.5rem', borderRadius: '0.3rem' }}>
                  +22°C đến +25°C
                </span>
              </div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#b45309' }}>Kho Khô & Gia Vị Dưỡng Lão</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#78350f' }}>Bảo quản: Gạo ST25, yến mạch, dầu oliu, gia vị y tế giảm muối</p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 700, color: '#b45309' }}>
                {inventory.filter((i) => i.storageZone === 'DRY_ROOM').reduce((acc, i) => acc + (i.unit === 'kg' ? i.currentStock : 0), 0)} kg lương thực
              </div>
            </div>
          </div>

          {/* Action Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                className="text-input"
                style={{ height: '36px', padding: '0 0.65rem', fontSize: '0.84rem' }}
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
              >
                <option value="ALL">-- Tất cả khu vực kho --</option>
                <option value="FREEZER">🧊 Kho Đông Sâu (-18°C)</option>
                <option value="CHILLER">🥬 Kho Mát Tươi Sống (0-4°C)</option>
                <option value="DRY_ROOM">📦 Kho Khô & Gia Vị</option>
              </select>

              <select
                className="text-input"
                style={{ height: '36px', padding: '0 0.65rem', fontSize: '0.84rem' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">-- Tất cả nhóm thực phẩm --</option>
                {Object.entries(FOOD_CATEGORY_META).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.icon} {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => downloadKitchenInventoryCSV(filteredInventory)}
                style={{
                  background: '#f0fdf4',
                  color: '#166534',
                  border: '1px solid #86efac',
                  padding: '0.55rem 1rem',
                  borderRadius: '0.45rem',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <span>📥</span> Xuất Báo Cáo Tồn Kho Excel/CSV
              </button>

              <button
                className="button-primary"
                onClick={() => setShowDispatchModal(true)}
                style={{
                  background: '#b45309',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.45rem',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <span>🍳</span> Xuất Kho Nấu Ăn Hàng Ngày
              </button>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Mặt Hàng Thực Phẩm</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Nhóm & Phân Khu Lưu Trữ</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Tồn Thực Tế</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Ngưỡng An Toàn</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Hạn Sử Dụng (FEFO)</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Đơn Giá</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.itemName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>NCC: {item.vendorName}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div>{FOOD_CATEGORY_META[item.category]?.icon} {FOOD_CATEGORY_META[item.category]?.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>
                        {STORAGE_ZONE_META[item.storageZone]?.icon} {STORAGE_ZONE_META[item.storageZone]?.label} ({STORAGE_ZONE_META[item.storageZone]?.tempRange})
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: item.currentStock <= item.minSafetyStock ? '#b91c1c' : '#166534', fontSize: '0.92rem' }}>
                      {item.currentStock} {item.unit}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>
                      {item.minSafetyStock} {item.unit}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ fontWeight: 600 }}>{item.expiryDate}</div>
                      <div style={{ fontSize: '0.74rem', color: item.daysToExpiry <= 3 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
                        {item.daysToExpiry <= 3 ? `⚠️ Còn ${item.daysToExpiry} ngày` : `Còn ${item.daysToExpiry} ngày`}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#475569' }}>
                      {item.unitPrice.toLocaleString('vi-VN')} đ/{item.unit}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.35rem',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          background: item.currentStock <= item.minSafetyStock ? '#fee2e2' : item.daysToExpiry <= 3 ? '#fef3c7' : '#dcfce7',
                          color: item.currentStock <= item.minSafetyStock ? '#b91c1c' : item.daysToExpiry <= 3 ? '#b45309' : '#15803d',
                        }}
                      >
                        {item.currentStock <= item.minSafetyStock ? 'Cần nhập thêm' : item.daysToExpiry <= 3 ? 'Cận Date' : 'Tươi Ngon'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SỔ LƯU MẪU THỨC ĂN 24 GIỜ */}
      {activeTab === 'SAMPLES' && (
        <div>
          {/* HACCP Notice & Action */}
          <div
            className="card"
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '0.65rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 0.3rem 0', color: '#166534', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📜</span> Quy Định Lưu Mẫu Thức Ăn 24 Giờ Theo Chuẩn Bộ Y Tế
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#14532d', lineHeight: '1.5' }}>
                Mỗi bữa ăn (Sáng, Trưa, Xế, Tối) bắt buộc lưu mẫu thức ăn tối thiểu <b>100g</b> (thức ăn đặc) hoặc <b>150ml</b> (thức ăn lỏng) trong hộp kín tiệt trùng tại tủ lạnh chuyên dụng <b>+2°C đến +4°C</b> đủ 24 giờ.
              </p>
            </div>

            <button
              className="button-primary"
              onClick={() => setShowNewSampleModal(true)}
              style={{
                background: '#166534',
                color: '#ffffff',
                border: 'none',
                padding: '0.55rem 1.1rem',
                borderRadius: '0.45rem',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>+</span> Ghi Nhận Mẫu Lưu Bữa Ăn Mới
            </button>
          </div>

          {/* Samples Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Mã Mẫu / Bữa Ăn</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Tên Món Ăn Lưu Mẫu</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Dung Lượng / Dụng Cụ</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Vị Trí Tủ / Nhiệt Độ</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Người Lấy Mẫu</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Thời Gian Lưu (24 Giờ)</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.id}</div>
                      <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>{s.mealTypeLabel}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.dishName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.sensoryNote}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#1e40af' }}>{s.sampleWeight}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.containerType}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div>{s.storageLocation}</div>
                      <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}>Nhiệt độ: {s.storageTemp}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div>{s.samplerName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.samplerId}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontSize: '0.78rem' }}>Lưu: {new Date(s.savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(s.savedAt).toLocaleDateString('vi-VN')})</div>
                      <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Hạn: {new Date(s.retainUntil).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(s.retainUntil).toLocaleDateString('vi-VN')})</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: s.status === 'ACTIVE_STORAGE' ? '#eff6ff' : '#dcfce7',
                          color: s.status === 'ACTIVE_STORAGE' ? '#1e40af' : '#15803d',
                        }}
                      >
                        {s.status === 'ACTIVE_STORAGE' ? '🧊 Đang lưu tủ (+4°C)' : '✅ Đã hủy an toàn'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      {s.status === 'ACTIVE_STORAGE' ? (
                        <button
                          type="button"
                          onClick={() => destroySampleMutation.mutate(s.id)}
                          disabled={destroySampleMutation.isPending}
                          style={{
                            background: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #86efac',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '0.35rem',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                          }}
                          title="Xác nhận đủ 24 giờ và tiến hành hủy mẫu an toàn theo quy định HACCP"
                        >
                          {destroySampleMutation.isPending ? '⏳...' : '✅ Hủy mẫu an toàn (24H)'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Đã hoàn tất lưu 24h</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ĐỐI SOÁT HỢP ĐỒNG & BÁO CÁO NHẬP - XUẤT - TỒN */}
      {activeTab === 'AUDIT' && (
        <div>
          {/* Executive Notice */}
          <div
            className="card"
            style={{
              padding: '1rem',
              marginBottom: '1.25rem',
              background: '#eff6ff',
              border: '1px solid #93c5fd',
              borderRadius: '0.65rem',
              color: '#1e3a8a',
            }}
          >
            <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📊</span> Bảng Báo Cáo Đối Soát Dành Riêng Cho Quản Lý & Ban Giám Đốc
            </h3>
            <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: '1.5' }}>
              Tổng hợp tỷ lệ sai lệch cân nặng thực tế so với hóa đơn theo từng nhà cung cấp, giúp phát hiện hao hụt, trừ tiền thanh toán và phục vụ đối soát định kỳ minh bạch 100%.
            </p>
          </div>

          {/* Vendors Scorecard Table */}
          <div className="card" style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.65rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
              1. Bảng Đánh Giá Nhà Cung Cấp & Sai Lệch Khối Lượng Giao Nhận
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Mã & Tên Nhà Cung Cấp</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Số Hợp Đồng / Mặt Hàng</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Chứng Nhận An Toàn</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Lịch Giao Hàng</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Đánh Giá Uy Tín</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#166534' }}>{v.vendorName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mã: {v.vendorCode} | ĐT: {v.contactPhone}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600 }}>{v.contractNumber}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{v.categoryLabel}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#dcfce7', color: '#15803d', fontWeight: 700, borderRadius: '0.35rem', fontSize: '0.74rem' }}>
                          {v.certification}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {v.deliverySchedule}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#f59e0b', fontWeight: 800 }}>
                        {'★'.repeat(Math.round(v.ratingScore))} <span style={{ color: '#0f172a', fontSize: '0.8rem' }}>({v.ratingScore}/5)</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#ecfdf5', color: '#047857', fontWeight: 700, borderRadius: '0.35rem', fontSize: '0.74rem' }}>
                          Đang hiệu lực
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Cooking Dispatches Table */}
          <div className="card" style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#0f172a' }}>
              2. Nhật Ký Xuất Kho Thực Phẩm Chế Biến Hàng Ngày
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Mã Xuất / Ngày</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Bữa Ăn & Thực Đơn</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Số Suất Ăn</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Nguyên Liệu Xuất Kho</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Người Thực Hiện</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700 }}>{d.id}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.dispatchDate}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#166534' }}>{d.mealTypeLabel}</div>
                        <div style={{ fontSize: '0.78rem', color: '#334155' }}>{d.menuName}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, color: '#1e40af' }}>
                        {d.residentCount} suất
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {d.items.map((i, idx) => (
                          <span key={idx} style={{ display: 'inline-block', background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '0.3rem', fontSize: '0.75rem', marginRight: '0.35rem', marginBottom: '0.2rem' }}>
                            {i.itemName}: <b>{i.quantity} {i.unit}</b>
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{d.dispatchedBy}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#dcfce7', color: '#15803d', fontWeight: 700, borderRadius: '0.35rem', fontSize: '0.74rem' }}>
                          {d.status === 'SERVED' ? 'Đã phục vụ' : 'Đã nấu chín'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LẬP PHIẾU TIẾP NHẬN MỚI */}
      {showNewBatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🚚</span> Lập Phiếu Tiếp Nhận & Kiểm Đếm Thực Phẩm
              </h2>
              <button
                onClick={() => setShowNewBatchModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* General Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Nhà cung cấp:
                </label>
                {!isCustomVendor ? (
                  <select
                    className="text-input"
                    style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                    value={newBatchVendorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'CUSTOM_OPTION') {
                        setIsCustomVendor(true);
                        setNewBatchVendorName('');
                      } else {
                        setNewBatchVendorId(val);
                        const found = vendors.find((v) => v.id === val);
                        if (found) setNewBatchVendorName(found.vendorName);
                      }
                    }}
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendorName} ({v.categoryLabel})
                      </option>
                    ))}
                    <option value="CUSTOM_OPTION" style={{ fontWeight: 600, color: '#166534' }}>
                      ✏️ + Nhập tên nhà cung cấp mới...
                    </option>
                  </select>
                ) : (
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      list="custom-vendor-suggestions"
                      className="text-input"
                      placeholder="Nhập tên nhà cung cấp mới..."
                      style={{ width: '100%', height: '38px', padding: '0 5rem 0 0.6rem', boxSizing: 'border-box' }}
                      value={newBatchVendorName}
                      onChange={(e) => setNewBatchVendorName(e.target.value)}
                      autoFocus
                    />
                    <datalist id="custom-vendor-suggestions">
                      {vendors.map((v) => (
                        <option key={v.id} value={v.vendorName}>
                          {v.categoryLabel}
                        </option>
                      ))}
                    </datalist>
                    <button
                      type="button"
                      title="Quay lại chọn từ danh sách"
                      onClick={() => {
                        setIsCustomVendor(false);
                        setNewBatchVendorId(vendors[0]?.id || 'VND-001');
                        setNewBatchVendorName(vendors[0]?.vendorName || '');
                      }}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '3px 6px',
                        color: '#475569',
                      }}
                    >
                      ↩️ Danh sách
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Số phiếu giao / Hóa đơn:
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="VD: PGH-260902-99"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={newBatchNoteNumber}
                  onChange={(e) => setNewBatchNoteNumber(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Biển số xe giao hàng:
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="VD: 29C-998.12"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={newBatchPlate}
                  onChange={(e) => setNewBatchPlate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Họ tên & SĐT người giao:
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="VD: Nguyễn Văn A - 0988..."
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={newBatchDeliverer}
                  onChange={(e) => setNewBatchDeliverer(e.target.value)}
                />
              </div>
            </div>

            {/* Items List */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a' }}>Danh mục mặt hàng kiểm đếm đối soát:</h3>
                <button
                  type="button"
                  onClick={handleAddItemToNewBatch}
                  style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #86efac',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '0.35rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  + Thêm mặt hàng
                </button>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Tên mặt hàng</th>
                      <th style={{ padding: '0.5rem', width: '90px' }}>Phiếu (kg/đv)</th>
                      <th style={{ padding: '0.5rem', width: '90px' }}>Cân thực tế</th>
                      <th style={{ padding: '0.5rem', width: '70px' }}>Lệch $\pm\%$</th>
                      <th style={{ padding: '0.5rem', width: '95px' }}>Đơn giá (đ)</th>
                      <th style={{ padding: '0.5rem', width: '70px' }}>Nhiệt độ</th>
                      <th style={{ padding: '0.5rem', width: '100px' }}>Hạn dùng</th>
                      <th style={{ padding: '0.5rem', width: '110px' }}>Kho lưu</th>
                      <th style={{ padding: '0.5rem', width: '110px' }}>Kết luận</th>
                      <th style={{ padding: '0.5rem', width: '40px' }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newBatchItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="text"
                            className="text-input"
                            style={{ width: '100%', height: '32px', fontSize: '0.8rem', padding: '0 0.4rem', boxSizing: 'border-box' }}
                            value={item.itemName}
                            placeholder="Tên thực phẩm..."
                            onChange={(e) => handleUpdateNewBatchItem(idx, { itemName: e.target.value })}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="number"
                            step="0.1"
                            className="text-input"
                            style={{ width: '100%', height: '32px', fontSize: '0.8rem', padding: '0 0.4rem', boxSizing: 'border-box' }}
                            value={item.orderedQuantity}
                            onChange={(e) => handleUpdateNewBatchItem(idx, { orderedQuantity: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="number"
                            step="0.1"
                            className="text-input"
                            style={{ width: '100%', height: '32px', fontSize: '0.8rem', padding: '0 0.4rem', boxSizing: 'border-box', fontWeight: 700 }}
                            value={item.actualQuantity}
                            onChange={(e) => handleUpdateNewBatchItem(idx, { actualQuantity: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td style={{ padding: '0.4rem', textAlign: 'center', fontWeight: 700, color: item.variancePercent === 0 ? '#64748b' : item.variancePercent > 0 ? '#15803d' : '#b91c1c' }}>
                          {item.variancePercent > 0 ? `+${item.variancePercent}%` : `${item.variancePercent}%`}
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="number"
                            className="text-input"
                            style={{ width: '100%', height: '32px', fontSize: '0.8rem', padding: '0 0.4rem', boxSizing: 'border-box' }}
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateNewBatchItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="number"
                            step="0.1"
                            className="text-input"
                            style={{ width: '100%', height: '32px', fontSize: '0.8rem', padding: '0 0.4rem', boxSizing: 'border-box' }}
                            value={item.deliveryTemp}
                            onChange={(e) => handleUpdateNewBatchItem(idx, { deliveryTemp: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="date"
                            className="text-input"
                            style={{ width: '100%', height: '32px', fontSize: '0.75rem', padding: '0 0.2rem', boxSizing: 'border-box' }}
                            value={item.expiryDate}
                            onChange={(e) => handleUpdateNewBatchItem(idx, { expiryDate: e.target.value })}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <select
                            className="text-input"
                            style={{ width: '100%', height: '32px', fontSize: '0.75rem', padding: '0 0.2rem', boxSizing: 'border-box' }}
                            value={item.storageZone}
                            onChange={(e) => handleUpdateNewBatchItem(idx, { storageZone: e.target.value as StorageZone })}
                          >
                            <option value="FREEZER">🧊 Đông (-18°C)</option>
                            <option value="CHILLER">🥬 Mát (0-4°C)</option>
                            <option value="DRY_ROOM">📦 Khô</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <select
                            className="text-input"
                            style={{ width: '100%', height: '32px', fontSize: '0.75rem', padding: '0 0.2rem', boxSizing: 'border-box' }}
                            value={item.status}
                            onChange={(e) => handleUpdateNewBatchItem(idx, { status: e.target.value as InspectionStatus })}
                          >
                            <option value="ACCEPTED">✅ Đạt chuẩn nhập kho</option>
                            <option value="QUARANTINED">⚠️ Tạm cách ly</option>
                            <option value="REJECTED">❌ Từ chối nhận hàng</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromNewBatch(idx)}
                            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note & Overall Conclusion */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Ghi chú cảm quan / Đánh giá bao bì & nhiệt độ:
                </label>
                <textarea
                  className="text-input"
                  rows={2}
                  placeholder="Ghi rõ tình trạng thực phẩm, kẹp chì xe lạnh, độ đàn hồi, màu sắc..."
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  value={newBatchNotes}
                  onChange={(e) => setNewBatchNotes(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Kết luận tiếp nhận:
                </label>
                <select
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box', fontWeight: 700 }}
                  value={newBatchOverallStatus}
                  onChange={(e) => setNewBatchOverallStatus(e.target.value as InspectionStatus)}
                >
                  <option value="ACCEPTED">✅ Đạt chuẩn nhập kho</option>
                  <option value="QUARANTINED">⚠️ Tạm cách ly</option>
                  <option value="REJECTED">❌ Từ chối nhận hàng</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowNewBatchModal(false)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => createBatchMutation.mutate()}
                disabled={createBatchMutation.isPending}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  background: '#166534',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {createBatchMutation.isPending ? 'Đang lưu...' : '✓ Xác Nhận Nhập Kho & Ký Biên Bản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XEM CHI TIẾT BIÊN BẢN TIẾP NHẬN */}
      {showDetailBatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #166534', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>VIỆN DƯỠNG LÃO TÂM AN CARE — BỘ PHẬN DINH DƯỠNG & BẾP ĂN</div>
                <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.3rem', color: '#0f172a' }}>BIÊN BẢN TIẾP NHẬN & KIỂM ĐẾM THỰC PHẨM</h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Mã phiếu: <b>{showDetailBatchModal.batchId}</b> | Ngày giờ: {new Date(showDetailBatchModal.receivedAt).toLocaleString('vi-VN')}</div>
              </div>
              <button
                onClick={() => setShowDetailBatchModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div>
                <div>Đơn vị giao hàng: <b>{showDetailBatchModal.vendorName}</b></div>
                <div>Số phiếu giao hàng: <b>{showDetailBatchModal.deliveryNoteNumber}</b></div>
                <div>Phương tiện / Biển số: <b>{showDetailBatchModal.vehiclePlate}</b></div>
                <div>Người giao hàng: <b>{showDetailBatchModal.delivererName} ({showDetailBatchModal.delivererPhone})</b></div>
              </div>
              <div>
                <div>Người nhận (Dinh dưỡng): <b>{showDetailBatchModal.receiverName}</b></div>
                <div>Mã nhân sự: <b>{showDetailBatchModal.receiverId}</b></div>
                <div>Tổng khối lượng phiếu: <b>{showDetailBatchModal.totalOrderedWeight} kg</b> | Cân thực tế: <b>{showDetailBatchModal.totalActualWeight} kg</b></div>
                <div>Chênh lệch: <b style={{ color: showDetailBatchModal.weightVariancePercent < 0 ? '#b91c1c' : '#15803d' }}>{showDetailBatchModal.weightVariancePercent}%</b> | Tổng giá trị: <b>{showDetailBatchModal.totalValue.toLocaleString('vi-VN')} đ</b></div>
                <div style={{ marginTop: '0.25rem' }}>
                  Kết luận tiếp nhận: <b style={{ color: showDetailBatchModal.overallStatus === 'ACCEPTED' ? '#15803d' : showDetailBatchModal.overallStatus === 'QUARANTINED' ? '#b45309' : '#b91c1c' }}>
                    {showDetailBatchModal.overallStatus === 'ACCEPTED' ? '✅ Đạt chuẩn nhập kho' : showDetailBatchModal.overallStatus === 'QUARANTINED' ? '⚠️ Tạm cách ly' : '❌ Từ chối nhận hàng'}
                  </b>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: '#0f172a' }}>Chi tiết kiểm đếm từng mặt hàng:</h3>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Tên Mặt Hàng</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Phiếu Giao</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Cân Thực Tế</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Lệch</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Đơn Giá</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Thành Tiền</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Nhiệt Độ</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Kho Lưu</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Kết Luận Tiếp Nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {showDetailBatchModal.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{item.itemName}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{item.orderedQuantity} {item.unit}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>{item.actualQuantity} {item.unit}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, color: item.variancePercent === 0 ? '#64748b' : item.variancePercent > 0 ? '#15803d' : '#b91c1c' }}>
                        {item.variancePercent > 0 ? `+${item.variancePercent}%` : `${item.variancePercent}%`}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{item.unitPrice.toLocaleString('vi-VN')} đ</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{item.totalPrice.toLocaleString('vi-VN')} đ</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{item.deliveryTemp}°C</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{STORAGE_ZONE_META[item.storageZone]?.label}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '0.35rem', fontSize: '0.74rem', fontWeight: 700, background: item.status === 'ACCEPTED' ? '#dcfce7' : item.status === 'QUARANTINED' ? '#fef3c7' : '#fee2e2', color: item.status === 'ACCEPTED' ? '#15803d' : item.status === 'QUARANTINED' ? '#b45309' : '#b91c1c' }}>
                          {item.status === 'ACCEPTED' ? 'Đạt chuẩn nhập kho' : item.status === 'QUARANTINED' ? 'Tạm cách ly' : 'Từ chối nhận hàng'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Note & Signature Box */}
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.84rem' }}>
              <b>Ghi chú kiểm tra:</b> {showDetailBatchModal.notes || 'Thực phẩm đạt chuẩn chất lượng cảm quan và nhiệt độ bảo quản lạnh.'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN BÊN GIAO HÀNG</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>(Ký và ghi rõ họ tên)</div>
                <div style={{ marginTop: '2.5rem', fontWeight: 600, color: '#0f172a' }}>{showDetailBatchModal.delivererName}</div>
              </div>

              <div>
                <div style={{ fontWeight: 700 }}>NHÂN VIÊN DINH DƯỠNG TIẾP NHẬN</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>(Đã kiểm đếm & ký điện tử)</div>
                <div style={{ marginTop: '2.5rem', fontWeight: 700, color: '#166534' }}>{showDetailBatchModal.receiverName}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🖨️</span> In Biên Bản Tiếp Nhận
              </button>
              <button
                onClick={() => setShowDetailBatchModal(null)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  background: '#166534',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XUẤT KHO NẤU ĂN */}
      {showDispatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: '600px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🍳</span> Xuất Kho Thực Phẩm Chế Biến Bữa Ăn
              </h2>
              <button
                onClick={() => setShowDispatchModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Bữa ăn:
                </label>
                <select
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={dispatchMealType}
                  onChange={(e) => setDispatchMealType(e.target.value as any)}
                >
                  <option value="BREAKFAST">Bữa Sáng</option>
                  <option value="LUNCH">Bữa Trưa</option>
                  <option value="AFTERNOON_SNACK">Bữa Xế chiều</option>
                  <option value="DINNER">Bữa Tối</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Số lượng người cao tuổi (Suất):
                </label>
                <input
                  type="number"
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box', fontWeight: 700 }}
                  value={dispatchResidentCount}
                  onChange={(e) => setDispatchResidentCount(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                Tên thực đơn / Món ăn:
              </label>
              <input
                type="text"
                className="text-input"
                style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                value={dispatchMenuName}
                onChange={(e) => setDispatchMenuName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => dispatchMutation.mutate()}
                disabled={dispatchMutation.isPending}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  background: '#b45309',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {dispatchMutation.isPending ? 'Đang xuất...' : '✓ Xác Nhận Xuất Kho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LƯU MẪU THỨC ĂN 24H */}
      {showNewSampleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: '600px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🍱</span> Ghi Nhận Mẫu Lưu Thức Ăn 24 Giờ (Bộ Y Tế)
              </h2>
              <button
                onClick={() => setShowNewSampleModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Bữa ăn lấy mẫu:
                </label>
                <select
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={sampleMealType}
                  onChange={(e) => setSampleMealType(e.target.value as any)}
                >
                  <option value="BREAKFAST">Bữa Sáng</option>
                  <option value="LUNCH">Bữa Trưa</option>
                  <option value="AFTERNOON_SNACK">Bữa Xế chiều</option>
                  <option value="DINNER">Bữa Tối</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Dung lượng mẫu lưu (từ 100g trở lên):
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box', fontWeight: 700 }}
                  value={sampleWeight}
                  onChange={(e) => setSampleWeight(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                Tên món ăn lấy mẫu:
              </label>
              <input
                type="text"
                className="text-input"
                placeholder="VD: Canh rau ngót thịt bằm, Cháo gà hạt sen..."
                style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                value={sampleDishName}
                onChange={(e) => setSampleDishName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Vị trí ngăn tủ lưu:
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={sampleLocation}
                  onChange={(e) => setSampleLocation(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Nhiệt độ tủ (+2°C đến +4°C):
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box', fontWeight: 700 }}
                  value={sampleTemp}
                  onChange={(e) => setSampleTemp(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                Ghi chú cảm quan mẫu khi lưu:
              </label>
              <textarea
                className="text-input"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                value={sampleSensory}
                onChange={(e) => setSampleSensory(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowNewSampleModal(false)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => createSampleMutation.mutate()}
                disabled={createSampleMutation.isPending || !sampleDishName.trim()}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  background: '#166534',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {createSampleMutation.isPending ? 'Đang lưu...' : '✓ Xác Nhận Lưu Mẫu 24 Giờ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
