import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { fetchExecutiveAnalytics } from '../../api/analytics';
import { LoadingState, ErrorState } from '../../components/feedback/FeedbackStates';

export default function AnalyticsPage() {
  const { actor } = useActor();
  const [activeTab, setActiveTab] = useState<'occupancy' | 'clinical' | 'financial' | 'workforce'>('occupancy');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-09');

  const analyticsQuery = useQuery({
    queryKey: ['executive-analytics', selectedPeriod],
    queryFn: () => fetchExecutiveAnalytics(selectedPeriod),
  });

  if (analyticsQuery.isLoading) {
    return <LoadingState title="Đang tổng hợp dữ liệu phân tích quản trị thông minh..." />;
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return <ErrorState title="Lỗi kết nối" description="Không thể tải dữ liệu báo cáo quản trị." />;
  }

  const data = analyticsQuery.data;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <header className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="eyebrow" style={{ color: '#15803d', fontWeight: 700 }}>
          📈 TRUNG TÂM PHÂN TÍCH & QUẢN TRỊ THÔNG MINH (SERIES AE)
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ color: '#1e293b' }}>
              Báo Cáo Phân Tích & Điều Hành Vĩ Mô
            </h1>
            <p className="page-description">
              Tổng hợp thời gian thực các chỉ số công suất phòng, chất lượng lâm sàng, doanh thu thu phí và hiệu suất nhân sự tại Trung tâm.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.2rem 0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Kỳ báo cáo:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{ border: 'none', background: 'none', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
              >
                <option value="2026-09">Tháng 09/2026 (Hiện tại)</option>
                <option value="2026-Q3">Quý 3/2026</option>
                <option value="2026">Năm 2026</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
            >
              🖨️ Xuất Báo Cáo Điều Hành
            </button>

            {actor?.actorRole === 'SUPERVISOR' && (
              <span className="badge badge-purple" style={{ padding: '0.45rem 0.75rem', fontWeight: 700 }}>
                👑 Ban Giám đốc: Toàn quyền xem vĩ mô
              </span>
            )}
            {actor?.actorRole === 'CARE_MANAGER' && (
              <span className="badge badge-info" style={{ padding: '0.45rem 0.75rem', fontWeight: 700 }}>
                📋 Quản lý: Vận hành & Nhân sự
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
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
          onClick={() => setActiveTab('occupancy')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'occupancy' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'occupancy' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🏢 Công Suất & Phòng Giường
          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
            {data.occupancy.occupancyRate}%
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clinical')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'clinical' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'clinical' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🩺 Lâm Sàng & An Toàn Người Cao Tuổi
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('financial')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'financial' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'financial' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          💰 Tài Chính & Doanh Thu Thu Phí
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workforce')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'workforce' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'workforce' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          👥 Năng Suất Nhân Sự & Vận Hành Ca Kíp
        </button>
      </div>

      {/* TAB 1: OCCUPANCY & INFRASTRUCTURE */}
      {activeTab === 'occupancy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TỶ LỆ LẤP ĐẦY PHÒNG / GIƯỜNG</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                {data.occupancy.occupancyRate}%
              </div>
              <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '0.2rem' }}>
                {data.occupancy.totalOccupied} / {data.occupancy.totalCapacity} giường đang có người ở
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>GIƯỜNG TRỐNG SẴN SÀNG ĐÓN TIẾP</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                {data.occupancy.availableBeds} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>giường</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '0.2rem' }}>
                Phân bổ tại Tầng 2, 3 và 4
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TIẾP NHẬN MỚI TRONG THÁNG</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                +{data.occupancy.monthlyTurnover.admissions} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Cụ</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.2rem' }}>
                Đã hoàn tất đánh giá 2 trang ban đầu
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TẠM VẮNG & XUẤT VIỆN</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.2rem' }}>
                {data.occupancy.monthlyTurnover.temporaryLeaves} vắng / {data.occupancy.monthlyTurnover.discharges} ra
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6d28d9', marginTop: '0.2rem' }}>
                Đã giải phóng giường theo quy trình
              </div>
            </div>
          </div>

          {/* Occupancy by Room Tier Table */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.15rem' }}>
              📊 Cơ Cấu Công Suất Theo Từng Hạng Phòng Lưu Trú
            </h3>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hạng Phòng Lưu Trú</th>
                    <th>Số lượng phòng</th>
                    <th>Tổng số giường</th>
                    <th>Đang sử dụng</th>
                    <th>Còn trống</th>
                    <th>Tỷ lệ lấp đầy (%)</th>
                    <th>Trạng thái tiếp nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1. Phòng Đơn (1 Giường) */}
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏠 Phòng Đơn (1 Giường)</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.SINGLE_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td>{data.occupancy.byTier.SINGLE_BED.totalRooms} phòng</td>
                    <td>{data.occupancy.byTier.SINGLE_BED.totalBeds} giường</td>
                    <td><b>{data.occupancy.byTier.SINGLE_BED.occupiedBeds}</b></td>
                    <td><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.SINGLE_BED.totalBeds - data.occupancy.byTier.SINGLE_BED.occupiedBeds}</b></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.SINGLE_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.SINGLE_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-success">Sẵn sàng đón tiếp</span></td>
                  </tr>

                  {/* 2. Phòng Đôi (2 Giường) */}
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏡 Phòng Đôi (2 Giường)</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.DOUBLE_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td>{data.occupancy.byTier.DOUBLE_BED.totalRooms} phòng</td>
                    <td>{data.occupancy.byTier.DOUBLE_BED.totalBeds} giường</td>
                    <td><b>{data.occupancy.byTier.DOUBLE_BED.occupiedBeds}</b></td>
                    <td><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.DOUBLE_BED.totalBeds - data.occupancy.byTier.DOUBLE_BED.occupiedBeds}</b></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.DOUBLE_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.DOUBLE_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-warning">Còn 1 giường</span></td>
                  </tr>

                  {/* 3. Phòng 3 Giường */}
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏢 Phòng 3 Giường</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.TRIPLE_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td>{data.occupancy.byTier.TRIPLE_BED.totalRooms} phòng</td>
                    <td>{data.occupancy.byTier.TRIPLE_BED.totalBeds} giường</td>
                    <td><b>{data.occupancy.byTier.TRIPLE_BED.occupiedBeds}</b></td>
                    <td><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.TRIPLE_BED.totalBeds - data.occupancy.byTier.TRIPLE_BED.occupiedBeds}</b></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.TRIPLE_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.TRIPLE_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-success">Sẵn sàng đón tiếp</span></td>
                  </tr>

                  {/* 4. Phòng 4 Giường */}
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏬 Phòng 4 Giường</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.QUAD_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td>{data.occupancy.byTier.QUAD_BED.totalRooms} phòng</td>
                    <td>{data.occupancy.byTier.QUAD_BED.totalBeds} giường</td>
                    <td><b>{data.occupancy.byTier.QUAD_BED.occupiedBeds}</b></td>
                    <td><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.QUAD_BED.totalBeds - data.occupancy.byTier.QUAD_BED.occupiedBeds}</b></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.QUAD_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.QUAD_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-success">Sẵn sàng đón tiếp</span></td>
                  </tr>

                  {/* 5. Phòng 6 Giường */}
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏥 Phòng 6 Giường</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.SIX_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td>{data.occupancy.byTier.SIX_BED.totalRooms} phòng</td>
                    <td>{data.occupancy.byTier.SIX_BED.totalBeds} giường</td>
                    <td><b>{data.occupancy.byTier.SIX_BED.occupiedBeds}</b></td>
                    <td><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.SIX_BED.totalBeds - data.occupancy.byTier.SIX_BED.occupiedBeds}</b></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.SIX_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.SIX_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-success">Sẵn sàng đón tiếp</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLINICAL TRENDS & SAFETY */}
      {activeTab === 'clinical' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Care Level Breakdown Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.15rem' }}>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>Cấp độ 1 — Tự chủ một phần</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', margin: '0.3rem 0' }}>
                {data.clinical.careLevelDistribution.level1.count} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Cụ ({data.clinical.careLevelDistribution.level1.percentage}%)</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Hỗ trợ sinh hoạt cơ bản, đo sinh hiệu định kỳ</div>
            </div>

            <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.15rem' }}>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>Cấp độ 2 — Phụ thuộc trung bình</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3b82f6', margin: '0.3rem 0' }}>
                {data.clinical.careLevelDistribution.level2.count} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Cụ ({data.clinical.careLevelDistribution.level2.percentage}%)</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Hỗ trợ tắm rửa, ăn uống, giám sát thuốc và tập VLTL</div>
            </div>

            <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.15rem' }}>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>Cấp độ 3 — Chăm sóc đặc biệt 24/7</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', margin: '0.3rem 0' }}>
                {data.clinical.careLevelDistribution.level3.count} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Cụ ({data.clinical.careLevelDistribution.level3.percentage}%)</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Ăn qua sonde, chống loét tì đè, hút đờm dãi, điều dưỡng trực</div>
            </div>
          </div>

          {/* Clinical Quality & eMAR Adherence */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b' }}>
                💊 Chỉ Số Tuân Thủ Cấp Phát Thuốc eMAR (5 Đúng)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span>Đã cho uống đúng cữ, đúng giờ:</span>
                    <b style={{ color: '#16a34a' }}>{data.clinical.emarCompliance.givenOnTimeRate}%</b>
                  </div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '0.2rem', overflow: 'hidden' }}>
                    <div style={{ width: `${data.clinical.emarCompliance.givenOnTimeRate}%`, height: '100%', background: '#16a34a' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span>Tạm hoãn do lý do lâm sàng (huyết áp/sốt):</span>
                    <b style={{ color: '#d97706' }}>{data.clinical.emarCompliance.heldRate}%</b>
                  </div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '0.2rem', overflow: 'hidden' }}>
                    <div style={{ width: `${data.clinical.emarCompliance.heldRate}%`, height: '100%', background: '#d97706' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span>Người cao tuổi từ chối uống:</span>
                    <b style={{ color: '#dc2626' }}>{data.clinical.emarCompliance.refusedRate}%</b>
                  </div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '0.2rem', overflow: 'hidden' }}>
                    <div style={{ width: `${data.clinical.emarCompliance.refusedRate}%`, height: '100%', background: '#dc2626' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b' }}>
                🏃 Tiến Độ Phục Hồi Chức Năng & Vận Động ADL
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tổng số giờ tập VLTL tháng này:</span>
                  <b style={{ color: '#15803d' }}>{data.clinical.rehabilitationProgress.totalHoursThisMonth} giờ</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Số người cao tuổi tham gia tập tích cực:</span>
                  <b>{data.clinical.rehabilitationProgress.activeRehabResidents} Cụ</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tỷ lệ cải thiện chỉ số sinh hoạt ADL:</span>
                  <b style={{ color: '#16a34a' }}>{data.clinical.rehabilitationProgress.adlImprovementRate}%</b>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.4rem', fontStyle: 'italic' }}>
                  * Báo cáo ghi nhận bởi Chuyên viên Phục hồi chức năng theo dõi định kỳ hàng tuần.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCIAL INTELLIGENCE */}
      {activeTab === 'financial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Financial Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TỔNG DOANH THU DỰ PHÓNG</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1e293b', marginTop: '0.2rem' }}>
                {(data.financial.projectedRevenue / 1000000000).toFixed(3)} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Tỷ VNĐ</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                {data.financial.projectedRevenue.toLocaleString('vi-VN')} đ
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>THỰC TẾ ĐÃ THU HỒI ({data.financial.collectionRate}%)</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                {(data.financial.collectedRevenue / 1000000000).toFixed(3)} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Tỷ VNĐ</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                <div style={{ width: `${data.financial.collectionRate}%`, height: '100%', background: '#16a34a' }} />
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>CÔNG NỢ CHƯA THANH TOÁN</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#dc2626', marginTop: '0.2rem' }}>
                {(data.financial.outstandingReceivable / 1000000).toFixed(0)} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Triệu VNĐ</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '0.2rem' }}>
                {data.financial.outstandingReceivable.toLocaleString('vi-VN')} đ
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>GIẢM TRỪ SUẤT ĂN TẠM VẮNG</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                -{(data.financial.rlaDeductionSummary.totalDeductionVnd / 1000000).toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Triệu VNĐ</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.2rem' }}>
                Đã miễn giảm cho {data.financial.rlaDeductionSummary.totalEligibleDays} ngày vắng hợp lệ
              </div>
            </div>
          </div>

          {/* Revenue Streams Distribution */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.15rem' }}>
              📊 Cơ Cấu 5 Dòng Doanh Thu Thu Phí Tâm An Care
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>1. Gói dịch vụ chăm sóc người cao tuổi (60%):</span>
                  <b>{data.financial.revenueStreams.carePackages.toLocaleString('vi-VN')} đ</b>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.25rem', overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', background: '#15803d' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>2. Tiền phòng & Giường lưu trú (25%):</span>
                  <b>{data.financial.revenueStreams.accommodation.toLocaleString('vi-VN')} đ</b>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.25rem', overflow: 'hidden' }}>
                  <div style={{ width: '25%', height: '100%', background: '#3b82f6' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>3. Dinh dưỡng & Suất ăn định mức (10%):</span>
                  <b>{data.financial.revenueStreams.nutrition.toLocaleString('vi-VN')} đ</b>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.25rem', overflow: 'hidden' }}>
                  <div style={{ width: '10%', height: '100%', background: '#f59e0b' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>4. Vật tư y tế & Thuốc tiêu hao (5%):</span>
                  <b>{data.financial.revenueStreams.consumables.toLocaleString('vi-VN')} đ</b>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.25rem', overflow: 'hidden' }}>
                  <div style={{ width: '5%', height: '100%', background: '#8b5cf6' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WORKFORCE & OPERATIONS */}
      {activeTab === 'workforce' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Workforce KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TỶ LỆ CHĂM SÓC CA NGÀY</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                {data.workforce.dayCaregiverRatio}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '0.2rem' }}>
                Đạt chuẩn an toàn y tế (Định mức ≤ 1:3.5)
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TỶ LỆ CHĂM SÓC CA ĐÊM</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                {data.workforce.nightCaregiverRatio}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '0.2rem' }}>
                Đạt chuẩn an toàn y tế (Định mức ≤ 1:6.0)
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>CHẤP HÀNH CA TRỰC ĐÚNG GIỜ</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                {data.workforce.shiftAttendanceRate}%
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.2rem' }}>
                Tổng số 48 nhân sự thuộc 12 vị trí
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>NHẬT KÝ CHĂM SÓC ĐÃ GHI NHẬN</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.2rem' }}>
                {data.workforce.totalCareLogsThisMonth.toLocaleString('vi-VN')} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>lượt</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6d28d9', marginTop: '0.2rem' }}>
                Minh chứng đầy đủ theo 7 nhóm danh mục
              </div>
            </div>
          </div>

          {/* Work Distribution by Category */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.15rem' }}>
              📋 Phân Bổ Khối Lượng Chăm Sóc Theo Nhóm Nghiệp Vụ
            </h3>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nhóm Nghiệp Vụ Chăm Sóc</th>
                    <th>Số lượt công việc ghi nhận</th>
                    <th>Tỷ trọng khối lượng</th>
                    <th>Đánh giá vận hành</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.workforce.workDistributionByCareType).map(([cat, count]) => {
                    const pct = Math.round((count / data.workforce.totalCareLogsThisMonth) * 100);
                    return (
                      <tr key={cat}>
                        <td><b>{cat}</b></td>
                        <td>{count.toLocaleString('vi-VN')} lượt</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span><b>{pct}%</b></span>
                            <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#15803d' }} />
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge-success">Đạt định mức</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
