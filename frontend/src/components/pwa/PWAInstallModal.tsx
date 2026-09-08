import React, { useState, useEffect } from 'react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onPromptTriggered?: () => void;
}

type DeviceTab = 'ios_iphone' | 'ios_ipad' | 'android' | 'mac' | 'windows';

export function PWAInstallModal({
  isOpen,
  onClose,
  deferredPrompt,
  onPromptTriggered,
}: PWAInstallModalProps) {
  const [activeTab, setActiveTab] = useState<DeviceTab>('ios_iphone');
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [swStatus, setSwStatus] = useState<string>('Đang kiểm tra...');
  const [storageInfo, setStorageInfo] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Detect device platform automatically
    const ua = navigator.userAgent || '';
    const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIPhone = /iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isMac = /Macintosh|Mac OS X/.test(ua) && !isIPad;
    const isWin = /Windows/.test(ua);

    if (isIPad) setActiveTab('ios_ipad');
    else if (isIPhone) setActiveTab('ios_iphone');
    else if (isAndroid) setActiveTab('android');
    else if (isMac) setActiveTab('mac');
    else if (isWin) setActiveTab('windows');
    else setActiveTab('ios_iphone');

    // Check Standalone Mode
    const standaloneCheck =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(standaloneCheck);

    // Check Service Worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.active) {
          setSwStatus('Đã sẵn sàng (Hoạt động tốt 🟢)');
        } else if (reg?.installing || reg?.waiting) {
          setSwStatus('Đang cài đặt đệm ⏳');
        } else {
          setSwStatus('Đã đăng ký');
        }
      }).catch(() => {
        setSwStatus('Chưa kích hoạt');
      });
    } else {
      setSwStatus('Trình duyệt không hỗ trợ SW');
    }

    // Check Storage Estimate
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(({ quota, usage }) => {
        if (quota && usage !== undefined) {
          const usageMB = (usage / (1024 * 1024)).toFixed(1);
          const quotaMB = (quota / (1024 * 1024)).toFixed(0);
          setStorageInfo(`${usageMB} MB / ${quotaMB} MB`);
        }
      }).catch(() => {
        setStorageInfo(null);
      });
    }

    // Network status listener
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          if (onPromptTriggered) onPromptTriggered();
          onClose();
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      }
    }
  };

  const handleForceUpdateCache = async () => {
    setIsClearingCache(true);
    setCacheMessage(null);

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active) {
          reg.active.postMessage({ type: 'CLEAR_CACHE' });
          reg.active.postMessage({ type: 'SKIP_WAITING' });
        }
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      setCacheMessage('✅ Đã xóa toàn bộ bộ nhớ đệm Cache thành công! Đang tải lại ứng dụng...');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setCacheMessage('❌ Không thể xóa đệm tự động. Vui lòng làm mới trình duyệt (F5 / Cmd+R).');
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1rem',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
            color: '#ffffff',
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <img
                src="/branding/tam-an-logo-master.png"
                alt="Tâm An Care"
                style={{ width: '26px', height: '26px', objectFit: 'contain' }}
              />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.2 }}>
                Cài Đặt App Tâm An Care (PWA)
              </h2>
              <div style={{ fontSize: '0.78rem', opacity: 0.9, marginTop: '2px' }}>
                Hỗ trợ iPhone, iPad, Android, Mac & Windows không qua App Store
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {/* App Execution Status Badge */}
          <div
            style={{
              background: isStandalone ? '#f0fdf4' : '#eff6ff',
              border: isStandalone ? '1px solid #86efac' : '1px solid #bfdbfe',
              borderRadius: '0.75rem',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.76rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Chế độ vận hành ứng dụng
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isStandalone ? '#15803d' : '#1e40af', marginTop: '2px' }}>
                {isStandalone ? '📱 Ứng Dụng Độc Lập (Standalone PWA)' : '🌐 Trình Duyệt Web (Web Browser)'}
              </div>
            </div>

            {isStandalone ? (
              <span
                style={{
                  background: '#15803d',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  whiteSpace: 'nowrap',
                }}
              >
                ✓ Đã cài đặt
              </span>
            ) : deferredPrompt ? (
              <button
                type="button"
                onClick={handleInstallClick}
                style={{
                  background: '#166534',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.9rem',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(22, 101, 52, 0.25)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>📲</span> Cài Đặt Ngay
              </button>
            ) : (
              <span
                style={{
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  whiteSpace: 'nowrap',
                }}
              >
                ℹ Sẵn sàng cài đặt
              </span>
            )}
          </div>

          {/* Device Tabs Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
              Chọn loại thiết bị của bạn để xem hướng dẫn cài đặt:
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                background: '#f1f5f9',
                padding: '0.25rem',
                borderRadius: '0.6rem',
                overflowX: 'auto',
              }}
            >
              {[
                { id: 'ios_iphone', label: '📱 iPhone', icon: '🍎' },
                { id: 'ios_ipad', label: '📱 iPad', icon: '🍏' },
                { id: 'android', label: '🤖 Android', icon: '📱' },
                { id: 'mac', label: '💻 macOS', icon: '🖥️' },
                { id: 'windows', label: '🪟 Windows', icon: '💻' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as DeviceTab)}
                    style={{
                      flex: 1,
                      minWidth: '85px',
                      padding: '0.45rem 0.5rem',
                      border: 'none',
                      borderRadius: '0.45rem',
                      background: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? '#166534' : '#64748b',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Detailed Content */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            {activeTab === 'ios_iphone' && (
              <div>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                  🍎 Hướng dẫn cài đặt trên iPhone (Safari & Chrome iOS)
                </div>
                <div style={{ fontSize: '0.84rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Bước 1</span>
                    <div>
                      Mở ứng dụng bằng trình duyệt <b>Safari</b> trên iPhone. Nhấn vào biểu tượng <b>Chia sẻ (Share ⎋)</b> ở thanh công cụ dưới cùng Safari.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Bước 2</span>
                    <div>
                      Cuộn xuống trong danh sách tùy chọn và chọn <b>"Thêm vào Màn hình chính" (Add to Home Screen ➕)</b>.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Bước 3</span>
                    <div>
                      Nhấn nút <b>Thêm (Add)</b> ở góc trên bên phải. Biểu tượng Tâm An Care sẽ xuất hiện ngay ngoài màn hình ứng dụng iPhone của bạn.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ios_ipad' && (
              <div>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                  🍏 Hướng dẫn cài đặt trên iPad (iPadOS Safari)
                </div>
                <div style={{ fontSize: '0.84rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Bước 1</span>
                    <div>
                      Trền iPad, biểu tượng <b>Chia sẻ (Share ⎋)</b> nằm ở thanh công cụ <b>phía trên cùng bên phải</b> của trình duyệt Safari.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Bước 2</span>
                    <div>
                      Nhấn vào nút Share ⎋ và chọn <b>"Thêm vào Màn hình chính" (Add to Home Screen ➕)</b>.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Bước 3</span>
                    <div>
                      Nhấn <b>Thêm (Add)</b> để hoàn tất. Ứng dụng sẽ hoạt động ở chế độ full-screen như app native iPad.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'android' && (
              <div>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                  🤖 Hướng dẫn cài đặt trên Điện thoại / Tablet Android
                </div>
                {deferredPrompt ? (
                  <div style={{ fontSize: '0.84rem', color: '#334155', marginBottom: '0.75rem' }}>
                    Trình duyệt Android hỗ trợ cài đặt tự động! Bạn có thể bấm nút cài đặt trực tiếp dưới đây:
                    <div style={{ marginTop: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={handleInstallClick}
                        style={{
                          background: '#166534',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          padding: '0.65rem 1.25rem',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 2px 6px rgba(22, 101, 52, 0.3)',
                        }}
                      >
                        <span>📲</span> Kích Hoạt Cài Đặt Android Ngay
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.84rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                      <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Cách 1</span>
                      <div>
                        Nhấn vào biểu tượng <b>⋮ (3 chấm)</b> ở góc phải thanh địa chỉ Chrome / Edge / Samsung Internet.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                      <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Cách 2</span>
                      <div>
                        Chọn <b>"Cài đặt ứng dụng" (Install App)</b> hoặc <b>"Thêm vào Màn hình chính" (Add to Home screen)</b>.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mac' && (
              <div>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                  💻 Hướng dẫn cài đặt trên Máy tính Mac (macOS Sonoma / Safari / Chrome)
                </div>
                <div style={{ fontSize: '0.84rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Safari Mac</span>
                    <div>
                      Trên macOS Sonoma+, mở Safari &rarr; Nhấn menu <b>Tệp (File)</b> trên thanh hệ thống Mac &rarr; Chọn <b>"Thêm vào Dock" (Add to Dock 📌)</b>.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Chrome / Edge</span>
                    <div>
                      Bấm vào biểu tượng <b>Cài đặt (Install 📲)</b> ở cuối thanh địa chỉ URL hoặc bấm menu <b>⋮ &rarr; Lưu và chia sẻ &rarr; Cài đặt Tâm An Care...</b>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'windows' && (
              <div>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                  🪟 Hướng dẫn cài đặt trên Máy tính Windows (10/11 - Edge & Chrome)
                </div>
                {deferredPrompt ? (
                  <div style={{ fontSize: '0.84rem', color: '#334155', marginBottom: '0.75rem' }}>
                    Trình duyệt Windows hỗ trợ cài đặt ứng dụng máy tính trực tiếp!
                    <div style={{ marginTop: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={handleInstallClick}
                        style={{
                          background: '#166534',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          padding: '0.65rem 1.25rem',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 2px 6px rgba(22, 101, 52, 0.3)',
                        }}
                      >
                        <span>💻</span> Cài Đặt Tâm An Care Cho Windows
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.84rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                      <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Microsoft Edge</span>
                      <div>
                        Bấm vào biểu tượng <b>Ứng dụng sẵn có (App available 📲)</b> ở góc phải thanh URL &rarr; Nhấn <b>Cài đặt (Install)</b> để ghim ứng dụng vào Desktop & Taskbar.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                      <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.8rem' }}>Google Chrome</span>
                      <div>
                        Bấm menu <b>⋮ (3 chấm) &rarr; Lưu và chia sẻ (Save and share) &rarr; Cài đặt ứng dụng Tâm An Care...</b>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* System & Storage Diagnostics Panel */}
          <div
            style={{
              background: '#f1f5f9',
              borderRadius: '0.75rem',
              padding: '0.85rem 1rem',
              fontSize: '0.8rem',
              color: '#334155',
            }}
          >
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>⚙ Trạng thái Kỹ thuật & Bộ nhớ Ngoại tuyến:</span>
              <span style={{ color: isOnline ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                {isOnline ? '🟢 Trực tuyến (Online)' : '🔴 Ngoại tuyến (Offline)'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <div>• Service Worker: <b>{swStatus}</b></div>
              <div>• Bộ nhớ đệm Cache: <b>{storageInfo || 'Tự động quản lý'}</b></div>
            </div>

            {cacheMessage && (
              <div
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.4rem',
                  background: cacheMessage.includes('✅') ? '#dcfce7' : '#fee2e2',
                  color: cacheMessage.includes('✅') ? '#15803d' : '#b91c1c',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  marginBottom: '0.65rem',
                }}
              >
                {cacheMessage}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleForceUpdateCache}
                disabled={isClearingCache}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span>🔄</span> {isClearingCache ? 'Đang làm mới...' : 'Xóa & Cập Nhật Cache Phiên Bản Mới (V7.5)'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            padding: '0.85rem 1.25rem',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Phiên bản PWA: <b>V7.5 Full Standalone</b>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#166534',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Đã Hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
