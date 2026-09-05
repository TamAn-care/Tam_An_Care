import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useActor } from '../../auth/ActorContext';
import { ROLE_LABELS, getAssignedResidentIdsForActor } from '../../auth/role-policy';
import { listResidents } from '../../api/residents';
import { getAccommodationOverview } from '../../api/accommodation';
import { fetchLeaveRequests } from '../../api/resident-leave';
import { fetchShifts } from '../../api/workforce';
import { listHealthReports } from '../health-reports/healthReportsApi';
import { listWorkEvents } from '../../api/operational-work';
import { NutritionBoard } from '../nutrition/NutritionBoard';
import { listResidentAccessAssignments } from '../../api/resident-access-administration';

export function DashboardPage() {
  const { actor } = useActor();
  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';
  const actorName = actor?.displayName || 'Nhân viên';
  const isCaregiver = actorRole === 'CAREGIVER';
  const isNutritionist = actorRole === 'NUTRITIONIST';
  const isSocialWorker = actorRole === 'SOCIAL_WORKER';
  const isRehab = actorRole === 'REHABILITATION_SPECIALIST';
  const isPsychologist = actorRole === 'PSYCHOLOGIST';
  const isClinicalOrManagement = actorRole === 'SUPERVISOR' || actorRole === 'CARE_MANAGER' || actorRole === 'NURSE';
  const canAccessNutrition =
    actorRole === 'SUPERVISOR' ||
    actorRole === 'CARE_MANAGER' ||
    actorRole === 'CAREGIVER' ||
    actorRole === 'NURSE' ||
    actorRole === 'NUTRITIONIST';
  const todayStr = new Date().toISOString().slice(0, 10);

  // Queries for live metrics
  const { data: residentsData, isLoading: loadingResidents } = useQuery({
    queryKey: ['dashboard-residents', actorId],
    queryFn: () => listResidents(actor),
    enabled: Boolean(actor),
  });

  const { data: accommodationData, isLoading: loadingAccom } = useQuery({
    queryKey: ['dashboard-accommodation', actorId],
    queryFn: () => getAccommodationOverview(actor!, {}),
    enabled: Boolean(actor),
  });

  const { data: leaveData } = useQuery({
    queryKey: ['dashboard-leave', actorId],
    queryFn: () => fetchLeaveRequests(actorId, actorRole, { limit: 100 }),
    enabled: Boolean(actorId),
  });

  const { data: shiftsData } = useQuery({
    queryKey: ['dashboard-shifts', todayStr, actorId],
    queryFn: () => fetchShifts(actorId, actorRole, { shiftDate: todayStr, limit: 100 }),
    enabled: Boolean(actorId),
  });

  const { data: reportsData } = useQuery({
    queryKey: ['dashboard-reports', actorId],
    queryFn: () => listHealthReports(actor!),
    enabled: Boolean(actor) && isClinicalOrManagement,
  });

  const { data: workEventsData } = useQuery({
    queryKey: ['dashboard-work-events', actorId],
    queryFn: () => listWorkEvents(actor!, { limit: 50 }),
    enabled: Boolean(actor),
  });

  // Calculate assigned residents for Caregiver
  const myAssignedResidentRows = useMemo(() => {
    if (!residentsData) return [];
    if (!isCaregiver) return residentsData;

    const assignedIds = new Set(getAssignedResidentIdsForActor(actorId, actorName));
    return residentsData.filter(r => assignedIds.has(r.resident.residentId));
  }, [residentsData, isCaregiver, actorId, actorName]);

  // Caregiver specific metrics
  const myActiveLeavesCount = useMemo(() => {
    const myIds = new Set(myAssignedResidentRows.map(r => r.resident.residentId));
    return leaveData?.items?.filter(x => x.status === 'ACTIVE_LEAVE' && myIds.has(x.residentId))?.length ?? 0;
  }, [leaveData, myAssignedResidentRows]);

  const myShifts = useMemo(() => {
    return shiftsData?.items?.filter(x => x.staffActorId === actorId) ?? [];
  }, [shiftsData, actorId]);

  const isExecutive = actorRole === 'SUPERVISOR' || actorRole === 'ADMIN' || actorRole === 'CARE_MANAGER';

  const { data: assignmentsData } = useQuery({
    queryKey: ['dashboard-assignments', actorId],
    queryFn: () => listResidentAccessAssignments(actor!),
    enabled: Boolean(actor) && isExecutive,
  });

  // Macro live statistics for Management
  const stats = useMemo(() => {
    const totalResidents = residentsData?.length ?? 0;
    const activeResidents = residentsData?.filter(r => r.resident.activeStatus)?.length ?? 0;
    const accomSummary = accommodationData?.summary ?? {
      total: 110,
      occupied: totalResidents,
      available: 110 - totalResidents,
      occupancyPercentage: Math.round((totalResidents / 110) * 100),
    };
    const activeLeaves = leaveData?.items?.filter(x => x.status === 'ACTIVE_LEAVE')?.length ?? 0;
    const leavingToday = leaveData?.items?.filter(x => x.startDate === todayStr)?.length ?? 0;
    const returningToday = leaveData?.items?.filter(x => x.expectedEndDate === todayStr)?.length ?? 0;
    const todayShifts = shiftsData?.items?.length ?? 0;
    const inProgressShifts = shiftsData?.items?.filter(x => x.status === 'IN_PROGRESS')?.length ?? 0;
    const approvedReports = reportsData?.filter(r => r.status === 'APPROVED' || r.status === 'DELIVERED')?.length ?? 0;
    const pendingReports = reportsData?.filter(r => r.status === 'UNDER_REVIEW' || r.status === 'DRAFT' || r.status === 'REVISION_REQUIRED')?.length ?? 0;
    const workEventsCount = workEventsData?.count ?? workEventsData?.items?.length ?? 0;
    const activeAssignments = assignmentsData?.filter(a => a.status === 'ACTIVE') ?? [];
    const assignedStaffCount = new Set(activeAssignments.map(a => a.actorId)).size;

    return {
      totalResidents,
      activeResidents,
      accomSummary,
      activeLeaves,
      leavingToday,
      returningToday,
      todayShifts,
      inProgressShifts,
      approvedReports,
      pendingReports,
      workEventsCount,
      activeAssignmentsCount: activeAssignments.length,
      assignedStaffCount,
      activeAssignments,
    };
  }, [residentsData, accommodationData, leaveData, shiftsData, reportsData, workEventsData, assignmentsData, todayStr]);

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div className="eyebrow">
          {isCaregiver
            ? 'KHÔNG GIAN NHÂN VIÊN CHĂM SÓC'
            : isNutritionist
            ? 'KHÔNG GIAN NHÂN VIÊN DINH DƯỠNG'
            : isSocialWorker
            ? 'KHÔNG GIAN NHÂN VIÊN CÔNG TÁC XÃ HỘI'
            : isRehab
            ? 'KHÔNG GIAN NHÂN VIÊN PHỤC HỒI CHỨC NĂNG'
            : isPsychologist
            ? 'KHÔNG GIAN NHÂN VIÊN TÂM LÝ'
            : 'KHÔNG GIAN VẬN HÀNH TRUNG TÂM'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              {isCaregiver
                ? `Bảng Công Việc Chăm Sóc — ${actorName}`
                : isNutritionist
                ? `Bảng Điều Phối Dinh Dưỡng — ${actorName}`
                : isSocialWorker
                ? `Bảng Công Tác Xã Hội — ${actorName}`
                : isRehab
                ? `Bảng Phục Hồi Chức Năng — ${actorName}`
                : isPsychologist
                ? `Bảng Tham Vấn Tâm Lý — ${actorName}`
                : 'Tổng Quan Hoạt Động Chăm Sóc'}
            </h1>
            <p className="page-description">
              {isCaregiver
                ? 'Theo dõi trực tiếp người cao tuổi được phân quyền chăm sóc, ca trực trong ngày, ghi nhận công việc và phối hợp báo cáo suất ăn cho bếp.'
                : isNutritionist
                ? 'Theo dõi số lượng suất ăn thường trú tại Tâm An, tình trạng dinh dưỡng (tiểu đường, ăn nhạt), suất ăn đặc biệt và ca trực của bạn.'
                : isSocialWorker
                ? 'Theo dõi quy trình tiếp nhận hồ sơ ban đầu, tình hình tạm vắng nghỉ phép và ca kíp làm việc của bạn.'
                : isRehab
                ? 'Theo dõi kế hoạch phục hồi chức năng, bài tập vật lý trị liệu và ca trực hướng dẫn người cao tuổi trong ngày.'
                : isPsychologist
                ? 'Theo dõi kế hoạch tham vấn tâm lý, can thiệp cảm xúc, đánh giá nhận thức (MMSE) và ca trực của bạn.'
                : 'Bảng điều khiển tập trung theo dõi tình hình người cao tuổi, ca kíp nhân sự, tạm vắng và công việc vận hành trong ngày.'}
            </p>
          </div>
        </div>
      </div>

      {/* Conditional KPI Row based on Role */}
      {isCaregiver ? (
        /* Caregiver Focused KPIs (No macro facility capacity / No sensitive total bed metrics) */
        <div className="kpi-row">
          <div className="kpi-card" style={{ borderLeft: '4px solid #166534' }}>
            <div className="kpi-label">Cụ bạn phụ trách trực tiếp</div>
            <div className="kpi-val" style={{ color: '#166534' }}>
              {myAssignedResidentRows.length} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#607067' }}>người cao tuổi</span>
            </div>
            <div className="kpi-sub">Được phân quyền chăm sóc y khoa & ADL</div>
          </div>

          <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <div className="kpi-label">Trạng thái tại Tâm An hôm nay</div>
            <div className="kpi-val" style={{ color: '#2563eb' }}>
              {myAssignedResidentRows.length - myActiveLeavesCount}/{myAssignedResidentRows.length} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#607067' }}>cụ</span>
            </div>
            <div className="kpi-sub">
              {myActiveLeavesCount > 0 ? `${myActiveLeavesCount} cụ đang tạm vắng có báo trước` : 'Đầy đủ tại phòng ở'}
            </div>
          </div>

          <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div className="kpi-label">Ca trực của bạn hôm nay</div>
            <div className="kpi-val" style={{ color: '#7c3aed', fontSize: '1.4rem' }}>
              {myShifts.length > 0 ? (myShifts[0].shiftType === 'MORNING' ? 'Ca Sáng (06:00)' : myShifts[0].shiftType === 'AFTERNOON' ? 'Ca Chiều (14:00)' : 'Ca Đêm (22:00)') : 'Chưa xếp ca'}
            </div>
            <div className="kpi-sub">
              {myShifts.length > 0 ? (myShifts[0].status === 'IN_PROGRESS' ? '🟢 Đang trong ca trực' : 'Đã có lịch trực hôm nay') : 'Liên hệ quản lý điều phối'}
            </div>
          </div>

          <div className="kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
            <div className="kpi-label">Nhật ký chăm sóc trong ca</div>
            <div className="kpi-val" style={{ color: '#d97706' }}>
              {stats.workEventsCount} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#607067' }}>lượt</span>
            </div>
            <div className="kpi-sub">Ghi nhận ăn uống, sinh hoạt, vệ sinh</div>
          </div>
        </div>
      ) : (
        <div className="kpi-row">
          <div className="kpi-card" style={{ borderLeft: '4px solid #166534' }}>
            <div className="kpi-label">Người cao tuổi nội trú</div>
            <div className="kpi-val" style={{ color: '#166534' }}>
              {loadingResidents ? '...' : stats.activeResidents}
            </div>
            <div className="kpi-sub">Đang thụ hưởng dịch vụ chăm sóc</div>
          </div>

          <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <div className="kpi-label">Công suất giường nằm</div>
            <div className="kpi-val" style={{ color: '#2563eb' }}>
              {loadingAccom ? '...' : `${stats.accomSummary.occupied}/${stats.accomSummary.total}`}
            </div>
            <div className="kpi-sub">
              Đạt {stats.accomSummary.occupancyPercentage}% • Trống {stats.accomSummary.available} giường
            </div>
          </div>

          <div className="kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
            <div className="kpi-label">Đang tạm vắng</div>
            <div className="kpi-val" style={{ color: '#d97706' }}>
              {stats.activeLeaves}
            </div>
            <div className="kpi-sub">
              Vắng mặt hợp lệ ({stats.leavingToday} rời viện, {stats.returningToday} trở lại)
            </div>
          </div>

          <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div className="kpi-label">Lịch trực ca hôm nay</div>
            <div className="kpi-val" style={{ color: '#7c3aed' }}>
              {stats.todayShifts}
            </div>
            <div className="kpi-sub">
              {stats.inProgressShifts > 0 ? `🟢 ${stats.inProgressShifts} nhân viên đang trực` : 'Đã phân ca sáng/chiều/đêm'}
            </div>
          </div>
        </div>
      )}

      {/* EXECUTIVE COMMAND CENTER FOR BAN GIÁM ĐỐC & QUẢN LÝ */}
      {isExecutive && (
        <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Panel 1: Attention Required & Alerts */}
            <div className="card" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🚨</span> Công Việc Cần Phê Duyệt & Chú Ý
                </h3>
                <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                  {stats.pendingReports + stats.leavingToday + stats.returningToday} Mục
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {/* Health Reports Pending */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: stats.pendingReports > 0 ? '#fefce8' : '#f8fafc', border: `1px solid ${stats.pendingReports > 0 ? '#fde047' : '#e2e8f0'}`, borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <b style={{ color: '#0f172a' }}>🩺 Báo cáo sức khỏe y khoa chờ duyệt:</b>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Phiếu đánh giá sức khỏe ban đầu & định kỳ</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: stats.pendingReports > 0 ? '#b45309' : '#15803d' }}>
                      {stats.pendingReports}
                    </span>
                    <Link to="/health-reports" className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                      Xem &rarr;
                    </Link>
                  </div>
                </div>

                {/* Leaves Today */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <b style={{ color: '#0f172a' }}>🌴 Biến động cư dân trong ngày:</b>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>RLA-BR-01 tạm vắng & trở lại Tâm An</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0369a1' }}>
                      {stats.leavingToday} đi / {stats.returningToday} về
                    </span>
                    <Link to="/resident-leave" className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                      Xem &rarr;
                    </Link>
                  </div>
                </div>

                {/* Shift Checkins */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <b style={{ color: '#0f172a' }}>⏰ Nhân sự đang trong ca trực:</b>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Điểm danh ca sáng / chiều / đêm hôm nay</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#15803d' }}>
                      {stats.inProgressShifts} / {stats.todayShifts}
                    </span>
                    <Link to="/workforce" className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                      Ca kíp &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2: Resident Access Assignments Executive Summary */}
            <div className="card" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🛡️</span> Giám Sát Phân Công Nhân Sự Phụ Trách
                </h3>
                <span className="badge badge-info" style={{ fontWeight: 700 }}>
                  {stats.activeAssignmentsCount} Phân Công
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.85rem' }}>
                Hiện có <b style={{ color: '#166534' }}>{stats.assignedStaffCount} nhân sự</b> (Điều dưỡng & Chăm sóc viên) đang được Ban Giám đốc phân công theo dõi và chăm sóc cư dân.
              </div>

              {/* Mini Summary Box */}
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  <span>Phân công hiệu lực:</span>
                  <b style={{ color: '#15803d' }}>{stats.activeAssignmentsCount} lượt</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  <span>Nhân sự có phân công:</span>
                  <b style={{ color: '#0369a1' }}>{stats.assignedStaffCount} người</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span>Tỷ lệ bao phủ chăm sóc:</span>
                  <b style={{ color: '#166534' }}>100% người cao tuổi</b>
                </div>
              </div>

              <Link
                to="/staff-access"
                className="btn btn-primary"
                style={{ width: '100%', textAlign: 'center', display: 'block', fontSize: '0.85rem', fontWeight: 700 }}
              >
                👥 Quản Lý Phân Công & Cấp Tài Khoản &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Domain Quick Overview & Access Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {isCaregiver ? (
          <>
            {/* Caregiver Card 1: Danh Sách NCT Do Bạn Phụ Trách */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>🤲 Danh Sách NCT Do Bạn Phụ Trách</h3>
                  <span className="badge badge-success">{myAssignedResidentRows.length} Cụ</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Danh sách người cao tuổi bạn được phân quyền phụ trách chăm sóc trực tiếp y khoa và sinh hoạt.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  {myAssignedResidentRows.slice(0, 3).map(r => (
                    <div key={r.resident.residentId} style={{ marginBottom: '0.2rem' }}>
                      • <b>{r.resident.displayName}</b> — Phòng {r.resident.room} (Giường {r.resident.bed})
                    </div>
                  ))}
                  {myAssignedResidentRows.length > 3 && (
                    <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>...và {myAssignedResidentRows.length - 3} cụ khác</div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/residents" className="btn btn-sm btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Vào không gian chăm sóc &rarr;
                </Link>
              </div>
            </div>

            {/* Caregiver Card 2: Lịch trực của tôi */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>⏰ Ca Trực & Bàn Giao Của Bạn</h3>
                  <span className="badge badge-purple">Ca Trực Y Khoa</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Điểm danh vào ca trực, thực hiện bàn giao ca chuẩn y khoa và ký nhận bàn giao từ ca trước.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Trạng thái trực: <b>{myShifts.length > 0 ? (myShifts[0].status === 'IN_PROGRESS' ? 'Đang trong ca' : 'Đã phân ca') : 'Chưa xếp ca'}</b></div>
                  <div>• Bàn giao ca: <b>Có ghi chú cảnh báo</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/workforce" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Xem lịch trực & Bàn giao ca &rarr;
                </Link>
              </div>
            </div>

            {/* Caregiver Card 3: Nhật ký vận hành chăm sóc */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>🩺 Vận Hành Chăm Sóc Hàng Ngày</h3>
                  <span className="badge badge-info">Nhật Ký ADL</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Ghi nhận hoạt động ăn uống, tắm giặt, thay bỉm, trở mình, uống thuốc và chăm sóc hỗ trợ người cao tuổi.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Hoạt động chăm sóc: <b>Ghi nhận theo ca</b></div>
                  <div>• Minh bạch bằng chứng: <b>Tự động lưu vết</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/operations" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Ghi nhận công việc ca trực &rarr;
                </Link>
              </div>
            </div>
          </>
        ) : isNutritionist ? (
          <>
            {/* Nutritionist Card 1: Suất Ăn & Thực Đơn */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>🥗 Suất Ăn & Thực Đơn Dinh Dưỡng</h3>
                  <span className="badge badge-success">Bếp & Suất Ăn</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Theo dõi số lượng người cao tuổi tại Tâm An cần chuẩn bị suất ăn, dạng chế biến đặc biệt và kiêng khem y khoa.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Dạng chế biến: <b>Cơm mềm, nấu nhừ, xay nhuyễn, Sonde</b></div>
                  <div>• Tiếp nhận cập nhật: <b>Từ NV Chăm sóc phụ trách</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/operations" className="btn btn-sm btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Bảng điều phối dinh dưỡng &rarr;
                </Link>
              </div>
            </div>

            {/* Nutritionist Card 2: Lịch Trực Ca Kíp */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>⏰ Lịch Trực & Ca Kíp Của Bạn</h3>
                  <span className="badge badge-purple">Ca Trực Bếp</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Theo dõi ca kíp phân công, điểm danh vào ca và bàn giao công việc bộ phận dinh dưỡng / bếp.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Trạng thái trực: <b>{myShifts.length > 0 ? (myShifts[0].status === 'IN_PROGRESS' ? 'Đang trong ca' : 'Đã phân ca') : 'Chưa xếp ca'}</b></div>
                  <div>• Lịch ca kíp: <b>Tự quản lý & chủ động</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/workforce" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Xem lịch trực ca kíp &rarr;
                </Link>
              </div>
            </div>

            {/* Nutritionist Card 3: Nhật Ký Khẩu Phần */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>📋 Vận Hành Chăm Sóc Dinh Dưỡng</h3>
                  <span className="badge badge-info">Khẩu Phần Ăn</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Ghi nhận hoạt động chế biến, phân phát suất ăn, cữ sữa bổ sung và đối soát dữ liệu báo cáo theo ngày.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Chế độ dinh dưỡng: <b>Theo dõi theo ngày</b></div>
                  <div>• Nhu cầu đặc biệt: <b>Cập nhật tức thời</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/operations" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Xem nhật ký vận hành &rarr;
                </Link>
              </div>
            </div>
          </>
        ) : isSocialWorker ? (
          <>
            {/* Social Worker Card 1: Tiếp Nhận */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>📝 Tiếp Nhận & Khảo Sát Ban Đầu</h3>
                  <span className="badge badge-info">Tiếp Nhận NCT</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Quy trình tiếp nhận hồ sơ ban đầu, khảo sát hoàn cảnh gia đình, tâm lý xã hội và thủ tục vào Tâm An.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Khảo sát hoàn cảnh & người bảo hộ: <b>Đầy đủ</b></div>
                  <div>• Đề xuất mức độ chăm sóc: <b>Cấp 1 / 2 / 3</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/admissions" className="btn btn-sm btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Hồ sơ tiếp nhận & đánh giá &rarr;
                </Link>
              </div>
            </div>

            {/* Social Worker Card 2: Lịch Trực */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>⏰ Lịch Trực & Ca Kíp Của Bạn</h3>
                  <span className="badge badge-purple">Lịch Làm Việc</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Theo dõi lịch phân công công tác xã hội, điểm danh vào ca và bàn giao công việc theo phân công.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Trạng thái trực: <b>{myShifts.length > 0 ? (myShifts[0].status === 'IN_PROGRESS' ? 'Đang trong ca' : 'Đã phân ca') : 'Chưa xếp ca'}</b></div>
                  <div>• Lịch ca kíp: <b>Tự quản lý & chủ động</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/workforce" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Xem lịch trực ca kíp &rarr;
                </Link>
              </div>
            </div>

            {/* Social Worker Card 3: Nghỉ phép & Tạm vắng */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>✈️ Nghỉ Phép & Tạm Vắng</h3>
                  <span className="badge badge-warning">Tạm Vắng</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Tiếp nhận và theo dõi các trường hợp người cao tuổi xin nghỉ phép, tạm vắng về thăm gia đình hoặc đi khám bệnh bên ngoài.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Đang tạm vắng hôm nay: <b>{stats.activeLeaves} cụ</b></div>
                  <div>• Trạng thái: <b>Có báo trước hợp lệ</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/resident-leave" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Danh sách nghỉ phép & tạm vắng &rarr;
                </Link>
              </div>
            </div>
          </>
        ) : isRehab ? (
          <>
            {/* Rehab Card 1: Phục hồi chức năng */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>💪 Vật Lý Trị Liệu & Phục Hồi</h3>
                  <span className="badge badge-success">Phục Hồi Chức Năng</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Thực hiện các bài tập vận động, vật lý trị liệu, phục hồi chức năng và ghi nhận tiến trình cải thiện thể chất của các cụ.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Trị liệu cá nhân hóa: <b>Tập vận động, phục hồi cơ khớp</b></div>
                  <div>• Nhật ký chuyên môn: <b>Lưu vết theo ca tập</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/operations" className="btn btn-sm btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Ghi nhận ca tập phục hồi &rarr;
                </Link>
              </div>
            </div>

            {/* Rehab Card 2: Lịch Trực */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>⏰ Lịch Trực & Ca Kíp Của Bạn</h3>
                  <span className="badge badge-purple">Lịch Tập Luyện</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Theo dõi lịch ca trực trị liệu, khung giờ hướng dẫn tập luyện cho người cao tuổi theo phân công.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Trạng thái trực: <b>{myShifts.length > 0 ? (myShifts[0].status === 'IN_PROGRESS' ? 'Đang trong ca' : 'Đã phân ca') : 'Chưa xếp ca'}</b></div>
                  <div>• Lịch ca kíp: <b>Tự quản lý & chủ động</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/workforce" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Xem lịch trực ca kíp &rarr;
                </Link>
              </div>
            </div>

            {/* Rehab Card 3: Người cao tuổi */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>👥 Danh Sách Người Cao Tuổi</h3>
                  <span className="badge badge-info">{stats.activeResidents} Cụ</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Tra cứu hồ sơ thể trạng, mức độ vận động ADL và phác đồ tập luyện của từng cụ tại các phòng.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Tổng số người cao tuổi: <b>{stats.activeResidents} cụ</b></div>
                  <div>• Đang tạm vắng: <b>{stats.activeLeaves} cụ</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/residents" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Danh sách người cao tuổi &rarr;
                </Link>
              </div>
            </div>
          </>
        ) : isPsychologist ? (
          <>
            {/* Psychologist Card 1: Tham vấn tâm lý */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>🧠 Tham Vấn Tâm Lý & Trí Não</h3>
                  <span className="badge badge-purple">Tâm Lý & Trí Tuệ</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Đánh giá nhận thức (MMSE), trị liệu tinh thần, giải tỏa lo âu trầm cảm và hỗ trợ tâm lý chuyên sâu cho người cao tuổi.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Liệu trình tâm lý: <b>Trò chuyện & trị liệu tinh thần</b></div>
                  <div>• Theo dõi sa sút trí tuệ: <b>Định kỳ hàng tháng</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/operations" className="btn btn-sm btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Ghi nhận ca tham vấn &rarr;
                </Link>
              </div>
            </div>

            {/* Psychologist Card 2: Lịch trực ca kíp */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>⏰ Lịch Trực & Ca Kíp Của Bạn</h3>
                  <span className="badge badge-purple">Lịch Tham Vấn</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Theo dõi lịch ca trực tham vấn, khung giờ hỗ trợ tâm lý người cao tuổi theo kế hoạch phân công.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Trạng thái trực: <b>{myShifts.length > 0 ? (myShifts[0].status === 'IN_PROGRESS' ? 'Đang trong ca' : 'Đã phân ca') : 'Chưa xếp ca'}</b></div>
                  <div>• Lịch ca kíp: <b>Tự quản lý & chủ động</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/workforce" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Xem lịch trực ca kíp &rarr;
                </Link>
              </div>
            </div>

            {/* Psychologist Card 3: Người cao tuổi */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>👥 Danh Sách Người Cao Tuổi</h3>
                  <span className="badge badge-info">{stats.activeResidents} Cụ</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Tra cứu tình trạng nhận thức, hành vi và mức độ hòa nhập cộng đồng của các cụ tại Trung tâm.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Tổng số người cao tuổi: <b>{stats.activeResidents} cụ</b></div>
                  <div>• Đang tạm vắng: <b>{stats.activeLeaves} cụ</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/residents" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Danh sách người cao tuổi &rarr;
                </Link>
              </div>
            </div>
          </>
        ) : (
          /* Default Management & Clinical Staff Cards */
          <>
            {/* Management Card 1: Phòng & Giường */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>🏢 Sơ Đồ Phòng & Giường</h3>
                  <span className="badge badge-info">110 Giường</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Quản lý phân bổ 1 toà nhà 4 tầng, 29 phòng chăm sóc (110 giường). Tự động kiểm tra xung đột giới tính và sức chứa.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Đang sử dụng: <b>{stats.accomSummary.occupied} giường</b></div>
                  <div>• Giường trống sẵn sàng: <b>{stats.accomSummary.available} giường</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/accommodation" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Xem sơ đồ trực quan &rarr;
                </Link>
              </div>
            </div>

            {/* Management Card 2: Lịch Trực & Bàn Giao Ca */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>⏰ Lịch Trực & Ca Kíp</h3>
                  <span className="badge badge-purple">Toàn Trung Tâm</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                  Phân ca 3 ca trực y khoa (Ca sáng 06:00, Ca chiều 14:00, Ca đêm 22:00) kèm biên bản bàn giao ca có cảnh báo.
                </p>
                <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  <div>• Tổng ca trực hôm nay: <b>{stats.todayShifts} ca</b></div>
                  <div>• Đang trong ca trực: <b>{stats.inProgressShifts} nhân viên</b></div>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/workforce" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                  Xem lịch trực & bàn giao ca &rarr;
                </Link>
              </div>
            </div>

            {/* Management Card 3: Báo Cáo Sức Khỏe Chuẩn Y Khoa (Chỉ hiển thị cho Ban Giám Đốc, Quản lý, Nhân viên y tế) */}
            {isClinicalOrManagement ? (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>🩺 Phiếu Đánh Giá Sức Khỏe</h3>
                    <span className="badge badge-success">{stats.approvedReports} Đã duyệt</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                    Phiếu đánh giá định kỳ 3 trang chuẩn y khoa: sinh tồn, glucose, ADL, sa sút trí tuệ, dặn dò chăm sóc và in PDF A4.
                  </p>
                  <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                    <div>• Tổng số phiếu đã lập: <b>{reportsData?.length ?? 0} phiếu</b></div>
                    <div>• Đã phê duyệt chuyên môn: <b>{stats.approvedReports} phiếu</b></div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <Link to="/health-reports" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                    Lập & In phiếu đánh giá &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1d2a23' }}>👥 Danh Sách Người Cao Tuổi</h3>
                    <span className="badge badge-info">{stats.activeResidents} Cụ</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: '#607067', margin: '0 0 1rem 0' }}>
                    Tra cứu thông tin người cao tuổi đang lưu trú và thụ hưởng dịch vụ chăm sóc tại Tâm An.
                  </p>
                  <div style={{ background: '#f8faf8', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                    <div>• Đang lưu trú: <b>{stats.activeResidents} cụ</b></div>
                    <div>• Tạm vắng: <b>{stats.activeLeaves} cụ</b></div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <Link to="/residents" className="btn btn-sm btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                    Xem danh sách người cao tuổi &rarr;
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Daily Nutrition & Meal Management Board (Only for: SUPERVISOR, CARE_MANAGER, CAREGIVER, NURSE, NUTRITIONIST) */}
      {canAccessNutrition && (
        <div style={{ marginBottom: '1.5rem' }}>
          <NutritionBoard />
        </div>
      )}
    </div>
  );
}
