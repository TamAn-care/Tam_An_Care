import React, { useState, useEffect } from 'react';

export type ActionCategory = 
  | 'meds' 
  | 'meals' 
  | 'vitals' 
  | 'hygiene' 
  | 'health' 
  | 'voice' 
  | 'incident' 
  | 'residents' 
  | null;

interface OneTapActionSheetProps {
  category: ActionCategory;
  onClose: () => void;
  actorName?: string;
}

export function OneTapActionSheet({ category, onClose, actorName = 'Điều dưỡng' }: OneTapActionSheetProps) {
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');

  useEffect(() => {
    // Reset state when category changes
    setCompletedItems({});
    setFeedbackMsg(null);
    setIsRecording(false);
    setTranscriptText('');
  }, [category]);

  if (!category) return null;

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  const handleToggleItem = (id: string, name: string) => {
    setCompletedItems((prev) => {
      const nextState = !prev[id];
      if (nextState) {
        showToast(`✓ Đã xác nhận cho ${name}`);
      }
      return { ...prev, [id]: nextState };
    });
  };

  const startVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscriptText((prev) => (prev ? prev + ' ' + text : text));
        setIsRecording(false);
        showToast('✓ Đã ghi nhận giọng nói!');
      };

      recognition.onerror = () => {
        setIsRecording(false);
        showToast('⚠️ Không thể nhận diện giọng nói, hãy thử lại');
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } else {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setTranscriptText((prev) => (prev ? prev + ' (Đang xem xét)' : 'Cụ tỉnh táo, ăn ngon miệng, các chỉ số bình thường.'));
        showToast('✓ Đã mô phỏng thu âm giọng nói!');
      }, 2000);
    }
  };

  const getSheetHeader = () => {
    switch (category) {
      case 'meds':
        return { title: '💊 Uống Thuốc 1-Chạm', subtitle: 'Danh sách Cụ cần cho uống thuốc ca này' };
      case 'meals':
        return { title: '🥣 Đánh Giá Bữa Ăn 1-Chạm', subtitle: 'Chọn nhanh mức độ hoàn thành khẩu phần' };
      case 'vitals':
        return { title: '🩺 Đo Sinh Hiệu 1-Chạm', subtitle: 'Ghi nhận Huyết áp, SpO2 & Thân nhiệt' };
      case 'hygiene':
        return { title: '🚿 Tắm & Vệ Sinh', subtitle: 'Đánh giá hỗ trợ vệ sinh cá nhân' };
      case 'health':
        return { title: '😀 Đánh Giá Sức Khỏe / Cảm Xúc', subtitle: 'Ghi nhận nhanh tâm lý & thể trạng' };
      case 'voice':
        return { title: '🎙️ Ghi Âm Giọng Nói Nhanh', subtitle: 'Chuyển lời nói trực tiếp thành văn bản ghi chú' };
      case 'incident':
        return { title: '🚨 Báo Cáo Sự Cố Nhanh', subtitle: 'Gửi cảnh báo khẩn cấp tới Quản lý' };
      case 'residents':
        return { title: '👵 Danh Sách Cư Dân Theo Ca', subtitle: 'Thông tin nhanh các Cụ đang phụ trách' };
      default:
        return { title: 'Thao tác 1-Chạm', subtitle: 'Lựa chọn nhanh cho nhân viên' };
    }
  };

  const headerInfo = getSheetHeader();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end transition-opacity duration-200">
      <div className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col relative animate-in slide-in-from-bottom duration-300">
        
        {/* Feedback Toast */}
        {feedbackMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-10 flex items-center gap-1.5 animate-bounce">
            <span>⚡</span>
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Sheet Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4 cursor-pointer" onClick={onClose}></div>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">CHĂM SÓC NÀY THỰC HIỆN BỞI {actorName.toUpperCase()}</span>
            <h3 className="text-lg font-extrabold text-slate-800">{headerInfo.title}</h3>
            <p className="text-xs text-slate-500">{headerInfo.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 font-bold text-base flex items-center justify-center hover:bg-slate-200 active:scale-95 transition"
          >
            ✕
          </button>
        </div>

        {/* Dynamic Content */}
        <div className="space-y-3.5">
          
          {/* UỐNG THUỐC */}
          {category === 'meds' && (
            <>
              {[
                { id: 'res-1', name: 'Cụ Nguyễn Thị Mai', room: 'Phòng 201 • Giường A', med: 'Thuốc Huyết áp (1 Viên)' },
                { id: 'res-2', name: 'Cụ Trần Văn Bình', room: 'Phòng 203 • Giường B', med: 'Thuốc Bổ não (2 Viên)' },
                { id: 'res-3', name: 'Cụ Lê Hoàng Nam', room: 'Phòng 205 • Giường A', med: 'Thuốc Tiểu đường (1 Viên)' },
              ].map((res) => {
                const isDone = completedItems[res.id];
                return (
                  <div key={res.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold">
                        {res.name.includes('Nguyễn') ? '👵' : '👴'}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-800">{res.name}</div>
                        <div className="text-xs text-slate-500">{res.room}</div>
                        <div className="text-[11px] font-semibold text-blue-700 mt-0.5">💊 {res.med}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleItem(res.id, res.name)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'
                      }`}
                    >
                      {isDone ? '✓ ĐÃ UỐNG' : '1-CHẠM'}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* BỮA ĂN */}
          {category === 'meals' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-600">Chọn Cụ & Mức độ ăn:</div>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => showToast('✓ Đã ghi nhận: Ăn hết 100%')}
                  className="p-3.5 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-center active:scale-95 transition hover:bg-emerald-100 shadow-sm"
                >
                  <div className="text-3xl">🥣</div>
                  <div className="text-xs font-bold text-emerald-900 mt-1">Ăn hết 100%</div>
                  <span className="text-[10px] text-emerald-700">Chạm chọn</span>
                </button>
                <button
                  type="button"
                  onClick={() => showToast('✓ Đã ghi nhận: Ăn được 50%')}
                  className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-2xl text-center active:scale-95 transition hover:bg-amber-100 shadow-sm"
                >
                  <div className="text-3xl">🍲</div>
                  <div className="text-xs font-bold text-amber-900 mt-1">Ăn 50%</div>
                  <span className="text-[10px] text-amber-700">Chạm chọn</span>
                </button>
                <button
                  type="button"
                  onClick={() => showToast('⚠️ Đã báo cáo: Bỏ Bữa')}
                  className="p-3.5 bg-red-50 border-2 border-red-400 rounded-2xl text-center active:scale-95 transition hover:bg-red-100 shadow-sm"
                >
                  <div className="text-3xl">❌</div>
                  <div className="text-xs font-bold text-red-900 mt-1">Bỏ Bữa</div>
                  <span className="text-[10px] text-red-700">Cảnh báo</span>
                </button>
              </div>
            </div>
          )}

          {/* DO SINH HIỆU */}
          {category === 'vitals' && (
            <div className="space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-800">Cụ Nguyễn Thị Mai</div>
                  <div className="text-xs text-rose-700">Huyết áp bình thường: 120/80 mmHg</div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('✓ Đã lưu chỉ số Huyết áp 120/80')}
                  className="px-4 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl active:scale-95"
                >
                  1-CHẠM CHUẨN
                </button>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-800">Cụ Trần Văn Bình</div>
                  <div className="text-xs text-rose-700">SpO2: 98% • Nhịp tim: 75 bpm</div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('✓ Đã lưu SpO2 98%')}
                  className="px-4 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl active:scale-95"
                >
                  1-CHẠM CHUẨN
                </button>
              </div>
            </div>
          )}

          {/* CẢM XÚC SỨC KHỎE */}
          {category === 'health' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-600">Đánh giá nhanh trạng thái tinh thần của Cụ hôm nay:</div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => showToast('✓ Đã ghi nhận: Tinh thần Tốt 😀')}
                  className="p-4 bg-green-50 border-2 border-green-500 rounded-2xl text-center active:scale-95 transition"
                >
                  <div className="text-4xl">😀</div>
                  <div className="text-xs font-extrabold text-green-800 mt-2">Vui Vẻ / Tốt</div>
                </button>
                <button
                  type="button"
                  onClick={() => showToast('✓ Đã ghi nhận: Bình thường 😐')}
                  className="p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-center active:scale-95 transition"
                >
                  <div className="text-4xl">😐</div>
                  <div className="text-xs font-extrabold text-slate-700 mt-2">Bình Thường</div>
                </button>
                <button
                  type="button"
                  onClick={() => showToast('⚠️ Đã báo cáo: Mệt mỏi 🙁')}
                  className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl text-center active:scale-95 transition"
                >
                  <div className="text-4xl">🙁</div>
                  <div className="text-xs font-extrabold text-rose-800 mt-2">Mệt / Đau</div>
                </button>
              </div>
            </div>
          )}

          {/* GHI ÂM GIỌNG NÓI */}
          {category === 'voice' && (
            <div className="text-center py-4 space-y-4">
              <button
                type="button"
                onClick={startVoiceRecording}
                className={`w-20 h-20 rounded-full text-3xl font-bold mx-auto flex items-center justify-center shadow-lg transition-all ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse ring-8 ring-red-200'
                    : 'bg-purple-600 text-white active:scale-95 hover:bg-purple-700'
                }`}
              >
                🎙️
              </button>
              <div className="text-xs font-bold text-purple-800">
                {isRecording ? '🔴 Đang lắng nghe... Hãy nói trực tiếp' : 'Bấm vào Micro để bắt đầu nói'}
              </div>

              {transcriptText && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-left text-xs text-purple-900 font-medium">
                  <strong>Văn bản ghi nhận:</strong> "{transcriptText}"
                </div>
              )}
            </div>
          )}

          {/* BÁO SỰ CỐ */}
          {category === 'incident' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-red-600">Chọn loại sự cố khẩn cấp:</div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => showToast('🚨 Đã phát cảnh báo: NỐT MẪN / DỊ ỨNG')}
                  className="p-3.5 bg-red-50 border border-red-300 rounded-2xl text-left font-bold text-xs text-red-800 active:scale-95"
                >
                  ⚠️ Dị Ứng / Nổi Mẩn
                </button>
                <button
                  type="button"
                  onClick={() => showToast('🚨 Đã phát cảnh báo: TÉ NGÃ')}
                  className="p-3.5 bg-red-50 border border-red-300 rounded-2xl text-left font-bold text-xs text-red-800 active:scale-95"
                >
                  🚨 Trượt / Té Ngã
                </button>
                <button
                  type="button"
                  onClick={() => showToast('🚨 Đã phát cảnh báo: SỐT CAO')}
                  className="p-3.5 bg-red-50 border border-red-300 rounded-2xl text-left font-bold text-xs text-red-800 active:scale-95"
                >
                  🌡️ Sốt Cao Trên 38.5°C
                </button>
                <button
                  type="button"
                  onClick={() => showToast('🚨 Đã phát cảnh báo: KHÓ THỞ')}
                  className="p-3.5 bg-red-50 border border-red-300 rounded-2xl text-left font-bold text-xs text-red-800 active:scale-95"
                >
                  🫁 Khó Thở / Đau Ngực
                </button>
              </div>
            </div>
          )}

          {/* TẮM VỆ SINH & DANH SÁCH CƯ DÂN */}
          {(category === 'hygiene' || category === 'residents') && (
            <div className="space-y-2.5">
              {[
                { name: 'Cụ Nguyễn Thị Mai', room: 'Phòng 201' },
                { name: 'Cụ Trần Văn Bình', room: 'Phòng 203' },
                { name: 'Cụ Lê Hoàng Nam', room: 'Phòng 205' },
              ].map((c, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                  <div>
                    <div className="font-bold text-xs text-slate-800">{c.name}</div>
                    <div className="text-[11px] text-slate-500">{c.room}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast(`✓ Đã hoàn thành vệ sinh cho ${c.name}`)}
                    className="px-3 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl active:scale-95"
                  >
                    1-CHẠM HOÀN THÀNH
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer Action */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl text-xs transition active:scale-98 shadow-md"
          >
            ĐÓNG MÀN HÌNH CHĂM SÓC
          </button>
        </div>
      </div>
    </div>
  );
}
