import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { listResidents } from '../../api/residents';
import {
  ServiceContract,
  ContractStatus,
  CONTRACT_STATUS_LABEL,
  DEFAULT_PARTY_B,
  DEFAULT_APPENDIX_SERVICES,
  listServiceContracts,
  saveServiceContract,
  deleteServiceContract,
  numberToVietnameseText,
  generateAutoContractCode,
  formatDateDDMMYYYY,
} from '../../api/service-contracts';

export function ServiceContractsPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const isDirectorOrManager =
    actor?.actorRole === 'SUPERVISOR' ||
    actor?.actorRole === 'CARE_MANAGER' ||
    actor?.actorRole === 'ADMIN';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal States
  const [editingContract, setEditingContract] = useState<ServiceContract | null>(null);
  const [viewingContract, setViewingContract] = useState<ServiceContract | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Load contracts
  const contractsQuery = useQuery({
    queryKey: ['service-contracts'],
    queryFn: () => listServiceContracts(actor),
    enabled: Boolean(actor),
  });

  // Load residents for auto-fill
  const residentsQuery = useQuery({
    queryKey: ['residents', 'contracts'],
    queryFn: () => listResidents(actor),
    enabled: Boolean(actor),
  });

  const saveMutation = useMutation({
    mutationFn: (contract: ServiceContract) => saveServiceContract(actor!, contract),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-contracts'] });
      setEditingContract(null);
      alert('✅ Đã lưu Hợp đồng dịch vụ thành công!');
    },
    onError: (err: any) => {
      alert(err.message || 'Không thể lưu hợp đồng');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (contractId: string) => deleteServiceContract(actor!, contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-contracts'] });
      alert('🗑️ Đã xóa hợp đồng thành công!');
    },
  });

  if (!isDirectorOrManager) {
    return (
      <main className="page" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
          <h2>🔒 Quyền Truy Cập Bị Hạn Chế</h2>
          <p>Phân hệ <b>Hợp đồng dịch vụ</b> chỉ dành riêng cho Ban Giám đốc và Nhân viên Quản lý. Vui lòng liên hệ quản trị viên nếu cần cấp quyền.</p>
        </div>
      </main>
    );
  }

  const contracts = contractsQuery.data || [];

  const filteredContracts = contracts.filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.contractCode.toLowerCase().includes(q) ||
      c.partyA.residentName.toLowerCase().includes(q) ||
      c.partyA.relative1Name.toLowerCase().includes(q) ||
      c.partyA.phone1.includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleCreateNew = () => {
    const newId = `ctr-${Date.now()}`;
    const autoCode = generateAutoContractCode(contracts);
    const newContract: ServiceContract = {
      contractId: newId,
      contractCode: autoCode,
      residentId: '',
      status: 'DRAFT',
      signedDate: new Date().toISOString().split('T')[0],
      effectiveDate: new Date().toISOString().split('T')[0],
      partyA: {
        residentName: '',
        residentBirthYear: '',
        residentCccd: '',
        residentAddress: '',
        hasSecondResident: false,
        resident2Name: '',
        resident2BirthYear: '',
        resident2Cccd: '',
        resident2Address: '',
        relative1Name: '',
        relative1BirthYear: '',
        relative1Cccd: '',
        relative1Address: '',
        relative1Relationship: '',
        relative2Name: '',
        relative2BirthYear: '',
        relative2Cccd: '',
        relative2Address: '',
        relative2Relationship: '',
        phone1: '',
        phone2: '',
      },
      partyB: DEFAULT_PARTY_B,
      appendix: {
        healthStatusAtAdmission: '',
        roomType: 'Phòng Đôi',
        bedCode: '',
        baseMonthlyFee: 12000000,
        baseMonthlyFeeText: 'Mười hai triệu đồng',
        additionalServices: DEFAULT_APPENDIX_SERVICES.map(s => ({ ...s })),
        discount: 0,
        discountReason: '',
        totalMonthlyFee: 12000000,
        totalMonthlyFeeText: 'Mười hai triệu đồng',
      },
      depositAmount: 20000000,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setIsNew(true);
    setEditingContract(newContract);
  };

  const handleSelectResidentForAutoFill = (resId: string) => {
    const resData = (residentsQuery.data || []).find((r) => r.resident.residentId === resId);
    if (!resData || !editingContract) return;

    const res = resData.resident;
    const birthYear = res.dateOfBirth ? new Date(res.dateOfBirth).getFullYear().toString() : '';

    setEditingContract((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        residentId: resId,
        partyA: {
          ...prev.partyA,
          residentName: res.displayName,
          residentBirthYear: birthYear,
          residentCccd: `CCCD-${res.residentCode}`,
        },
        appendix: {
          ...prev.appendix,
          roomType: res.room ? `Phòng ${res.room}` : prev.appendix.roomType,
          bedCode: res.bed || prev.appendix.bedCode,
        },
      };
    });
  };

  const handleSelectResident2ForAutoFill = (resId: string) => {
    const resData = (residentsQuery.data || []).find((r) => r.resident.residentId === resId);
    if (!resData || !editingContract) return;

    const res = resData.resident;
    const birthYear = res.dateOfBirth ? new Date(res.dateOfBirth).getFullYear().toString() : '';

    setEditingContract((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        partyA: {
          ...prev.partyA,
          hasSecondResident: true,
          resident2Name: res.displayName,
          resident2BirthYear: birthYear,
          resident2Cccd: `CCCD-${res.residentCode}`,
          resident2Address: prev.partyA.residentAddress || 'Hà Nội',
        },
      };
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSignContract = (contract: ServiceContract) => {
    const today = new Date().toISOString().split('T')[0];
    const updatedContract: ServiceContract = {
      ...contract,
      status: 'ACTIVE',
      signedDate: contract.signedDate || today,
      effectiveDate: contract.effectiveDate || today,
      updatedAt: new Date().toISOString(),
    };
    saveMutation.mutate(updatedContract, {
      onSuccess: () => {
        alert(`🎉 Hợp đồng ${contract.contractCode} đã ký kết thành công và chuyển sang trạng thái "Đang hiệu lực"!`);
        if (viewingContract?.contractId === contract.contractId) {
          setViewingContract(updatedContract);
        }
      },
    });
  };

  return (
    <main className="page">
      {/* Header Action Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={handleCreateNew}
          className="btn btn-primary"
          style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <span>➕</span> Soạn Hợp Đồng Mới
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-box">
          <div className="kpi-title">Tổng số Hợp đồng</div>
          <div className="kpi-number" style={{ color: '#166534' }}>{contracts.length}</div>
          <div className="kpi-desc">Hồ sơ lưu trữ trên hệ thống</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Đang hiệu lực</div>
          <div className="kpi-number" style={{ color: '#15803d' }}>
            {contracts.filter((c) => c.status === 'ACTIVE').length}
          </div>
          <div className="kpi-desc">Hợp đồng an dưỡng chính thức</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Dự thảo / Chờ ký</div>
          <div className="kpi-number" style={{ color: '#b45309' }}>
            {contracts.filter((c) => c.status === 'DRAFT' || c.status === 'SIGNED').length}
          </div>
          <div className="kpi-desc">Đang đàm phán với gia đình</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Tổng Tiền Đặt Cọc Quản Lý</div>
          <div className="kpi-number" style={{ color: '#1e40af' }}>
            {(contracts.filter((c) => c.status === 'ACTIVE').length * 20).toLocaleString()} triệuđ
          </div>
          <div className="kpi-desc">Quy chuẩn 20 triệu/cụ</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <section className="filter-toolbar" style={{ marginBottom: '1.5rem' }}>
        <div className="filter-toolbar-grid">
          <div>
            <label className="form-label">Tìm kiếm nhanh</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nhập số HĐ, tên cụ, tên thân nhân, SĐT..."
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Trạng thái Hợp đồng</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DRAFT">Dự thảo</option>
              <option value="SIGNED">Đã ký kết</option>
              <option value="ACTIVE">Đang hiệu lực</option>
              <option value="TERMINATED">Đã thanh lý</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>
        </div>
      </section>

      {/* Contracts Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.95rem', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📋 Danh Sách Hợp Đồng Dịch Vụ Dưỡng Lão ({filteredContracts.length})</span>
        </div>

        {filteredContracts.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
            Không tìm thấy Hợp đồng dịch vụ nào phù hợp.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#334155' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Số Hợp Đồng</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Người Cao Tuổi (Bên A)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Đại Diện Thân Nhân</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Vị Trí / Mức Phí</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ngày Ký / Hiệu Lực</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Trạng Thái</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((c) => {
                  const statusObj = CONTRACT_STATUS_LABEL[c.status] || { label: c.status, badgeClass: 'badge badge-neutral' };
                  return (
                    <tr key={c.contractId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#0f172a' }}>
                        {c.contractCode}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#166534' }}>{c.partyA.residentName}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Sinh năm: {c.partyA.residentBirthYear || '—'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div><b>{c.partyA.relative1Name || '—'}</b></div>
                        <div style={{ fontSize: '0.78rem', color: '#0284c7' }}>SĐT: {c.partyA.phone1 || '—'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div>{c.appendix.roomType} (Giường {c.appendix.bedCode || '—'})</div>
                        <div style={{ fontWeight: 700, color: '#b45309', fontSize: '0.8rem' }}>
                          {c.appendix.totalMonthlyFee.toLocaleString()} đ/tháng
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                        <div>Ký: {formatDateDDMMYYYY(c.signedDate)}</div>
                        <div>Hiệu lực: {formatDateDDMMYYYY(c.effectiveDate)}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={statusObj.badgeClass}>{statusObj.label}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {c.status === 'DRAFT' && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ background: '#15803d', color: '#ffffff', fontWeight: 700 }}
                              onClick={() => handleSignContract(c)}
                              title="Chuyển hợp đồng từ Dự thảo sang Đang hiệu lực"
                            >
                              ✍️ Đã ký hợp đồng
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => setViewingContract(c)}
                            title="Xem trước văn bản 10 trang & In ấn A4"
                          >
                            👁️ In Hợp Đồng
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setIsNew(false);
                              setEditingContract(c);
                            }}
                            title="Chỉnh sửa nội dung & điều khoản"
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa Hợp đồng ${c.contractCode}?`)) {
                                deleteMutation.mutate(c.contractId);
                              }
                            }}
                            title="Xóa hợp đồng"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL SOẠN THẢO / CHỈNH SỬA HỢP ĐỒNG */}
      {editingContract && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📜</span> {isNew ? 'Soạn Thảo Hợp Đồng Dịch Vụ Mới' : `Chỉnh Sửa Hợp Đồng: ${editingContract.contractCode}`}
              </h2>
              <button type="button" onClick={() => setEditingContract(null)} className="modal-close" title="Đóng cửa sổ" aria-label="Đóng cửa sổ">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(editingContract);
              }}
            >
              {/* Top controls: Resident Auto-Fill */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#166534', marginBottom: '0.35rem' }}>
                  ⚡ Tự động điền dữ liệu từ Hồ Sơ Cư Dân:
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                  value={editingContract.residentId}
                  onChange={(e) => handleSelectResidentForAutoFill(e.target.value)}
                >
                  <option value="">-- Chọn cư dân để tự động lấy thông tin --</option>
                  {(residentsQuery.data || []).map(({ resident }) => (
                    <option key={resident.residentId} value={resident.residentId}>
                      {resident.displayName} ({resident.residentCode}) - Phòng {resident.room || 'Chưa xếp'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">Số Hợp đồng (Tự động) <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ flex: 1 }}
                      value={editingContract.contractCode}
                      onChange={(e) => setEditingContract({ ...editingContract, contractCode: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', flexShrink: 0 }}
                      title="Tự động sinh số hợp đồng"
                      onClick={() => setEditingContract({ ...editingContract, contractCode: generateAutoContractCode(contracts) })}
                    >
                      ⚡ Mới
                    </button>
                  </div>
                </div>
                <div>
                  <label className="form-label">Ngày ký</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={editingContract.signedDate}
                    onChange={(e) => setEditingContract({ ...editingContract, signedDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Trạng thái</label>
                  <select
                    className="form-select"
                    value={editingContract.status}
                    onChange={(e) => setEditingContract({ ...editingContract, status: e.target.value as ContractStatus })}
                  >
                    <option value="DRAFT">Dự thảo</option>
                    <option value="SIGNED">Đã ký kết</option>
                    <option value="ACTIVE">Đang hiệu lực</option>
                    <option value="TERMINATED">Đã thanh lý</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>
              </div>

              {/* Section I: Party A */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#166534' }}>
                  I. THÔNG TIN BÊN SỬ DỤNG DỊCH VỤ (BÊN A)
                </h3>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>Người cao tuổi 1 (*)</div>
                  <label style={{ fontSize: '0.8rem', color: '#166534', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editingContract.partyA.hasSecondResident)}
                      onChange={(e) => {
                        setEditingContract({
                          ...editingContract,
                          partyA: {
                            ...editingContract.partyA,
                            hasSecondResident: e.target.checked,
                          },
                        });
                      }}
                    />
                    👥 Đăng ký gửi cả 2 Ông/Bà (Thêm Cụ 2 đi cùng)
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Họ và tên Cụ 1 (*)"
                    required
                    className="form-input"
                    value={editingContract.partyA.residentName}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, residentName: e.target.value } })}
                  />
                  <input
                    type="text"
                    placeholder="Năm sinh Cụ 1"
                    className="form-input"
                    value={editingContract.partyA.residentBirthYear}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, residentBirthYear: e.target.value } })}
                  />
                  <input
                    type="text"
                    placeholder="Số CCCD Cụ 1"
                    className="form-input"
                    value={editingContract.partyA.residentCccd}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, residentCccd: e.target.value } })}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Địa chỉ thường trú của Cụ"
                  className="form-input"
                  style={{ width: '100%', marginBottom: '0.75rem' }}
                  value={editingContract.partyA.residentAddress}
                  onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, residentAddress: e.target.value } })}
                />

                {/* Optional Second Resident (Cụ 2 đi cùng) */}
                {editingContract.partyA.hasSecondResident && (
                  <div style={{ background: '#f8fafc', border: '1px dashed #166534', borderRadius: '0.375rem', padding: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#166534' }}>👵 / 👴 Người cao tuổi 2 (Cụ thứ hai đi cùng / Vợ-Chồng)</div>
                      <select
                        className="form-select"
                        style={{ fontSize: '0.75rem', width: 'auto', padding: '0.2rem 0.4rem' }}
                        onChange={(e) => handleSelectResident2ForAutoFill(e.target.value)}
                      >
                        <option value="">-- Chọn Cụ 2 từ danh sách --</option>
                        {(residentsQuery.data || []).map(({ resident }) => (
                          <option key={resident.residentId} value={resident.residentId}>
                            {resident.displayName} ({resident.residentCode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Họ và tên Cụ 2"
                        className="form-input"
                        value={editingContract.partyA.resident2Name || ''}
                        onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, resident2Name: e.target.value } })}
                      />
                      <input
                        type="text"
                        placeholder="Năm sinh Cụ 2"
                        className="form-input"
                        value={editingContract.partyA.resident2BirthYear || ''}
                        onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, resident2BirthYear: e.target.value } })}
                      />
                      <input
                        type="text"
                        placeholder="Số CCCD Cụ 2"
                        className="form-input"
                        value={editingContract.partyA.resident2Cccd || ''}
                        onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, resident2Cccd: e.target.value } })}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Địa chỉ thường trú Cụ 2"
                      className="form-input"
                      style={{ width: '100%' }}
                      value={editingContract.partyA.resident2Address || ''}
                      onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, resident2Address: e.target.value } })}
                    />
                  </div>
                )}

                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', marginBottom: '0.4rem' }}>Đại diện Thân nhân 1 (**)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Họ tên Thân nhân 1"
                    className="form-input"
                    value={editingContract.partyA.relative1Name}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, relative1Name: e.target.value } })}
                  />
                  <input
                    type="text"
                    placeholder="Năm sinh"
                    className="form-input"
                    value={editingContract.partyA.relative1BirthYear}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, relative1BirthYear: e.target.value } })}
                  />
                  <input
                    type="text"
                    placeholder="Số CCCD"
                    className="form-input"
                    value={editingContract.partyA.relative1Cccd}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, relative1Cccd: e.target.value } })}
                  />
                  <input
                    type="text"
                    placeholder="Quan hệ (VD: Con trai)"
                    className="form-input"
                    value={editingContract.partyA.relative1Relationship}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, relative1Relationship: e.target.value } })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="SĐT ưu tiên 1 (*)"
                    required
                    className="form-input"
                    value={editingContract.partyA.phone1}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, phone1: e.target.value } })}
                  />
                  <input
                    type="text"
                    placeholder="SĐT ưu tiên 2"
                    className="form-input"
                    value={editingContract.partyA.phone2}
                    onChange={(e) => setEditingContract({ ...editingContract, partyA: { ...editingContract.partyA, phone2: e.target.value } })}
                  />
                </div>
              </div>

              {/* Section: Appendix 01 */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem', background: '#f8fafc' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#166534' }}>
                  PHỤ LỤC 01: BIỂU PHÍ VÀ DANH MỤC CHĂM SÓC
                </h3>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Tình trạng sức khỏe NCT khi tiếp nhận vào Tâm An</label>
                  <textarea
                    rows={2}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="Mô tả chi tiết tình trạng bệnh lý, sa sút trí tuệ, mức độ di chuyển..."
                    value={editingContract.appendix.healthStatusAtAdmission}
                    onChange={(e) => setEditingContract({ ...editingContract, appendix: { ...editingContract.appendix, healthStatusAtAdmission: e.target.value } })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label className="form-label">Loại phòng đăng ký</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingContract.appendix.roomType}
                      onChange={(e) => setEditingContract({ ...editingContract, appendix: { ...editingContract.appendix, roomType: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Mã Giường</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingContract.appendix.bedCode}
                      onChange={(e) => setEditingContract({ ...editingContract, appendix: { ...editingContract.appendix, bedCode: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Phí chăm sóc cơ bản (VNĐ/tháng)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editingContract.appendix.baseMonthlyFee}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        const text = numberToVietnameseText(val);
                        setEditingContract({
                          ...editingContract,
                          appendix: {
                            ...editingContract.appendix,
                            baseMonthlyFee: val,
                            baseMonthlyFeeText: text,
                          },
                        });
                      }}
                    />
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Danh mục dịch vụ chăm sóc bổ sung (Giá tiền để mở - Tự do điều chỉnh giá):</span>
                  <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>💡 Ô nhập giá tự do thay đổi</span>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.375rem', padding: '0.5rem', maxHeight: '280px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                  {editingContract.appendix.additionalServices.map((srv, idx) => (
                    <div key={srv.stt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                      <input
                        type="checkbox"
                        checked={srv.selected}
                        onChange={(e) => {
                          const updated = [...editingContract.appendix.additionalServices];
                          updated[idx].selected = e.target.checked;
                          // Recalculate total
                          const addTotal = updated.filter(s => s.selected).reduce((sum, s) => sum + s.fee, 0);
                          const newTotal = editingContract.appendix.baseMonthlyFee + addTotal - editingContract.appendix.discount;
                          setEditingContract({
                            ...editingContract,
                            appendix: {
                              ...editingContract.appendix,
                              additionalServices: updated,
                              totalMonthlyFee: newTotal,
                              totalMonthlyFeeText: numberToVietnameseText(newTotal),
                            },
                          });
                        }}
                      />
                      <span style={{ fontSize: '0.82rem', flex: 1, fontWeight: srv.selected ? 700 : 400, color: srv.selected ? '#166534' : '#334155' }}>
                        {srv.stt}. {srv.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Đơn giá:</span>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '120px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', fontWeight: 700, color: srv.selected ? '#166534' : '#334155', textAlign: 'right' }}
                          value={srv.fee}
                          onChange={(e) => {
                            const newFee = parseInt(e.target.value, 10) || 0;
                            const updated = [...editingContract.appendix.additionalServices];
                            updated[idx].fee = newFee;
                            const addTotal = updated.filter(s => s.selected).reduce((sum, s) => sum + s.fee, 0);
                            const newTotal = editingContract.appendix.baseMonthlyFee + addTotal - editingContract.appendix.discount;
                            setEditingContract({
                              ...editingContract,
                              appendix: {
                                ...editingContract.appendix,
                                additionalServices: updated,
                                totalMonthlyFee: newTotal,
                                totalMonthlyFeeText: numberToVietnameseText(newTotal),
                              },
                            });
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>đ</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <label className="form-label">Mức giảm trừ / Ưu đãi (VNĐ)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editingContract.appendix.discount}
                      onChange={(e) => {
                        const disc = parseInt(e.target.value, 10) || 0;
                        const addTotal = editingContract.appendix.additionalServices.filter(s => s.selected).reduce((sum, s) => sum + s.fee, 0);
                        const newTotal = editingContract.appendix.baseMonthlyFee + addTotal - disc;
                        setEditingContract({
                          ...editingContract,
                          appendix: {
                            ...editingContract.appendix,
                            discount: disc,
                            totalMonthlyFee: newTotal,
                            totalMonthlyFeeText: numberToVietnameseText(newTotal),
                          },
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="form-label">TỔNG PHÍ THÁNG (ĐÃ TỰ ĐỘNG TÍNH & ĐỌC BẰNG CHỮ):</label>
                    <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.95rem', paddingTop: '0.2rem' }}>
                      {editingContract.appendix.totalMonthlyFee.toLocaleString()} VNĐ/tháng <br />
                      <span style={{ fontStyle: 'italic', fontWeight: 600, color: '#64748b', fontSize: '0.82rem' }}>
                        ({editingContract.appendix.totalMonthlyFeeText})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button type="button" onClick={() => setEditingContract(null)} className="btn btn-secondary">Hủy bỏ</button>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? '⏳ Đang lưu...' : '💾 Lưu Hợp Đồng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XEM TRƯỚC VĂN BẢN HỢP ĐỒNG 10 TRANG & IN ẤN */}
      {viewingContract && (
        <div className="modal-backdrop print-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 15mm 10mm 15mm;
              }

              html, body, #root, .app-shell, main, main.page, .print-modal-overlay, .modal-print-card {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: "Times New Roman", Times, serif !important;
                font-size: 13pt !important;
                line-height: 1.35 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
              }

              /* Hide all background app layout elements completely */
              body > *:not(#root),
              #root > *:not(.app-shell),
              .app-shell > aside,
              .sidebar,
              .navigation,
              .topbar,
              .page-header,
              .no-print,
              button,
              .modal-backdrop:not(.print-modal-overlay),
              .modal-overlay:not(.print-modal-overlay),
              main.page > *:not(.print-modal-overlay) {
                display: none !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
              }

              /* Force print modal backdrop and card containers into normal document flow */
              .print-modal-overlay {
                position: static !important;
                inset: auto !important;
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                display: block !important;
              }

              .modal-print-card {
                position: static !important;
                background: transparent !important;
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                max-height: none !important;
                overflow: visible !important;
                display: block !important;
              }

              .contract-print-document {
                font-family: "Times New Roman", Times, serif !important;
                font-size: 13pt !important;
                line-height: 1.35 !important;
                color: #000000 !important;
                padding: 0 !important;
                margin: 0 !important;
                padding-top: 0 !important;
                margin-top: 0 !important;
                width: 100% !important;
                display: block !important;
              }

              .contract-page-break {
                page-break-before: always !important;
                break-before: page !important;
              }

              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }

              tr {
                page-break-inside: avoid !important;
              }

              th, td {
                border: 1px solid #000000 !important;
                color: #000000 !important;
              }
            }
          `}</style>
          <div className="modal-card modal-print-card" style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '850px', width: '100%', maxHeight: '95vh', overflowY: 'auto', padding: '2rem 2.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            {/* Top Toolbar (Hide during print) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #166534', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 800, color: '#166534', fontSize: '1.1rem' }}>
                📄 Xem Trước Văn Bản Hợp Đồng 10 Trang (Số: {viewingContract.contractCode})
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {viewingContract.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleSignContract(viewingContract)}
                    className="btn"
                    style={{ background: '#15803d', color: '#ffffff', fontWeight: 700 }}
                    title="Chuyển hợp đồng từ Dự thảo sang Đang hiệu lực"
                  >
                    ✍️ Đã ký hợp đồng
                  </button>
                )}
                <button type="button" onClick={handlePrint} className="btn btn-primary" style={{ fontWeight: 700 }}>
                  🖨️ In Hợp Đồng (A4)
                </button>
                <button type="button" onClick={() => setViewingContract(null)} className="btn btn-secondary">
                  Đóng
                </button>
              </div>
            </div>

            {/* PRINT TEMPLATE CONTENT (100% exact text, Times New Roman, A4 format) */}
            <div className="contract-print-document" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '13pt', lineHeight: '1.35', color: '#000000', padding: '0 5px' }}>
              
              {/* PAGE 1 HEADER (2-Column Balanced Standard Layout) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                <div style={{ textAlign: 'center', width: '48%' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '10pt', textTransform: 'uppercase', lineHeight: '1.25' }}>
                    CÔNG TY CỔ PHẦN THƯƠNG MẠI DỊCH VỤ
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '10.5pt', textTransform: 'uppercase', lineHeight: '1.25', marginTop: '1px' }}>
                    AN THỊNH PHÁT GROUP
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', marginTop: '3px' }}>
                    TRUNG TÂM DƯỠNG LÃO TÂM AN
                  </div>
                  <div style={{ fontSize: '10pt', marginTop: '2px', letterSpacing: '-1px' }}>------------------</div>
                </div>

                <div style={{ textAlign: 'center', width: '48%' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '12pt', lineHeight: '1.25' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11pt', marginTop: '3px' }}>Độc lập - Tự do - Hạnh phúc</div>
                  <div style={{ fontSize: '10pt', marginTop: '2px', letterSpacing: '-1px' }}>------------------</div>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '16px 0 14px 0' }}>
                <h2 style={{ margin: 0, fontSize: '15pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.3px' }}>HỢP ĐỒNG CUNG CẤP DỊCH VỤ DƯỠNG LÃO</h2>
                <div style={{ fontStyle: 'italic', fontSize: '12pt', marginTop: '4px' }}>
                  (Số: {viewingContract.contractCode})
                </div>
              </div>

              <div style={{ fontStyle: 'italic', marginBottom: '12px' }}>
                - Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;<br />
                - Căn cứ Luật Người cao tuổi số 39/2009/QH12 ngày 23/11/2009 và các văn bản hướng dẫn thi hành hiện hành;<br />
                - Căn cứ vào năng lực và nhu cầu của hai bên;<br />
                Hôm nay, ngày {formatDateDDMMYYYY(viewingContract.signedDate, '..... tháng ..... năm 2026')}, chúng tôi gồm các bên dưới đây:
              </div>

              {/* PART I: PARTY A */}
              <div style={{ fontWeight: 'bold', margin: '10px 0 5px 0' }}>I. BÊN SỬ DỤNG DỊCH VỤ (BÊN A):</div>
              <div>Người cao tuổi 1 (*): <b>{viewingContract.partyA.residentName || '...................................................'}</b></div>
              <div>Sinh năm: {viewingContract.partyA.residentBirthYear || '............'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CCCD: {viewingContract.partyA.residentCccd || '....................................'}</div>
              <div>Địa chỉ thường trú: {viewingContract.partyA.residentAddress || '...................................................................................................................................'}</div>

              {(viewingContract.partyA.hasSecondResident || viewingContract.partyA.resident2Name) && (
                <div style={{ marginTop: '6px' }}>
                  <div>Và Người cao tuổi 2 (gửi cùng / Vợ-Chồng): <b>{viewingContract.partyA.resident2Name || '...................................................'}</b></div>
                  <div>Sinh năm: {viewingContract.partyA.resident2BirthYear || '............'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CCCD: {viewingContract.partyA.resident2Cccd || '....................................'}</div>
                  <div>Địa chỉ thường trú: {viewingContract.partyA.resident2Address || viewingContract.partyA.residentAddress || '...................................................................................................................................'}</div>
                </div>
              )}

              <div style={{ marginTop: '8px' }}>Và Ông/Bà (**): <b>{viewingContract.partyA.relative1Name || '...................................................'}</b></div>
              <div>Sinh năm: {viewingContract.partyA.relative1BirthYear || '............'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CCCD: {viewingContract.partyA.relative1Cccd || '....................................'}</div>
              <div>Địa chỉ thường trú: {viewingContract.partyA.relative1Address || '...................................................................................................................................'}</div>
              <div>Quan hệ với người cao tuổi: {viewingContract.partyA.relative1Relationship || '...................................................'}</div>

              <div style={{ marginTop: '8px' }}>Và Ông/Bà (***): <b>{viewingContract.partyA.relative2Name || '...................................................'}</b></div>
              <div>Sinh năm: {viewingContract.partyA.relative2BirthYear || '............'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CCCD: {viewingContract.partyA.relative2Cccd || '....................................'}</div>
              <div>Địa chỉ thường trú: {viewingContract.partyA.relative2Address || '...................................................................................................................................'}</div>
              <div>Quan hệ với người cao tuổi: {viewingContract.partyA.relative2Relationship || '...................................................'}</div>
              <div>
                Ông/Bà (**) {viewingContract.partyA.relative1Name || '.......................................'} và Ông/Bà (***) {viewingContract.partyA.relative2Name || '.......................................'} là người có đầy đủ tư cách pháp lý về quyền và nghĩa vụ phụng dưỡng Người cao tuổi (*);
              </div>
              <div>Số điện thoại ưu tiên 1: <b>{viewingContract.partyA.phone1 || '...................................'}</b></div>
              <div>Số điện thoại ưu tiên 2: <b>{viewingContract.partyA.phone2 || '...................................'}</b></div>

              {/* PART II: PARTY B */}
              <div style={{ fontWeight: 'bold', margin: '12px 0 5px 0' }}>II. BÊN CUNG CẤP DỊCH VỤ (BÊN B):</div>
              <div><b>TÊN ĐƠN VỊ: {viewingContract.partyB.companyName}</b></div>
              <div>Địa chỉ: {viewingContract.partyB.address}</div>
              <div>Mã số thuế: {viewingContract.partyB.taxCode}</div>
              <div>Điện thoại: {viewingContract.partyB.phone}</div>
              <div>Đại diện Bà: <b>{viewingContract.partyB.representativeName}</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: <b>{viewingContract.partyB.representativeTitle}</b></div>
              <div>Tài khoản số: {viewingContract.partyB.bankAccount} - {viewingContract.partyB.bankName}</div>
              <div>Đơn vị chăm sóc: {viewingContract.partyB.centerName}</div>
              <div>Địa chỉ: {viewingContract.partyB.centerAddress}</div>

              <div style={{ margin: '10px 0', fontStyle: 'italic' }}>
                Sau khi bàn bạc và thống nhất, hai Bên thỏa thuận ký kết Hợp đồng dịch vụ chăm sóc Người cao tuổi với các nội dung sau:
              </div>

              {/* ARTICLES 1 - 9 EXACT LEGAL TEXT */}
              <div style={{ textAlign: 'justify' }}>
                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 1. Quy định chung:</div>
                <div style={{ fontWeight: 'bold' }}>1.1. Giải thích thuật ngữ</div>
                <div>Trong Hợp đồng này, các thuật ngữ dưới đây được hiểu như sau:</div>
                <div>• <b>"Trung tâm"</b> hoặc <b>"Trung tâm dưỡng lão Tâm An"</b> là đơn vị trực thuộc Công ty Cổ phần Thương mại dịch vụ An Thịnh Phát Group, có chức năng cung cấp dịch vụ chăm sóc, nuôi dưỡng và hỗ trợ sinh hoạt cho Người cao tuổi theo phạm vi hoạt động và nội dung của Hợp đồng này.</div>
                <div>• <b>"Bên B"</b> là Công ty cổ phần Thương mại dịch vụ An Thịnh Phát Group, đơn vị trực tiếp quản lý và vận hành Trung tâm dưỡng lão Tâm An, cung cấp dịch vụ chăm sóc Người cao tuổi theo hợp đồng này.</div>
                <div>• <b>"Bên A"</b> là cá nhân hoặc tổ chức ký kết hợp đồng với Trung tâm, có nghĩa vụ và quyền phụng dưỡng Người cao tuổi theo quy định pháp luật và là bên có trách nhiệm thực hiện các nghĩa vụ trong Hợp đồng.</div>
                <div>• <b>"Người cao tuổi" (NCT)</b> là cá nhân được Bên A đăng ký sử dụng dịch vụ chăm sóc tại Trung tâm và là đối tượng trực tiếp được Bên B cung cấp dịch vụ.</div>
                <div>• <b>"Phụ lục hợp đồng"</b> là văn bản không thể tách rời của Hợp đồng này, quy định chi tiết gói dịch vụ, mức phí, chế độ chăm sóc, danh mục dịch vụ bổ sung và các nội dung khác do các bên thống nhất.</div>

                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>1.2. Giới hạn chuyên môn:</div>
                <div>Trung tâm dưỡng lão Tâm An là đơn vị cung cấp dịch vụ chăm sóc, hỗ trợ sinh hoạt, phục hồi chức năng cơ bản, theo dõi sức khỏe thường quy và tổ chức đời sống an dưỡng cho NCT. Trung tâm không phải là cơ sở y tế, không cung cấp các dịch vụ y tế liên quan đến khám bệnh, chẩn đoán bệnh hoặc điều trị bệnh. Các ý kiến tư vấn từ nhân viên y tế, điều dưỡng tại Trung tâm mang tính chất hỗ trợ và tham khảo thông tin. Các hoạt động theo dõi sức khỏe, hỗ trợ sử dụng thuốc, chăm sóc hàng ngày chỉ được thực hiện trong phạm vi chức năng của Trung tâm theo hướng dẫn của cơ sở khám chữa bệnh hoặc của người đại diện hợp pháp của NCT.</div>

                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>1.3. Rủi ro sức khỏe:</div>
                <div>Bên A hiểu rằng Người cao tuổi có nhiều rủi ro về bệnh tật tuổi già. Việc lưu trú, an dưỡng tại Trung tâm dưỡng lão Tâm An không đồng nghĩa loại trừ hoàn toàn các rủi ro phát bệnh tự nhiên. Trong trường hợp Bên B đã thực hiện đầy đủ trách nhiệm chăm sóc theo Hợp đồng, quy trình chuyên môn nội bộ và nghĩa vụ theo quy định của pháp luật, thì Bên A đồng ý rằng các trường hợp sức khỏe NCT suy giảm do: diễn tiến tự nhiên của tuổi già; diễn tiến của bệnh nền hoặc bệnh mạn tính; các biến cố sức khỏe không thể dự báo trước; hoặc các rủi ro từ hành vi tự phát của NCT mà Bên B không thể kiểm soát hoặc ngăn chặn bằng các biện pháp chăm sóc hợp lý, sẽ không được xem là hành vi vi phạm nghĩa vụ của Bên B và không làm phát sinh trách nhiệm bồi thường của Bên B.</div>

                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>1.4. Sự kiện bất khả kháng tuổi già:</div>
                <div>Bên A hiểu và đồng ý rằng, đối với người cao tuổi, các biến cố sức khỏe nghiêm trọng như đột quỵ, nhồi máu cơ tim, ngừng tuần hoàn, suy đa tạng, thuyên tắc mạch, xuất huyết脑 hoặc các diễn tiến đột ngột của bệnh nền có thể xảy ra bất kỳ thời điểm nào mà không có dấu hiệu báo trước không thể dự báo, phòng ngừa tuyệt đối bằng các biện pháp chăm sóc thông thường. Khi các biến cố này xảy ra dù Bên B đã thực hiện đúng quy trình chăm sóc, theo dõi thông thường, thì được coi là trường hợp Bất khả kháng. Bên B được miễn trừ toàn bộ trách nhiệm liên quan đến sự suy giảm sức khỏe hoặc tử vong của NCT do các nguyên nhân tự nhiên này.</div>

                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 2. Nội dung, thời gian, địa điểm cung cấp dịch vụ</div>
                <div style={{ fontWeight: 'bold' }}>2.1. Tiếp nhận chăm sóc</div>
                <div>
                  Bên A tự nguyện giao cho Bên B chăm sóc và Bên B đồng ý tiếp nhận chăm sóc Người cao tuổi (*): <b>{viewingContract.partyA.residentName || '..................................................'}</b>, sinh năm {viewingContract.partyA.residentBirthYear || '............'}
                  {viewingContract.partyA.resident2Name ? (
                    <> và Người cao tuổi thứ hai: <b>{viewingContract.partyA.resident2Name}</b>, sinh năm {viewingContract.partyA.resident2BirthYear || '............'}</>
                  ) : null}. Vào an dưỡng tại Trung tâm dưỡng lão Tâm An theo các nội dung dịch vụ được quy định tại hợp đồng này và phụ lục kèm theo hợp đồng này kể từ ngày <b>{formatDateDDMMYYYY(viewingContract.effectiveDate)}</b>.
                </div>
                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>2.2. Địa điểm cung cấp dịch vụ</div>
                <div>Dịch vụ được cung cấp tại: <b>Trung tâm dưỡng lão Tâm An</b></div>
                <div>Trực thuộc <b>Công ty Cổ phần Thương mại Dịch vụ An Thịnh Phát Group</b></div>
                <div>Địa chỉ: Khu Phố Đông 8, Khu đô thị Vinhomes Ocean Park 2, xã Nghĩa Trụ, tỉnh Hưng Yên.</div>

                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 3. Chế độ chăm sóc NCT tại Trung tâm</div>
                <div>NCT được chăm sóc theo các chế độ tiêu chuẩn quy định dưới đây:</div>
                <div style={{ fontWeight: 'bold' }}>3.1. Dịch vụ chăm sóc cơ bản bao gồm:</div>
                <div>- <b>Chỗ ở:</b> Cung cấp giường ngủ, tủ đồ cá nhân, tivi, điều hòa nhiệt độ hai chiều, hệ thống vệ sinh khép kín có nước nóng lạnh, hệ thống chuông báo y tế, hệ thống tay vịn an toàn, sàn chống trơn trượt. Toàn bộ các phòng ở đều có ánh sáng tự nhiên thoáng mát.</div>
                <div>- <b>Chế độ dinh dưỡng:</b> Đối với NCT ăn bằng đường miệng: Cung cấp các bữa ăn chính (sáng, trưa, tối) và bữa phụ, thực đơn phù hợp dinh dưỡng với Người cao tuổi hoặc theo bệnh lý riêng biệt nếu có. Đối với NCT ăn bằng đường Sonde - cung cấp 6 bữa ăn chính.</div>
                <div>- <b>Theo dõi sức khỏe thường quy:</b> Theo dõi các chỉ số sinh tồn hàng ngày theo tình trạng sức khỏe và kế hoạch chăm sóc của từng NCT; Quan sát, ghi nhận những thay đổi bất thường trong sinh hoạt hoặc sức khỏe; Hỗ trợ dùng thuốc theo đơn và hướng dẫn của cơ sở khám bệnh, chữa bệnh hoặc người đại diện hợp pháp; Thông báo kịp thời cho Bên A khi phát hiện dấu hiệu bất thường cần theo dõi hoặc chuyển khám, điều trị.</div>
                <div>- <b>Chăm sóc tinh thần và phục hồi chức năng:</b> Tham gia các hoạt động sinh hoạt tập thể, phục hồi chức năng cơ bản, đọc sách, đi dạo tại khuôn viên, giao lưu cộng đồng và các hoạt động khác theo kế hoạch của Trung tâm.</div>
                <div>- <b>Dịch vụ tiện ích:</b> Giặt giũ trang phục, vệ sinh phòng ở định kỳ, cung cấp vật tư tiêu hao thiết yếu (khăn mặt, bàn chải, kem đánh răng, dầu gội...). Mua hộ các vật tư quan trọng trong quá trình NCT ở tại Trung tâm do gia đình đề xuất.</div>
                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>3.2. Dịch vụ hỗ trợ tăng cường:</div>
                <div>Các dịch vụ hỗ trợ đặc biệt khác (phụ thuộc vào tình trạng sức khỏe cụ thể của từng NCT) được Bên A đăng ký chi tiết tại <i>Phụ lục hợp đồng</i>. Bên B không có trách nhiệm thực hiện các hạng mục Bên A không đăng ký.</div>
                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>3.3. Tình huống khẩn cấp:</div>
                <div>Trong trường hợp khẩn cấp để đe dọa an toàn hoặc tính mạng của NCT, Bên B có quyền chủ động sử dụng các biện pháp cần thiết: gọi cấp cứu 115, đưa đến cơ sở y tế gần nhất, phối hợp với gia đình, cơ sở y tế để đảm bảo an toàn cao nhất cho NCT.</div>

                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 4. Phí dịch vụ và các điều khoản thanh toán</div>
                <div style={{ fontWeight: 'bold' }}>4.1. Phí dịch vụ</div>
                <div>Mức phí dịch vụ chăm sóc cơ bản, phí các dịch vụ hỗ trợ tăng cường, các khoản chi phí phát sinh (nếu có), thời điểm thanh toán và các nội dung liên quan được quy định chi tiết tại Phụ lục hợp đồng là một phần không tách rời của Hợp đồng này.</div>
                <div>Mức phí có thể được điều chỉnh theo chính sách của Bên B hoặc theo yêu cầu thay đổi về chế độ chăm sóc của Bên A. Trong trường hợp có điều chỉnh, Bên B có trách nhiệm thông báo bằng văn bản hoặc hình thức điện tử cho Bên A trước ít nhất 30 (ba mươi) ngày, trừ trường hợp hai bên có thỏa thuận khác.</div>

                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>4.2. Tiền đặt cọc</div>
                <div>- Khi ký Hợp đồng, Bên A có trách nhiệm đặt cọc cho Bên B một khoản đảm bảo trị giá <b>20.000.000 đồng (hai mươi triệu đồng)</b>.</div>
                <div>- Trường hợp Bên A chậm thanh toán phí dịch vụ quá 30 (ba mươi) ngày kể từ ngày đến hạn, Bên B có quyền chủ động khấu trừ khoản nợ từ tiền đặt cọc mà không cần có sự chấp thuận bổ sung của Bên A. Việc khấu trừ này không làm chấm dứt nghĩa vụ thanh toán đầy đủ của Bên A.</div>
                <div>- Sau khi khấu trừ tiền đặt cọc, Bên A có trách nhiệm hoàn lại số tiền đặt cọc về đúng mức quy định trong vòng 07 (bảy) ngày làm việc kể từ ngày nhận được thông báo của Bên B.</div>
                <div>- Sau khi Hợp đồng được thanh lý và Bên A đã hoàn thành toàn bộ nghĩa vụ tài chính, Bên B hoàn trả phần tiền đặt cọc còn lại (nếu có) cho Bên A trong thời hạn 07 (bảy) ngày làm việc.</div>

                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>4.3. Phương thức thanh toán</div>
                <div>Bên A thanh toán phí dịch vụ đã thỏa thuận bằng hình thức chuyển khoản vào tài khoản của Bên B như sau:</div>
                <div><b>Đơn vị hưởng:</b> {viewingContract.partyB.companyName}</div>
                <div><b>Số tài khoản:</b> {viewingContract.partyB.bankAccount}</div>
                <div><b>Ngân hàng:</b> {viewingContract.partyB.bankName}</div>
                <div>Ngày thanh toán được xác định là ngày số tiền được ghi Có vào tài khoản của Bên B.</div>

                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>4.4. Chậm thanh toán</div>
                <div>Bên A có trách nhiệm thanh toán đầy đủ và đúng thời hạn theo Hợp đồng.</div>
                <div>Trường hợp kết quả thời hạn thanh toán mà Bên A chưa thanh toán hoặc thanh toán không đầy đủ, Bên B có quyền:</div>
                <div>a) Gửi thông báo yêu cầu thanh toán cho Bên A;</div>
                <div>b) Tạm dừng cung cấp các dịch vụ phát sinh ngoài gói chăm sóc cơ bản hoặc các dịch vụ hỗ trợ tăng cường chưa thanh toán (nếu có), nhưng vẫn bảo đảm các nhu cầu chăm sóc thiết yếu và an toàn của NCT;</div>
                <div>c) Khấu trừ khoản nợ từ tiền đặt cọc theo quy định tại Điều 4.2;</div>
                <div>d) Trường hợp Bên A chậm thanh toán quá 60 (sáu mươi) ngày kể từ ngày đến hạn và không khắc phục sau khi đã được Bên B thông báo, Bên B có quyền đơn phương chấm dứt Hợp đồng theo quy định tại Điều 9 của Hợp đồng sau khi đã thông báo trước cho Bên A ít nhất 07 (bảy) ngày.</div>
                <div>Bên A vẫn có trách nhiệm thanh toán đầy đủ các khoản phí dịch vụ và chi phí phát sinh đến thời điểm Hợp đồng chấm dứt.</div>

                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 5. Quyền và nghĩa vụ của Bên A</div>
                <div style={{ fontWeight: 'bold' }}>5.1. Quyền của Bên A</div>
                <div>a) Bên A có quyền yêu cầu Bên B thực hiện đầy đủ, đúng chất lượng các cam kết chăm sóc theo các điều khoản đã thỏa thuận trong hợp đồng.</div>
                <div>b) Bên A có quyền yêu cầu Bên B cung cấp thông tin về tình trạng sức khỏe, sinh hoạt và các diễn biến bất thường của (NCT) theo chế độ thông tin của Trung tâm hoặc khi có sự kiện cần thông báo khẩn cấp.</div>
                <div>c) Bên A có quyền yêu cầu Bên B thực hiện đầy đủ, đúng phạm vi, chất lượng và tiêu chuẩn các dịch vụ chăm sóc theo Hợp đồng, Phụ lục hợp đồng và các quy định của Trung tâm.</div>
                <div>d) Trong thời hạn 05 (năm) ngày kể từ ngày Hợp đồng có hiệu lực, Bên A có quyền đơn phương chấm dứt Hợp đồng mà không phải chịu phạt vi phạm. Sau thời gian trên, Bên A có quyền chấm dứt hợp đồng khi thông báo trước ít nhất ba mươi (30) ngày với điều kiện thanh toán đầy đủ các khoản phí dịch vụ và chi phí thực tế đã phát sinh đến thời điểm chấm dứt Hợp đồng.</div>
                <div>e) Được quyền thăm gặp, liên hệ và chăm sóc NCT theo thời gian, quy định và nội quy của Trung tâm, bảo đảm không ảnh hưởng đến việc chăm sóc, điều trị, nghỉ ngơi của NCT và hoạt động chung của Trung tâm.</div>

                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>5.2. Nghĩa vụ của Bên A</div>
                <div>a) Cung cấp đầy đủ, trung thực và chính xác thông tin cá nhân, tình trạng sức khỏe, hồ sơ bệnh án, thuốc đang sử dụng, các giấy tờ chứng minh quyền đại diện và nghĩa vụ nuôi dưỡng Người cao tuổi.</div>
                <div>b) Khai báo trung thực, đầy đủ tiền sử bệnh lý, bệnh nền, bệnh truyền nhiễm, tình trạng tinh thần, sa sút trí tuệ, dị ứng thuốc, tiền sử té ngã, hành vi nguy cơ hoặc các thông tin khác có ảnh hưởng đến việc chăm sóc NCT.</div>
                <div>Trường hợp Bên A cố ý che giấu, khai báo không trung thực hoặc không đầy đủ làm ảnh hưởng đến việc chăm sóc, gây thiệt hại cho NCT, người khác hoặc Trung tâm, Bên A phải chịu mọi trách nhiệm và bồi thường toàn bộ thiệt hại phát sinh theo quy định của pháp luật.</div>
                <div>Đối với trường hợp NCT mắc bệnh truyền nhiễm thuộc nhóm phải cách ly hoặc không phù hợp điều kiện tiếp nhận của Trung tâm mà Bên A cố ý che giấu, Bên B có quyền từ chối tiếp nhận hoặc đơn phương chấm dứt Hợp đồng và yêu cầu Bên A thanh toán toàn bộ chi phí phát sinh (nếu có).</div>
                <div>c) Kê khai và bàn giao đầy đủ hồ sơ, thuốc, tư trang, đồ dùng cá nhân cho nhân viên tiếp đón của Trung tâm dưỡng lão Tâm An khi làm thủ tục tiếp nhận.</div>
                <div>d) Không giao cho NCT quản lý mang theo tiền mặt, vàng, đá quý, giấy tờ hoặc tài sản có giá trị khác. Trung tâm không chịu trách nhiệm đối với tài sản không được kê khai, bàn giao.</div>
                <div>đ) Thanh toán đầy đủ, đúng thời hạn toàn bộ phí dịch vụ và các chi phí phát sinh theo Hợp đồng.</div>
                <div>e) Duy trì ít nhất một người đại diện hợp pháp hoặc người liên hệ khẩn cấp có thể liên lạc 24/24. Khi nhận được thông báo về tình trạng khẩn cấp hoặc các vấn đề quan trọng liên quan đến NCT, Bên A có trách nhiệm phối hợp với Bên B trong thời gian sớm nhất. Trường hợp NCT tử vong, Bên A hoặc người được ủy quyền có trách nhiệm đến Trung tâm hoặc cơ sở y tế theo hướng dẫn của Bên B trong thời gian sớm nhất để thực hiện các thủ tục theo quy định của pháp luật.</div>

                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 6. Quyền và nghĩa vụ của Bên B</div>
                <div style={{ fontWeight: 'bold' }}>6.1. Quyền của Bên B</div>
                <div>a) Yêu cầu Bên A và NCT tuân thủ Hợp đồng, Nội quy, Quy chế và các quy trình chăm sóc của Trung tâm.</div>
                <div>b) Đề xuất thay đổi dịch vụ, chế độ chăm sóc hoặc chuyển đến cơ sở y tế phù hợp khi tình trạng sức khỏe của NCT có sự thay đổi đáng kể so với thời điểm ký Hợp đồng. Trường hợp Bên A không chấp thuận đề xuất phù hợp của Bên B, Bên B được miễn trách nhiệm đối với các hậu quả phát sinh từ việc không điều chỉnh này.</div>
                <div>c) Yêu cầu Bên A cung cấp đầy đủ, trung thực các thông tin về tình trạng sức khỏe, bệnh lý, tiền sử bệnh, thuốc đang sử dụng và các thông tin cần thiết khác của NCT để phục vụ công tác chăm sóc.</div>
                <div>d) Từ chối tiếp nhận hoặc tạm ngừng cung cấp dịch vụ đối với NCT khi phát hiện mắc bệnh truyền nhiễm nguy hiểm, có hành vi gây nguy hiểm cho bản thân hoặc người khác, hoặc trường hợp vượt quá khả năng chuyên môn, điều kiện chăm sóc của Trung tâm.</div>
                <div>đ) Đơn phương chấm dứt Hợp đồng khi Bên A vi phạm nghĩa vụ thanh toán, cố ý cung cấp thông tin sai sự thật, vi phạm nghiêm trọng Nội quy của Trung tâm hoặc có hành vi cản trở, xúc phạm, đe dọa nhân viên Trung tâm sau khi đã được nhắc nhở bằng văn bản nhưng không khắc phục.</div>
                <div>e) Yêu cầu Bên A thanh toán đầy đủ các khoản phí dịch vụ, chi phí phát sinh theo Hợp đồng và bồi thường thiệt hại (nếu có) do lỗi của Bên A hoặc NCT gây ra theo quy định của pháp luật.</div>

                <div style={{ fontWeight: 'bold', marginTop: '6px' }}>6.2. Nghĩa vụ của Bên B</div>
                <div>a) Thực hiện đầy đủ, đúng chất lượng các dịch vụ chăm sóc đã cam kết tại Hợp đồng và các Phụ lục kèm theo.</div>
                <div>b) Bố trí nhân sự đủ chuyên môn; theo dõi, chăm sóc NCT theo đúng quy trình của Trung tâm; bảo đảm môi trường sống an toàn, vệ sinh và tôn trọng nhân phẩm, quyền riêng tư của NCT.</div>
                <div>c) Thông báo kịp thời cho Bên A khi NCT có diễn biến bất thường về sức khỏe. Trường hợp khẩn cấp không liên lạc được với người đại diện của Bên A, Bên B được quyền chủ động đưa NCT đến cơ sở y tế gần nhất để cấp cứu; mọi chi phí phát sinh do Bên A thanh toán.</div>
                <div>d) Cập nhật thông tin về tình trạng sức khỏe, sinh hoạt của NCT cho Bên A theo định kỳ hoặc khi có sự việc cần thông báo; bảo mật thông tin cá nhân và hồ sơ của NCT theo quy định của pháp luật.</div>
                <div>đ) Quản lý, lưu giữ hồ sơ sức khỏe; phối hợp với Bên A và cơ sở y tế trong quá trình chăm sóc, điều trị và các vấn đề phát sinh liên quan đến NCT.</div>
                <div>e) Thực hiện việc chăm sóc trong phạm vi dịch vụ đã cam kết; không chịu trách nhiệm đối với các rủi ro sức khỏe, diễn biến bệnh lý tự nhiên hoặc các sự kiện bất khả kháng nằm ngoài khả năng kiểm soát hợp lý của Bên B, trừ trường hợp do lỗi của Bên B.</div>

                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 7. Quy trình xử lý và giới hạn trách nhiệm khi NCT đi cấp cứu</div>
                <div><b>7.1. Xác định tình trạng:</b> Ngay khi phát hiện NCT có dấu hiệu diễn biến bất thường có khả năng nguy hiểm đến tính mạng, nhân viên y tế của Trung tâm sẽ tiến hành các biện pháp cấp cứu khẩn cấp theo nghiệp vụ trong phạm vi cho phép, đồng thời liên hệ ngay với cơ sở y tế gần nhất hoặc cấp cứu 115 để đưa NCT đến cơ sở y tế gần nhất.</div>
                <div><b>7.2. Thông báo khẩn cấp:</b> Trong vòng tối đa mười lăm (15) phút kể từ khi phát hiện sự việc, Bên B có nghĩa vụ gọi điện thoại trực tiếp để thông báo cho người đại diện của Bên A theo số điện thoại ghi trên hợp đồng.</div>
                <div><b>7.3. Miễn trừ trách nhiệm do lỗi Bên A chậm trễ (Trường hợp bất khả kháng đối với Trung tâm)</b></div>
                <div>a) Trong trường hợp Bên B không thể liên lạc được với Bên A (do điện thoại tắt máy, không nghe máy, ngoài vùng phủ sóng) hoặc Bên A không có mặt tại trung tâm trong vòng một (01) giờ kể từ khi nhận được thông báo, Trung tâm dưỡng lão Tâm An được quyền xem đây là tình huống khẩn cấp bất khả kháng và Bên B được chủ động toàn quyền quyết định phối hợp với cơ sở y tế.</div>
                <div>b) Toàn bộ chi phí phát sinh liên quan đến quá trình xử lý cấp cứu và phối hợp với các cơ sở y tế, các đơn vị chuyên môn sẽ do Bên A chịu trách nhiệm thanh toán.</div>
                <div><b>7.4. Bàn giao tài sản trong trường hợp NCT không quay trở lại Trung tâm sau cấp cứu:</b> Bên B có trách nhiệm lập biên bản kiểm kê, niêm phong và bàn giao lại toàn bộ trang phục, tư trang, đồ dùng cá nhân của cụ cho Bên A khi gia đình có yêu cầu.</div>
                <div><b>7.5. Thanh toán các chi phí phát sinh:</b> Các chi phí phát sinh từ các dịch vụ trên, Bên A có trách nhiệm thanh toán cho Bên B trong vòng bảy (07) ngày.</div>

                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 8: Sử dụng hình ảnh NCT</div>
                <div>Bên B được phép sử dụng hình ảnh hoạt động hàng ngày của NCT tại Trung tâm, phục vụ mục đích hoạt động truyền thông kênh Online và trên các ấn phẩm của trung tâm. Tuyệt đối không được sử dụng vào mục đích khác làm ảnh hưởng đến uy tín, danh dự của NCT.</div>

                <div style={{ fontWeight: 'bold', marginTop: '10px' }}>Điều 9: Chấm dứt, sửa đổi và giải quyết tranh chấp</div>
                <div><b>9.1. Hợp đồng chấm dứt khi:</b> Hai bên đồng thuận; hết thời hạn hợp đồng; một bên đơn phương chấm dứt hợp đồng hợp pháp.</div>
                <div><b>9.2. Thanh lý, chấm dứt hợp đồng do NCT tử vong:</b> Hợp đồng dịch vụ sẽ tự động chấm dứt tại thời điểm NCT qua đời. Trong vòng mười lăm (15) ngày làm việc kể từ ngày NCT qua đời, hai bên sẽ tiến hành chốt chi phí dịch vụ tính đến ngày NCT qua đời, hoàn trả phần tiền đặt cọc còn lại (sau khi trừ các chi phí phát sinh nếu có).</div>
                <div><b>9.3. Sửa đổi hợp đồng:</b> Mọi thay đổi về điều khoản hoặc chế độ chăm sóc phải được lập bằng văn bản dưới dạng Phụ lục hợp đồng có chữ ký của hai bên.</div>
                <div><b>9.4. Giải quyết tranh chấp:</b> Ưu tiên giải quyết thông qua thương lượng, hòa giải trên tinh thần thiện chí. Trường hợp không tự thỏa thuận được, tranh chấp sẽ được đưa ra Tòa án có thẩm quyền tại Việt Nam giải quyết .</div>
                <div style={{ margin: '8px 0', fontStyle: 'italic' }}>
                  Hợp đồng này được lập thành hai (02) bản có giá trị pháp lý tương đương, mỗi Bên giữ một (01) bản để thực hiện. Hợp đồng có hiệu lực kể từ ngày ký.
                </div>
              </div>

              {/* SIGNATURE SECTION */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', marginTop: '30px', marginBottom: '40px' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>ĐẠI DIỆN BÊN A</div>
                  <div style={{ fontStyle: 'italic', fontSize: '10pt', color: '#64748b' }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ height: '70px' }}></div>
                  <div style={{ fontWeight: 'bold' }}>{viewingContract.partyA.relative1Name || viewingContract.partyA.residentName}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>ĐẠI DIỆN BÊN B</div>
                  <div style={{ fontStyle: 'italic', fontSize: '10pt', color: '#64748b' }}>(Ký, đóng dấu, ghi rõ họ tên)</div>
                  <div style={{ height: '70px' }}></div>
                  <div style={{ fontWeight: 'bold' }}>{viewingContract.partyB.representativeName}</div>
                </div>
              </div>

              {/* PAGE BREAK FOR APPENDIX */}
              <div className="contract-page-break" style={{ pageBreakBefore: 'always', paddingTop: '20px' }}></div>

              {/* APPENDIX 01 TITLE */}
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '14pt', fontWeight: 'bold' }}>PHỤ LỤC 01</h3>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '13pt', fontWeight: 'bold' }}>BIỂU PHÍ VÀ DANH MỤC CHĂM SÓC</h3>
                <div style={{ fontStyle: 'italic', fontSize: '11pt', marginTop: '2px' }}>
                  (Kèm theo Hợp đồng số: {viewingContract.contractCode})
                </div>
              </div>

              <div>
                <b>Tình trạng sức khỏe NCT tại thời điểm tiếp nhận vào Trung tâm dưỡng lão Tâm An:</b><br />
                <div style={{ padding: '6px 10px', borderBottom: '1px dotted #94a3b8', minHeight: '40px', fontStyle: viewingContract.appendix.healthStatusAtAdmission ? 'normal' : 'italic', color: viewingContract.appendix.healthStatusAtAdmission ? '#000' : '#64748b' }}>
                  {viewingContract.appendix.healthStatusAtAdmission || '........................................................................................................................................................................................................'}
                </div>
              </div>

              <div style={{ fontWeight: 'bold', marginTop: '12px' }}>1. Phí dịch vụ chăm sóc cơ bản:</div>
              <div>• Loại phòng đăng ký: <b>{viewingContract.appendix.roomType}</b> (Mã giường: <b>{viewingContract.appendix.bedCode || '—'}</b>).</div>
              <div>• Mức phí cơ bản: <b>{viewingContract.appendix.baseMonthlyFee.toLocaleString()} VNĐ/tháng</b>.</div>
              <div>• <i>(Bằng chữ: {viewingContract.appendix.baseMonthlyFeeText || numberToVietnameseText(viewingContract.appendix.baseMonthlyFee)})</i></div>

              <div style={{ fontWeight: 'bold', marginTop: '12px', marginBottom: '6px' }}>
                2. Dịch vụ chăm sóc bổ sung (theo yêu cầu của Bên A):
              </div>

              {/* APPENDIX SERVICES TABLE */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt', margin: '8px 0' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '40px', textAlign: 'center' }}>STT</th>
                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'left' }}>Nội dung dịch vụ</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '140px', textAlign: 'right' }}>Mức phí (VNĐ)<br />đồng/người/tháng</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '180px', textAlign: 'left' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingContract.appendix.additionalServices.map((srv) => (
                    <tr key={srv.stt} style={{ background: srv.selected ? '#f0fdf4' : 'transparent' }}>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{srv.stt}</td>
                      <td style={{ border: '1px solid #000', padding: '4px', fontWeight: srv.selected ? 'bold' : 'normal' }}>
                        {srv.name} {srv.selected && '✓'}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: srv.selected ? 'bold' : 'normal' }}>
                        {srv.selected ? `${srv.fee.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px', fontSize: '9.5pt' }}>{srv.note}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold', background: '#e2e8f0' }}>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                      Tổng phí chăm sóc hỗ trợ bổ sung:
                    </td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', color: '#166534' }}>
                      {viewingContract.appendix.additionalServices.filter(s => s.selected).reduce((sum, s) => sum + s.fee, 0).toLocaleString()} VNĐ
                    </td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '8px' }}>
                <b>3. Ưu đãi:</b> {viewingContract.appendix.discountReason || 'Theo chính sách ưu đãi của Trung tâm'} (Giảm {viewingContract.appendix.discount.toLocaleString()} VNĐ)
              </div>
              <div style={{ marginTop: '4px', fontSize: '13pt' }}>
                <b>TỔNG PHÍ DỊCH VỤ SAU ƯU ĐÃI (1+2-3):</b> <b style={{ color: '#166534' }}>{viewingContract.appendix.totalMonthlyFee.toLocaleString()} VNĐ/tháng</b>
              </div>
              <div style={{ fontStyle: 'italic', marginTop: '2px' }}>
                (Bằng chữ: <b>{viewingContract.appendix.totalMonthlyFeeText || numberToVietnameseText(viewingContract.appendix.totalMonthlyFee)}</b>)
              </div>

              {/* APPENDIX CLAUSES 4 & 5 */}
              <div style={{ textAlign: 'justify', marginTop: '12px' }}>
                <div style={{ fontWeight: 'bold' }}>4. Các quy định bổ sung:</div>
                <div><b>a. Ưu đãi đóng phí chăm sóc cơ bản:</b> Giảm 5% khi đóng trước 12 tháng; 3% khi đóng trước 6 tháng.</div>
                <div><b>b. Phụ thu ngày Lễ, Tết:</b> Tết dương lịch, Tết âm lịch, các ngày 10/3 Âm lịch; 30/4; 1/5; Quốc Khánh... (hoặc các ngày khác theo quy định từng năm của Nhà nước): 200.000/ngày/NCT lưu trú dài hạn; 300.000/ngày/NCT lưu trú ngắn hạn.</div>
                <div><b>c. Vắng mặt bất khả kháng:</b> Giảm trừ 200.000 đồng/ngày khi NCT không lưu trú tại Trung tâm do đi cấp cứu hoặc điều trị tại bệnh viện.</div>
                <div><b>d. Vắng mặt vì lý do khác:</b> Giảm trừ 100.000 đồng/ngày khi NCT rời trung tâm về nhà có việc riêng.</div>
                <div><b>e. Thời hạn đóng phí:</b> Bên A có nghĩa vụ hoàn thành thanh toán Phí dịch vụ tháng hiện tại và chi phí phát sinh của tháng trước từ ngày mùng 01 đến ngày 05 hàng tháng.</div>

                <div style={{ fontWeight: 'bold', marginTop: '8px' }}>5. Điều chỉnh giá dịch vụ: <i>(khi có biến động thị trường và tình trạng sức khỏe của NCT)</i></div>
                <div><b>a) Nguyên tắc điều chỉnh:</b> Mức phí dịch vụ quy định tại Phụ lục 01 được xây dựng dựa trên giá cả thị trường và tình trạng NCT tại thời điểm ký hợp đồng.</div>
                <div>- Trong quá trình thực hiện hợp đồng, nếu từ năm thứ 2 trở đi, chỉ số giá tiêu dùng (CPI) tăng hoặc giá cả các yếu tố đầu vào (thực phẩm, điện, nước, lương nhân viên y tế, vật tư tiêu hao) tăng đột biến.</div>
                <div>- Hoặc trong bất kỳ thời điểm nào NCT có diễn biến thay đổi về sức khỏe và cần điều chỉnh chế độ chăm sóc.</div>
                <div>Bên B có quyền điều chỉnh tăng mức phí dịch vụ, Bên B sẽ thông báo bằng văn bản về việc điều chỉnh phí dịch vụ tới bên A.</div>
                <div><b>b) Giới hạn mức tăng:</b> Để đảm bảo quyền lợi cho Bên A, Bên B cam kết tỷ lệ điều chỉnh mức phí mỗi lần không vượt quá 10% so với mức phí đang áp dụng và khoảng cách giữa hai lần điều chỉnh giá liên tiếp tối thiểu là 24 tháng.</div>
                <div><b>c) Quy trình thông báo:</b> Khi có thay đổi giá, Bên B phải gửi thông báo bằng văn bản hoặc email/tin nhắn chính thức cho Bên A trước ít nhất 30 ngày tính đến ngày áp dụng mức giá mới.</div>
                <div><b>d) Quyền lựa chọn của Bên A:</b> Sau khi nhận thông báo, nếu Bên A không đồng ý với mức giá mới, Bên A có quyền đơn phương chấm dứt hợp đồng dịch vụ mà không bị phạt. Hai bên sẽ tiến hành chốt chi phí và thanh lý hợp đồng theo mức giá cũ tính đến ngày Bên A chính thức đưa NCT rời khỏi trung tâm. Nếu quá 30 ngày kể từ ngày nhận thông báo mà Bên A không có phản hồi bằng văn bản và vẫn tiếp tục để NCT an dưỡng tại trung tâm, mức giá mới sẽ tự động có hiệu lực áp dụng.</div>
              </div>

              {/* APPENDIX SIGNATURE SECTION */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', marginTop: '30px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>ĐẠI DIỆN BÊN A</div>
                  <div style={{ fontStyle: 'italic', fontSize: '10pt', color: '#64748b' }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ height: '60px' }}></div>
                  <div style={{ fontWeight: 'bold' }}>{viewingContract.partyA.relative1Name || viewingContract.partyA.residentName}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>ĐẠI DIỆN BÊN B</div>
                  <div style={{ fontStyle: 'italic', fontSize: '10pt', color: '#64748b' }}>(Ký, đóng dấu, ghi rõ họ tên)</div>
                  <div style={{ height: '60px' }}></div>
                  <div style={{ fontWeight: 'bold' }}>{viewingContract.partyB.representativeName}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default ServiceContractsPage;

