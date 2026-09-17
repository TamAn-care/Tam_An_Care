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

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-900 text-slate-100 flex flex-col pb-20">
      
      {/* iOS-Style Top Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-800 text-white p-4 shadow-lg border-b border-emerald-600/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur border border-white/30 flex items-center justify-center text-2xl font-bold shadow-inner">
              👩‍⚕️
            </div>
            <div>
              <div className="text-xs text-emerald-200 font-medium">Ca sáng • {roleLabel}</div>
              <div className="text-base font-extrabold leading-tight text-white">{actorName}</div>
            </div>
          </div>
          <div className="bg-emerald-950/50 border border-emerald-400/30 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-300 backdrop-blur flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Khu vực Tầng 2</span>
          </div>
        </div>
      </div>

      {/* Progress & Quick Stats Banner */}
      <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-300 font-semibold">
          <span className="text-base">⚡</span>
          <span>Tiến độ ca trực hôm nay:</span>
        </div>
        <div className="flex items-center space-x-2.5">
          <div className="w-28 bg-slate-700 h-2.5 rounded-full overflow-hidden border border-slate-600">
            <div className="bg-gradient-to-r from-emerald-500 to-green-400 h-full rounded-full transition-all duration-500" style={{ width: '80%' }}></div>
          </div>
          <span className="text-xs font-black text-emerald-400">80%</span>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 p-4 space-y-6 max-w-4xl mx-auto w-full">
        
        {/* Section 1: Thao Tác 1-Chạm Chính */}
        <div>
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">CHĂM SÓC 1-CHẠM (QUAN TRỌNG)</span>
            <span className="text-[11px] text-slate-400 font-medium">Chạm để mở</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3.5">
            
            {/* Icon 1: Uống thuốc */}
            <button
              type="button"
              onClick={() => setActiveCategory('meds')}
              className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-3.5 flex flex-col items-center justify-center relative shadow-lg active:scale-95 transition-all border border-blue-400/30 group"
            >
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[11px] font-extrabold w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-900 shadow">
                3
              </span>
              <div className="text-3xl mb-1 group-hover:scale-110 transition">💊</div>
              <span className="text-xs font-bold text-center leading-tight">Uống Thuốc</span>
              <span className="text-[10px] text-blue-200 opacity-90 mt-0.5 font-medium">Ca 08:00</span>
            </button>

            {/* Icon 2: Bữa ăn */}
            <button
              type="button"
              onClick={() => setActiveCategory('meals')}
              className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-3xl p-3.5 flex flex-col items-center justify-center relative shadow-lg active:scale-95 transition-all border border-amber-400/30 group"
            >
              <span className="absolute -top-1.5 -right-1.5 bg-amber-300 text-amber-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border-2 border-slate-900">
                SÁNG
              </span>
              <div className="text-3xl mb-1 group-hover:scale-110 transition">🥣</div>
              <span className="text-xs font-bold text-center leading-tight">Bữa Ăn</span>
              <span className="text-[10px] text-amber-100 opacity-90 mt-0.5 font-medium">Đã xong 12/15</span>
            </button>

            {/* Icon 3: Sinh hiệu */}
            <button
              type="button"
              onClick={() => setActiveCategory('vitals')}
              className="bg-gradient-to-br from-rose-600 to-red-700 text-white rounded-3xl p-3.5 flex flex-col items-center justify-center relative shadow-lg active:scale-95 transition-all border border-rose-400/30 group"
            >
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[11px] font-extrabold w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-900">
                2
              </span>
              <div className="text-3xl mb-1 group-hover:scale-110 transition">🩺</div>
              <span className="text-xs font-bold text-center leading-tight">Sinh Hiệu</span>
              <span className="text-[10px] text-rose-200 opacity-90 mt-0.5 font-medium">Huyết áp, SpO2</span>
            </button>

            {/* Icon 4: Tắm rửa */}
            <button
              type="button"
              onClick={() => setActiveCategory('hygiene')}
              className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white rounded-3xl p-3.5 flex flex-col items-center justify-center relative shadow-lg active:scale-95 transition-all border border-teal-400/30 group"
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition">🚿</div>
              <span className="text-xs font-bold text-center leading-tight">Vệ Sinh</span>
              <span className="text-[10px] text-teal-200 opacity-90 mt-0.5 font-medium">Tắm rửa & Vệ sinh</span>
            </button>

            {/* Icon 5: Cảm xúc / Sức khỏe */}
            <button
              type="button"
              onClick={() => setActiveCategory('health')}
              className="bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-3xl p-3.5 flex flex-col items-center justify-center relative shadow-lg active:scale-95 transition-all border border-cyan-400/30 group"
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition">😀</div>
              <span className="text-xs font-bold text-center leading-tight">Sức Khỏe</span>
              <span className="text-[10px] text-cyan-200 opacity-90 mt-0.5 font-medium">Cảm xúc Cụ</span>
            </button>

            {/* Icon 6: Thu âm AI */}
            <button
              type="button"
              onClick={() => setActiveCategory('voice')}
              className="bg-gradient-to-br from-purple-600 to-violet-700 text-white rounded-3xl p-3.5 flex flex-col items-center justify-center relative shadow-lg active:scale-95 transition-all border border-purple-400/30 group"
            >
              <span className="absolute -top-1.5 -right-1.5 bg-purple-300 text-purple-950 text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-slate-900">
                VOICE
              </span>
              <div className="text-3xl mb-1 group-hover:scale-110 transition">🎙️</div>
              <span className="text-xs font-bold text-center leading-tight">Ghi Âm Nhanh</span>
              <span className="text-[10px] text-purple-200 opacity-90 mt-0.5 font-medium">Nói là ghi</span>
            </button>
          </div>
        </div>

        {/* Section 2: Vận hành & Tra cứu nhanh */}
        <div>
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">VẬN HÀNH CA & HỒ SƠ</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3.5">
            
            {/* Icon 7: Báo sự cố */}
            <button
              type="button"
              onClick={() => setActiveCategory('incident')}
              className="bg-slate-800 text-red-400 border border-red-500/40 rounded-3xl p-3.5 flex flex-col items-center justify-center shadow active:scale-95 transition group"
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition">🚨</div>
              <span className="text-xs font-bold text-center leading-tight text-slate-100">Báo Sự Cố</span>
              <span className="text-[10px] text-red-400 font-semibold mt-0.5">Khẩn cấp</span>
            </button>

            {/* Icon 8: Cư dân */}
            <button
              type="button"
              onClick={() => navigate('/residents')}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-3xl p-3.5 flex flex-col items-center justify-center shadow active:scale-95 transition group"
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition">👵</div>
              <span className="text-xs font-bold text-center leading-tight text-slate-100">Cư Dân Tầng 2</span>
              <span className="text-[10px] text-slate-400 mt-0.5">15 Cụ</span>
            </button>

            {/* Icon 9: Sơ đồ phòng */}
            <button
              type="button"
              onClick={() => navigate('/accommodation')}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-3xl p-3.5 flex flex-col items-center justify-center shadow active:scale-95 transition group"
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition">🛌</div>
              <span className="text-xs font-bold text-center leading-tight text-slate-100">Sơ Đồ Phòng</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Phòng & Giường</span>
            </button>

            {/* Icon 10: Xem trang Vận Hành Chăm Sóc Full */}
            <button
              type="button"
              onClick={() => navigate('/operations')}
              className="bg-slate-800 text-emerald-400 border border-emerald-500/40 rounded-3xl p-3.5 flex flex-col items-center justify-center shadow active:scale-95 transition group"
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition">📊</div>
              <span className="text-xs font-bold text-center leading-tight text-slate-100">Vận Hành Chi Tiết</span>
              <span className="text-[10px] text-emerald-400 mt-0.5">Bảng đầy đủ</span>
            </button>
          </div>
        </div>

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
