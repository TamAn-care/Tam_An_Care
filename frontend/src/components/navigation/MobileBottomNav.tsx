import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  onOpenTesterModal: () => void;
}

export function MobileBottomNav({ onOpenMenu, onOpenTesterModal }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Trang Chủ', icon: '🏠', path: '/dashboard' },
    { label: 'Cư Dân', icon: '📋', path: '/residents' },
    { label: 'Chăm Sóc', icon: '🩺', path: '/care-view' },
    { label: 'Dược eMAR', icon: '💊', path: '/medication-inventory' },
  ];

  return (
    <nav
      className="mobile-bottom-nav ios-nav-blur"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(62px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(203, 213, 225, 0.8)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        zIndex: 9990,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.06)',
        paddingTop: '0.35rem',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            type="button"
            className="ios-press"
            onClick={() => navigate(item.path)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.15rem',
              color: isActive ? '#166534' : '#64748b',
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.7rem',
              cursor: 'pointer',
              flex: 1,
              padding: '0.2rem 0',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
              minHeight: '44px',
            }}
          >
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: '-0.35rem',
                  width: '20px',
                  height: '3px',
                  background: '#166534',
                  borderRadius: '999px',
                }}
              />
            )}
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{item.icon}</span>
            <span style={{ letterSpacing: '-0.01em' }}>{item.label}</span>
          </button>
        );
      })}

      {/* Tester Button */}
      <button
        type="button"
        className="ios-press"
        onClick={onOpenTesterModal}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.15rem',
          color: '#854d0e',
          fontWeight: 700,
          fontSize: '0.7rem',
          cursor: 'pointer',
          flex: 1,
          padding: '0.2rem 0',
          WebkitTapHighlightColor: 'transparent',
          minHeight: '44px',
        }}
      >
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🧪</span>
        <span>Tester</span>
      </button>

      {/* Mobile Drawer Menu Button */}
      <button
        type="button"
        className="ios-press"
        onClick={onOpenMenu}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.15rem',
          color: '#334155',
          fontWeight: 600,
          fontSize: '0.7rem',
          cursor: 'pointer',
          flex: 1,
          padding: '0.2rem 0',
          WebkitTapHighlightColor: 'transparent',
          minHeight: '44px',
        }}
      >
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>☰</span>
        <span>Danh Mục</span>
      </button>
    </nav>
  );
}
