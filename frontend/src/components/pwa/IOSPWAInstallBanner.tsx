import React, { useState, useEffect } from 'react';

export function IOSPWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    // Check if running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Check if user previously dismissed banner in this session
    const dismissed = sessionStorage.getItem('ios_pwa_banner_dismissed');

    if (isIOS && !isStandalone && !dismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('ios_pwa_banner_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Top Banner for iOS Safari */}
      <div
        className="ios-pwa-banner"
        style={{
          background: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
          color: '#ffffff',
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontSize: '0.82rem',
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.65rem)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <img
              src="/branding/tam-an-logo-master.png"
              alt="Tâm An"
              style={{ width: '22px', height: '22px', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, lineHeight: 1.2 }}>Thêm Tâm An Care vào Màn hình chính</div>
            <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>
              Trải nghiệm ứng dụng mượt mà không cần qua App Store
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              background: '#ffffff',
              color: '#166534',
              border: 'none',
              borderRadius: '6px',
              padding: '0.35rem 0.65rem',
              fontWeight: 700,
              fontSize: '0.76rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            Hướng dẫn
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      </div>

      {/* iOS Installation Instructions Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 99999,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              maxWidth: '520px',
              width: '100%',
              padding: '1.25rem 1.25rem calc(env(safe-area-inset-bottom, 0px) + 1.25rem) 1.25rem',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.2)',
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                background: '#cbd5e1',
                borderRadius: '2px',
                margin: '0 auto 0.75rem auto',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📱</span> Thêm vào Màn hình chính iOS
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5 }}>
              <p style={{ marginTop: 0, marginBottom: '0.85rem' }}>
                Để cài đặt <b>Tâm An Care</b> chạy full-screen mượt mà trên iPhone/iPad:
              </p>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.85rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', fontWeight: 700, color: '#166534' }}>
                  <span style={{ fontSize: '1.2rem' }}>1️⃣</span>
                  <span>Nhấn vào nút Chia sẻ (Share)</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', paddingLeft: '1.8rem' }}>
                  Tìm biểu tượng ô vuông có mũi tên chỉ lên <b>( Share ⎋ )</b> ở thanh công cụ dưới cùng Safari.
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.85rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', fontWeight: 700, color: '#166534' }}>
                  <span style={{ fontSize: '1.2rem' }}>2️⃣</span>
                  <span>Chọn "Thêm vào Màn hình chính"</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', paddingLeft: '1.8rem' }}>
                  Cuộn xuống danh sách tùy chọn và nhấn <b>"Add to Home Screen ➕"</b>.
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.85rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', fontWeight: 700, color: '#166534' }}>
                  <span style={{ fontSize: '1.2rem' }}>3️⃣</span>
                  <span>Xác nhận Thêm (Add)</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', paddingLeft: '1.8rem' }}>
                  Nhấn <b>Thêm</b> ở góc trên phải. Biểu tượng Tâm An Care sẽ xuất hiện ngay ngoài màn hình chính.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              style={{
                width: '100%',
                padding: '0.7rem',
                background: '#166534',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.6rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Đã hiểu & Tiếp tục
            </button>
          </div>
        </div>
      )}
    </>
  );
}
