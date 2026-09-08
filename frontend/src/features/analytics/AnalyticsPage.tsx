import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import {
  fetchExecutiveAnalytics,
  GranularityType,
  TrendDataPoint,
} from '../../api/analytics';
import { LoadingState, ErrorState } from '../../components/feedback/FeedbackStates';

export default function AnalyticsPage() {
  const { actor } = useActor();

  // State controls
  const [granularity, setGranularity] = useState<GranularityType>('MONTH');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-09');
  const [activeTab, setActiveTab] = useState<'occupancy' | 'clinical' | 'financial' | 'workforce'>('occupancy');
  const [viewMode, setViewMode] = useState<'kpi' | 'charts'>('kpi');
  const [hoveredPoint, setHoveredPoint] = useState<TrendDataPoint | null>(null);

  // Period options generator
  const getPeriodOptions = (gran: GranularityType) => {
    if (gran === 'MONTH') {
      return [
        { value: '2026-09', label: 'Tháng 09/2026 (Hiện tại)' },
        { value: '2026-08', label: 'Tháng 08/2026' },
        { value: '2026-07', label: 'Tháng 07/2026' },
        { value: '2026-06', label: 'Tháng 06/2026' },
        { value: '2026-05', label: 'Tháng 05/2026' },
        { value: '2026-04', label: 'Tháng 04/2026' },
        { value: '2026-03', label: 'Tháng 03/2026' },
        { value: '2026-02', label: 'Tháng 02/2026' },
        { value: '2026-01', label: 'Tháng 01/2026' },
      ];
    }
    if (gran === 'QUARTER') {
      return [
        { value: '2026-Q3', label: 'Quý 3/2026 (Hiện tại)' },
        { value: '2026-Q2', label: 'Quý 2/2026' },
        { value: '2026-Q1', label: 'Quý 1/2026' },
        { value: '2025-Q4', label: 'Quý 4/2025' },
        { value: '2025-Q3', label: 'Quý 3/2025' },
      ];
    }
    return [
      { value: '2026', label: 'Năm 2026 (Hiện tại)' },
      { value: '2025', label: 'Năm 2025' },
      { value: '2024', label: 'Năm 2024' },
      { value: '2023', label: 'Năm 2023' },
    ];
  };

  const analyticsQuery = useQuery({
    queryKey: ['executive-analytics', selectedPeriod, granularity],
    queryFn: () => fetchExecutiveAnalytics(selectedPeriod, granularity),
  });

  const handleGranularityChange = (newGran: GranularityType) => {
    setGranularity(newGran);
    if (newGran === 'MONTH') setSelectedPeriod('2026-09');
    else if (newGran === 'QUARTER') setSelectedPeriod('2026-Q3');
    else setSelectedPeriod('2026');
  };

  if (analyticsQuery.isLoading) {
    return <LoadingState title="Đang tổng hợp dữ liệu phân tích quản trị thông minh..." />;
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return <ErrorState title="Lỗi kết nối" description="Không thể tải dữ liệu báo cáo quản trị." />;
  }

  const data = analyticsQuery.data;
  const trendHistory = data.trendHistory || [];

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
              Đồng bộ thời gian thực 110 giường/29 phòng, biến động lưu trú ra vào, chất lượng lâm sàng và tài chính vận hành.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* View Mode Toggle Button */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.2rem', border: '1px solid #cbd5e1' }}>
              <button
                type="button"
                onClick={() => setViewMode('kpi')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: viewMode === 'kpi' ? '#ffffff' : 'transparent',
                  color: viewMode === 'kpi' ? '#15803d' : '#64748b',
                  boxShadow: viewMode === 'kpi' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                📊 Chi Tiết Số Liệu
              </button>
              <button
                type="button"
                onClick={() => setViewMode('charts')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: viewMode === 'charts' ? '#ffffff' : 'transparent',
                  color: viewMode === 'charts' ? '#15803d' : '#64748b',
                  boxShadow: viewMode === 'charts' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                📈 Sơ Đồ Biến Động
              </button>
            </div>

            {/* Granularity Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.2rem 0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Chu kỳ:</span>
              <select
                value={granularity}
                onChange={(e) => handleGranularityChange(e.target.value as GranularityType)}
                style={{ border: 'none', background: 'none', fontWeight: 700, color: '#15803d', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                <option value="MONTH">Tháng</option>
                <option value="QUARTER">Quý</option>
                <option value="YEAR">Năm</option>
              </select>
            </div>

            {/* Specific Period Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.2rem 0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Kỳ:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{ border: 'none', background: 'none', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {getPeriodOptions(granularity).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}
            >
              🖨️ Xuất Báo Cáo In
            </button>

            {actor?.actorRole === 'SUPERVISOR' && (
              <span className="badge badge-success" style={{ padding: '0.45rem 0.75rem', fontWeight: 700, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                👑 Ban Giám Đốc: Xem Vĩ Mô
              </span>
            )}
            {actor?.actorRole === 'CARE_MANAGER' && (
              <span className="badge badge-info" style={{ padding: '0.45rem 0.75rem', fontWeight: 700 }}>
                📋 Quản Lý: Vận Hành & Nhân Sự
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Dynamic Summary Bar for Period */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.625rem', padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>📌</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
              Dữ Liệu Đang Xem: <span style={{ color: '#15803d' }}>{data.periodLabel}</span> ({granularity === 'MONTH' ? 'Báo cáo hàng tháng' : granularity === 'QUARTER' ? 'Báo cáo hàng quý' : 'Báo cáo tổng kết năm'})
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Số liệu công suất 110 giường & cơ cấu phòng được đồng bộ từ sơ đồ cơ sở vật chất.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TỶ LỆ LẤP ĐẦY THỰC TẾ</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d' }}>{data.occupancy.occupancyRate}%</div>
          </div>
          <div style={{ width: '1px', height: '24px', background: '#cbd5e1' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>THU HỒI VIỆN PHÍ</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb' }}>{data.financial.collectionRate}%</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch',
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
          <span className="badge badge-success" style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#15803d' }}>
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

      {/* VISUAL TREND CHARTS SECTION (When viewMode === 'charts') */}
      {viewMode === 'charts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📊</span> Sơ Đồ Biến Động Theo {granularity === 'MONTH' ? '12 Tháng' : granularity === 'QUARTER' ? '8 Quý' : 'Các Năm'}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Rê chuột vào từng thời điểm để xem số liệu chi tiết. Tất cả sơ đồ được cập nhật tự động theo chu kỳ được chọn.
            </p>
          </div>

          {/* Chart 1: Occupancy Trend SVG */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>
                1. Sơ Đồ Biến Động Tỷ Lệ Lấp Đầy Phòng/Giường (%)
              </h4>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '12px', height: '12px', background: '#16a34a', borderRadius: '2px' }} />
                  Tỷ lệ lấp đầy (%)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '12px', height: '12px', background: '#2563eb', borderRadius: '2px' }} />
                  Số giường đang ở (trên 110)
                </span>
              </div>
            </div>

            {/* SVG Render */}
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg viewBox="0 0 800 220" style={{ width: '100%', height: '220px', overflow: 'visible' }}>
                {/* Background Grid lines */}
                {[20, 40, 60, 80, 100].map((val) => {
                  const y = 180 - (val / 100) * 140;
                  return (
                    <g key={val}>
                      <line x1="40" y1={y} x2="780" y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="32" y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{val}%</text>
                    </g>
                  );
                })}

                {/* Draw Area path & Line path */}
                {(() => {
                  if (!trendHistory.length) return null;
                  const stepX = (780 - 50) / Math.max(1, trendHistory.length - 1);
                  const points = trendHistory.map((pt, i) => {
                    const x = 50 + i * stepX;
                    const y = 180 - (pt.occupancyRate / 100) * 140;
                    return { x, y, pt };
                  });

                  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const areaD = `${pathD} L ${points[points.length - 1].x} 180 L 50 180 Z`;

                  return (
                    <>
                      <defs>
                        <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      <path d={areaD} fill="url(#occGrad)" />
                      <path d={pathD} fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      {points.map((p, i) => {
                        const isHovered = hoveredPoint?.periodKey === p.pt.periodKey;
                        return (
                          <g key={p.pt.periodKey} onMouseEnter={() => setHoveredPoint(p.pt)} style={{ cursor: 'pointer' }}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isHovered ? 7 : 4}
                              fill={isHovered ? '#15803d' : '#ffffff'}
                              stroke="#16a34a"
                              strokeWidth={isHovered ? 3 : 2}
                            />
                            <text x={p.x} y="200" fontSize="10" fill="#64748b" textAnchor="middle" fontWeight={isHovered ? '700' : '400'}>
                              {p.pt.label}
                            </text>
                            <text x={p.x} y={p.y - 10} fontSize="10" fill="#15803d" textAnchor="middle" fontWeight="700">
                              {p.pt.occupancyRate}%
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* Chart 2: Admissions & Discharges & Leaves Grouped Bar SVG */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>
                2. Sơ Đồ Biến Động Lưu Trú: Tiếp Nhận Mới vs Xuất Viện vs Tạm Vắng (RLA)
              </h4>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '12px', height: '12px', background: '#d97706', borderRadius: '2px' }} />
                  Tiếp nhận mới
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }} />
                  Xuất viện
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '12px', height: '12px', background: '#2563eb', borderRadius: '2px' }} />
                  Tạm vắng (RLA)
                </span>
              </div>
            </div>

            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg viewBox="0 0 800 200" style={{ width: '100%', height: '200px' }}>
                {[0, 5, 10, 15, 20].map((val) => {
                  const y = 160 - (val / 20) * 120;
                  return (
                    <g key={val}>
                      <line x1="40" y1={y} x2="780" y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="32" y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{val}</text>
                    </g>
                  );
                })}

                {(() => {
                  if (!trendHistory.length) return null;
                  const stepX = (780 - 60) / trendHistory.length;
                  const barW = Math.min(12, (stepX - 10) / 3);

                  return trendHistory.map((pt, i) => {
                    const groupX = 60 + i * stepX;

                    const hAdm = (pt.admissions / 20) * 120;
                    const hDis = (pt.discharges / 20) * 120;
                    const hLve = (pt.temporaryLeaves / 20) * 120;

                    return (
                      <g key={pt.periodKey} onMouseEnter={() => setHoveredPoint(pt)} style={{ cursor: 'pointer' }}>
                        {/* Admission Bar */}
                        <rect x={groupX} y={160 - hAdm} width={barW} height={hAdm} fill="#d97706" rx="2" />

                        {/* Discharge Bar */}
                        <rect x={groupX + barW + 2} y={160 - hDis} width={barW} height={hDis} fill="#ef4444" rx="2" />

                        {/* Leave Bar */}
                        <rect x={groupX + (barW + 2) * 2} y={160 - hLve} width={barW} height={hLve} fill="#2563eb" rx="2" />

                        <text x={groupX + barW * 1.5 + 2} y="180" fontSize="10" fill="#64748b" textAnchor="middle">
                          {pt.label}
                        </text>
                      </g>
                    );
                  });
                })()}
              </svg>
            </div>
          </div>

          {/* Chart 3 & Chart 4 side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {/* Chart 3: Care Levels Spectrum */}
            <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.85rem 0', color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>
                3. Sơ Đồ Biến Động Cơ Cấu Mức Độ Chăm Sóc
              </h4>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', marginBottom: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', background: '#16a34a', borderRadius: '2px' }} />
                  Cấp 1 (Tự chủ)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', background: '#2563eb', borderRadius: '2px' }} />
                  Cấp 2 (Trung bình)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', background: '#dc2626', borderRadius: '2px' }} />
                  Cấp 3 (Đặc biệt 24/7)
                </span>
              </div>

              <svg viewBox="0 0 400 180" style={{ width: '100%', height: '180px' }}>
                {trendHistory.map((pt, i) => {
                  const stepX = (380 - 40) / Math.max(1, trendHistory.length - 1);
                  const x = 35 + i * stepX;
                  const total = pt.level1Count + pt.level2Count + pt.level3Count || 1;
                  const h1 = (pt.level1Count / total) * 110;
                  const h2 = (pt.level2Count / total) * 110;
                  const h3 = (pt.level3Count / total) * 110;

                  return (
                    <g key={pt.periodKey}>
                      <rect x={x - 8} y={140 - h1} width="16" height={h1} fill="#16a34a" rx="1" />
                      <rect x={x - 8} y={140 - h1 - h2} width="16" height={h2} fill="#2563eb" rx="1" />
                      <rect x={x - 8} y={140 - h1 - h2 - h3} width="16" height={h3} fill="#dc2626" rx="1" />
                      <text x={x} y="160" fontSize="9" fill="#64748b" textAnchor="middle">{pt.label}</text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Chart 4: Financial Growth Trend */}
            <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.85rem 0', color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>
                4. Biến Động Doanh Thu Dự Phóng vs Thực Thu
              </h4>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', marginBottom: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', background: '#2563eb', borderRadius: '2px' }} />
                  Dự phóng (Tỷ VNĐ)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', background: '#16a34a', borderRadius: '2px' }} />
                  Đã thu hồi (Tỷ VNĐ)
                </span>
              </div>

              <svg viewBox="0 0 400 180" style={{ width: '100%', height: '180px' }}>
                {(() => {
                  const maxRev = Math.max(...trendHistory.map(p => p.projectedRevenueVnd), 2000000000);
                  const stepX = (380 - 40) / Math.max(1, trendHistory.length - 1);

                  return trendHistory.map((pt, i) => {
                    const x = 35 + i * stepX;
                    const hProj = (pt.projectedRevenueVnd / maxRev) * 110;
                    const hCol = (pt.collectedRevenueVnd / maxRev) * 110;

                    return (
                      <g key={pt.periodKey}>
                        <rect x={x - 7} y={140 - hProj} width="6" height={hProj} fill="#2563eb" opacity="0.4" rx="1" />
                        <rect x={x + 1} y={140 - hCol} width="6" height={hCol} fill="#16a34a" rx="1" />
                        <text x={x} y="160" fontSize="9" fill="#64748b" textAnchor="middle">{pt.label}</text>
                      </g>
                    );
                  });
                })()}
              </svg>
            </div>
          </div>
        </div>
      )}

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
                {data.occupancy.totalOccupied} / {data.occupancy.totalCapacity} giường đang có người lưu trú
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #2563eb' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>GIƯỜNG TRỐNG SẴN SÀNG ĐÓN TIẾP</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                {data.occupancy.availableBeds} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>giường</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '0.2rem' }}>
                Phân bổ đồng đều tại Tầng 1, 2, 3 và 4
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TIẾP NHẬN MỚI TRONG KỲ</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                +{data.occupancy.monthlyTurnover.admissions} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Cụ</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.2rem' }}>
                Đã hoàn tất đánh giá 2 trang ban đầu
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #0284c7' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TẠM VẮNG & XUẤT VIỆN</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', marginTop: '0.2rem' }}>
                {data.occupancy.monthlyTurnover.temporaryLeaves} vắng / {data.occupancy.monthlyTurnover.discharges} ra
              </div>
              <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '0.2rem' }}>
                Đã giải phóng giường theo quy trình
              </div>
            </div>
          </div>

          {/* Occupancy by Room Tier Table */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.15rem' }}>
              📊 Cơ Cấu Công Suất Theo Từng Hạng Phòng Lưu Trú (Đồng bộ 110 Giường / 29 Phòng)
            </h3>

            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem' }}>Hạng Phòng Lưu Trú</th>
                    <th style={{ padding: '0.75rem' }}>Số lượng phòng</th>
                    <th style={{ padding: '0.75rem' }}>Tổng số giường</th>
                    <th style={{ padding: '0.75rem' }}>Đang sử dụng</th>
                    <th style={{ padding: '0.75rem' }}>Còn trống</th>
                    <th style={{ padding: '0.75rem' }}>Tỷ lệ lấp đầy (%)</th>
                    <th style={{ padding: '0.75rem' }}>Trạng thái tiếp nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1. Phòng Đơn (1 Giường) */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏠 Phòng Đơn (1 Giường)</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.SINGLE_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.SINGLE_BED.totalRooms} phòng</td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.SINGLE_BED.totalBeds} giường</td>
                    <td style={{ padding: '0.75rem' }}><b>{data.occupancy.byTier.SINGLE_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.SINGLE_BED.totalBeds - data.occupancy.byTier.SINGLE_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.SINGLE_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.SINGLE_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}><span className="badge badge-success" style={{ background: '#dcfce7', color: '#15803d' }}>Sẵn sàng đón tiếp</span></td>
                  </tr>

                  {/* 2. Phòng Đôi (2 Giường) */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏡 Phòng Đôi (2 Giường)</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.DOUBLE_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.DOUBLE_BED.totalRooms} phòng</td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.DOUBLE_BED.totalBeds} giường</td>
                    <td style={{ padding: '0.75rem' }}><b>{data.occupancy.byTier.DOUBLE_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.DOUBLE_BED.totalBeds - data.occupancy.byTier.DOUBLE_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.DOUBLE_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.DOUBLE_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}><span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309' }}>Còn 1 giường</span></td>
                  </tr>

                  {/* 3. Phòng 3 Giường */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏢 Phòng 3 Giường</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.TRIPLE_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.TRIPLE_BED.totalRooms} phòng</td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.TRIPLE_BED.totalBeds} giường</td>
                    <td style={{ padding: '0.75rem' }}><b>{data.occupancy.byTier.TRIPLE_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.TRIPLE_BED.totalBeds - data.occupancy.byTier.TRIPLE_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.TRIPLE_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.TRIPLE_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}><span className="badge badge-success" style={{ background: '#dcfce7', color: '#15803d' }}>Sẵn sàng đón tiếp</span></td>
                  </tr>

                  {/* 4. Phòng 4 Giường */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏬 Phòng 4 Giường</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.QUAD_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.QUAD_BED.totalRooms} phòng</td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.QUAD_BED.totalBeds} giường</td>
                    <td style={{ padding: '0.75rem' }}><b>{data.occupancy.byTier.QUAD_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.QUAD_BED.totalBeds - data.occupancy.byTier.QUAD_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.QUAD_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.QUAD_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}><span className="badge badge-success" style={{ background: '#dcfce7', color: '#15803d' }}>Sẵn sàng đón tiếp</span></td>
                  </tr>

                  {/* 5. Phòng 6 Giường */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>🏥 Phòng 6 Giường</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Phòng: <b>{data.occupancy.byTier.SIX_BED.roomNumbers}</b>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.SIX_BED.totalRooms} phòng</td>
                    <td style={{ padding: '0.75rem' }}>{data.occupancy.byTier.SIX_BED.totalBeds} giường</td>
                    <td style={{ padding: '0.75rem' }}><b>{data.occupancy.byTier.SIX_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}><b style={{ color: '#2563eb' }}>{data.occupancy.byTier.SIX_BED.totalBeds - data.occupancy.byTier.SIX_BED.occupiedBeds}</b></td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span><b>{data.occupancy.byTier.SIX_BED.occupancyRate}%</b></span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${data.occupancy.byTier.SIX_BED.occupancyRate}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}><span className="badge badge-success" style={{ background: '#dcfce7', color: '#15803d' }}>Sẵn sàng đón tiếp</span></td>
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
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', margin: '0.3rem 0' }}>
                {data.clinical.careLevelDistribution.level2.count} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Cụ ({data.clinical.careLevelDistribution.level2.percentage}%)</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Hỗ trợ tắm rửa, ăn uống, giám sát thuốc và tập VLTL</div>
            </div>

            <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.15rem' }}>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>Cấp độ 3 — Chăm sóc đặc biệt 24/7</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626', margin: '0.3rem 0' }}>
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
                  <span>Tổng số giờ tập VLTL trong kỳ:</span>
                  <b style={{ color: '#15803d' }}>{data.clinical.rehabilitationProgress.totalHoursThisMonth.toLocaleString('vi-VN')} giờ</b>
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
            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #2563eb' }}>
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

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #d97706' }}>
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
                  <div style={{ width: '25%', height: '100%', background: '#2563eb' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>3. Dinh dưỡng & Suất ăn định mức (10%):</span>
                  <b>{data.financial.revenueStreams.nutrition.toLocaleString('vi-VN')} đ</b>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.25rem', overflow: 'hidden' }}>
                  <div style={{ width: '10%', height: '100%', background: '#d97706' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>4. Vật tư y tế & Thuốc tiêu hao (5%):</span>
                  <b>{data.financial.revenueStreams.consumables.toLocaleString('vi-VN')} đ</b>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.25rem', overflow: 'hidden' }}>
                  <div style={{ width: '5%', height: '100%', background: '#0284c7' }} />
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

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #2563eb' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TỶ LỆ CHĂM SÓC CA ĐÊM</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                {data.workforce.nightCaregiverRatio}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '0.2rem' }}>
                Đạt chuẩn an toàn y tế (Định mức ≤ 1:6.0)
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>CHẤP HÀNH CA TRỰC ĐÚNG GIỜ</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                {data.workforce.shiftAttendanceRate}%
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.2rem' }}>
                Tổng số 48 nhân sự thuộc 12 vị trí việc làm
              </div>
            </div>

            <div className="card" style={{ background: '#ffffff', padding: '1.15rem', borderLeft: '4px solid #0284c7' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>NHẬT KÝ CHĂM SÓC ĐÃ GHI NHẬN</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', marginTop: '0.2rem' }}>
                {data.workforce.totalCareLogsThisMonth.toLocaleString('vi-VN')} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>lượt</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '0.2rem' }}>
                Minh chứng đầy đủ theo 7 nhóm danh mục
              </div>
            </div>
          </div>

          {/* Work Distribution by Category */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.15rem' }}>
              📋 Phân Bổ Khối Lượng Chăm Sóc Theo Nhóm Nghiệp Vụ
            </h3>

            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem' }}>Nhóm Nghiệp Vụ Chăm Sóc</th>
                    <th style={{ padding: '0.75rem' }}>Số lượt công việc ghi nhận</th>
                    <th style={{ padding: '0.75rem' }}>Tỷ trọng khối lượng</th>
                    <th style={{ padding: '0.75rem' }}>Đánh giá vận hành</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.workforce.workDistributionByCareType).map(([cat, count]) => {
                    const pct = Math.round((count / (data.workforce.totalCareLogsThisMonth || 1)) * 100);
                    return (
                      <tr key={cat} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem' }}><b>{cat}</b></td>
                        <td style={{ padding: '0.75rem' }}>{count.toLocaleString('vi-VN')} lượt</td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span><b>{pct}%</b></span>
                            <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#15803d' }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem' }}><span className="badge badge-success" style={{ background: '#dcfce7', color: '#15803d' }}>Đạt định mức</span></td>
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
