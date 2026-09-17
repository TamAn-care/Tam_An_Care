import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActor } from '../../auth/ActorContext';
import { ROLE_LABELS } from '../../auth/role-policy';
import { OneTapActionSheet, ActionCategory } from './OneTapActionSheet';

export function MobileLauncherPage() {
  const { actor } = useActor();
  const navigate = useNavigate();

  const actorRole = actor?.actorRole;
  const actorName = actor?.displayName || 'Nhân viên';
  const roleLabel = (actorRole && ROLE_LABELS[actorRole]) || 'Điều dưỡng viên';

  const [activeCategory, setActiveCategory] = useState<ActionCategory>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'care' | 'medical' | 'admin'>('all');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col pb-24 font-sans select-none">
      
      {/* iOS App Top Header / Status Bar Bar */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white pt-4 pb-5 px-4 rounded-b-[28px] shadow-lg border-b border-slate-700">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-2xl shadow-inner backdrop-blur">
              👩‍⚕️
            </div>
            <div>
              <div className="text-[11px] font-semibold text-emerald-400 tracking-wide">TÂM AN CARE • {roleLabel.toUpperCase()}</div>
              <div className="text-base font-black text-white leading-tight">{actorName}</div>
            </div>
          </div>

          <div className="bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 backdrop-blur">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Ca Sáng</span>
          </div>
        </div>

        {/* Search / Filter Bar iPhone Style */}
        <div className="max-w-md mx-auto mt-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 flex items-center border border-white/15 text-xs font-bold text-slate-300">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 rounded-xl transition-all ${
                activeTab === 'all' ? 'bg-white text-slate-900 shadow-md font-extrabold' : 'hover:text-white'
              }`}
            >
              Tất Cả Icons
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('care')}
              className={`flex-1 py-1.5 rounded-xl transition-all ${
                activeTab === 'care' ? 'bg-white text-slate-900 shadow-md font-extrabold' : 'hover:text-white'
              }`}
            >
              🟢 Chăm Sóc
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('medical')}
              className={`flex-1 py-1.5 rounded-xl transition-all ${
                activeTab === 'medical' ? 'bg-white text-slate-900 shadow-md font-extrabold' : 'hover:text-white'
              }`}
            >
              🔵 Y Tế
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-1.5 rounded-xl transition-all ${
                activeTab === 'admin' ? 'bg-white text-slate-900 shadow-md font-extrabold' : 'hover:text-white'
              }`}
            >
              🟠 Vận Hành
            </button>
          </div>
        </div>
      </div>

      {/* Main iPhone App Grid Section */}
      <div className="max-w-md mx-auto w-full px-4 pt-5 space-y-6 flex-1">
        
        {/* GROUP 1: CHĂM SÓC HÀNG NGÀY */}
        {(activeTab === 'all' || activeTab === 'care') && (
          <div>
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center justify-between">
              <span>Nghiệp vụ Chăm sóc hàng ngày</span>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">1-Chạm</span>
            </div>

            <div className="grid grid-cols-4 gap-3.5">
              
              {/* App 1: Uống Thuốc */}
              <div
                onClick={() => setActiveCategory('meds')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-md shadow-blue-500/20 border border-white/40 relative active:scale-90 transition-all">
                  💊
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow">
                    3
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-blue-600">
                  Uống Thuốc
                </span>
              </div>

              {/* App 2: Bữa Ăn */}
              <div
                onClick={() => setActiveCategory('meals')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-2xl shadow-md shadow-amber-500/20 border border-white/40 relative active:scale-90 transition-all">
                  🥣
                  <span className="absolute -top-1 -right-1 bg-emerald-400 text-emerald-950 text-[9px] font-black px-1 rounded-full border-2 border-white">
                    SÁNG
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-amber-600">
                  Bữa Ăn
                </span>
              </div>

              {/* App 3: Đo Sinh Hiệu */}
              <div
                onClick={() => setActiveCategory('vitals')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center text-2xl shadow-md shadow-rose-500/20 border border-white/40 relative active:scale-90 transition-all">
                  🩺
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    2
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-rose-600">
                  Đo Sinh Hiệu
                </span>
              </div>

              {/* App 4: Tắm Rửa */}
              <div
                onClick={() => setActiveCategory('hygiene')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center text-2xl shadow-md shadow-teal-500/20 border border-white/40 active:scale-90 transition-all">
                  🚿
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-teal-600">
                  Tắm & Vệ Sinh
                </span>
              </div>

              {/* App 5: Cảm Xúc */}
              <div
                onClick={() => setActiveCategory('health')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center text-2xl shadow-md shadow-cyan-500/20 border border-white/40 active:scale-90 transition-all">
                  😀
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-cyan-600">
                  Sức Khỏe Cụ
                </span>
              </div>

              {/* App 6: Ghi Âm Voice AI */}
              <div
                onClick={() => setActiveCategory('voice')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-purple-600 to-violet-700 text-white flex items-center justify-center text-2xl shadow-md shadow-purple-500/20 border border-white/40 relative active:scale-90 transition-all">
                  🎙️
                  <span className="absolute -top-1 -right-1 bg-purple-300 text-purple-950 text-[8px] font-black px-1 rounded-full border-2 border-white">
                    AI
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-purple-600">
                  Ghi Âm Nói
                </span>
              </div>

              {/* App 7: Vận Hành Chăm Sóc Chi Tiết */}
              <div
                onClick={() => navigate('/operations')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-emerald-600 to-green-700 text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-600/20 border border-white/40 active:scale-90 transition-all">
                  📋
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-emerald-700">
                  Bảng Chăm Sóc
                </span>
              </div>

              {/* App 8: Hồ Sơ Cư Dân */}
              <div
                onClick={() => navigate('/residents')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-amber-600 to-yellow-700 text-white flex items-center justify-center text-2xl shadow-md shadow-amber-600/20 border border-white/40 active:scale-90 transition-all">
                  👵
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-amber-700">
                  Cư Dân Tầng 2
                </span>
              </div>

            </div>
          </div>
        )}

        {/* GROUP 2: Y TẾ & CHUYÊN MÔN */}
        {(activeTab === 'all' || activeTab === 'medical') && (
          <div>
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3 px-1">
              Y tế & Khám bệnh chuyên môn
            </div>

            <div className="grid grid-cols-4 gap-3.5">
              
              {/* App 9: Báo Sự Cố */}
              <div
                onClick={() => setActiveCategory('incident')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center text-2xl shadow-md shadow-red-500/20 border border-white/40 active:scale-90 transition-all">
                  🚨
                </div>
                <span className="text-[11px] font-bold text-red-700 text-center leading-tight mt-1.5">
                  Báo Sự Cố
                </span>
              </div>

              {/* App 10: Báo Cáo Sức Khỏe */}
              <div
                onClick={() => navigate('/health-reports')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-2xl shadow-md shadow-sky-500/20 border border-white/40 active:scale-90 transition-all">
                  📊
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-sky-600">
                  Báo Cáo Y Tế
                </span>
              </div>

              {/* App 11: Dược eMAR Kho */}
              <div
                onClick={() => navigate('/medication-inventory')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl shadow-md shadow-indigo-500/20 border border-white/40 active:scale-90 transition-all">
                  💊
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-indigo-600">
                  Kho Dược eMAR
                </span>
              </div>

              {/* App 12: Tiếp Nhận Cụ Mới */}
              <div
                onClick={() => navigate('/admissions')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-500/20 border border-white/40 active:scale-90 transition-all">
                  📝
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-emerald-600">
                  Tiếp Nhận Mới
                </span>
              </div>

            </div>
          </div>
        )}

        {/* GROUP 3: VẬN HÀNH & HÀNH CHÍNH */}
        {(activeTab === 'all' || activeTab === 'admin') && (
          <div>
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3 px-1">
              Vận hành ca & Hành chính
            </div>

            <div className="grid grid-cols-4 gap-3.5">
              
              {/* App 13: Sơ Đồ Giường */}
              <div
                onClick={() => navigate('/accommodation')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-blue-600 to-slate-700 text-white flex items-center justify-center text-2xl shadow-md shadow-blue-600/20 border border-white/40 active:scale-90 transition-all">
                  🛌
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-blue-700">
                  Sơ Đồ Phòng
                </span>
              </div>

              {/* App 14: Lịch Trực Ca Kíp */}
              <div
                onClick={() => navigate('/workforce')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-violet-600 to-purple-800 text-white flex items-center justify-center text-2xl shadow-md shadow-violet-600/20 border border-white/40 active:scale-90 transition-all">
                  📅
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-violet-700">
                  Lịch Trực Ca
                </span>
              </div>

              {/* App 15: Xin Nghỉ Phép */}
              <div
                onClick={() => navigate('/resident-leave')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-amber-500 to-yellow-600 text-white flex items-center justify-center text-2xl shadow-md shadow-amber-500/20 border border-white/40 active:scale-90 transition-all">
                  🏖️
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-amber-600">
                  Xin Nghỉ Phép
                </span>
              </div>

              {/* App 16: Viện Phí */}
              <div
                onClick={() => navigate('/billing-invoicing')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-600/20 border border-white/40 active:scale-90 transition-all">
                  💳
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-emerald-700">
                  Viện Phí
                </span>
              </div>

              {/* App 17: Cổng Thân Nhân */}
              <div
                onClick={() => navigate('/family-portal')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-pink-500 to-rose-600 text-white flex items-center justify-center text-2xl shadow-md shadow-pink-500/20 border border-white/40 active:scale-90 transition-all">
                  👨‍👩‍👧
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-pink-600">
                  Thân Nhân
                </span>
              </div>

              {/* App 18: Bếp Ăn */}
              <div
                onClick={() => navigate('/kitchen-operations')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center text-2xl shadow-md shadow-orange-500/20 border border-white/40 active:scale-90 transition-all">
                  🍳
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-orange-600">
                  Bếp Dinh Dưỡng
                </span>
              </div>

              {/* App 19: Phân Tích KPI */}
              <div
                onClick={() => navigate('/analytics-intelligence')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-indigo-600 to-blue-800 text-white flex items-center justify-center text-2xl shadow-md shadow-indigo-600/20 border border-white/40 active:scale-90 transition-all">
                  📈
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-indigo-600">
                  Phân Tích KPI
                </span>
              </div>

              {/* App 20: Phân Quyền */}
              <div
                onClick={() => navigate('/staff-access')}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-2xl shadow-md shadow-slate-700/20 border border-white/40 active:scale-90 transition-all">
                  🔑
                </div>
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight mt-1.5 group-hover:text-slate-900">
                  Phân Quyền
                </span>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* 1-Tap Action Sheet Modal */}
      <OneTapActionSheet
        category={activeCategory}
        onClose={() => setActiveCategory(null)}
        actorName={actorName}
      />
    </div>
  );
}
