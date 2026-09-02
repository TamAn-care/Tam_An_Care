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
  ];

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#ffffff',
        borderTop: '1px solid #cbd5e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 9990,
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            type="button"
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
              fontWeight: isActive ? 800 : 500,
              fontSize: '0.72rem',
              cursor: 'pointer',
              flex: 1,
              padding: '0.35rem 0',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}

      {/* Tester Button */}
      <button
        type="button"
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
          fontSize: '0.72rem',
          cursor: 'pointer',
          flex: 1,
          padding: '0.35rem 0',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🧪</span>
        <span>Tester</span>
      </button>

      {/* Mobile Drawer Menu Button */}
      <button
        type="button"
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
          fontSize: '0.72rem',
          cursor: 'pointer',
          flex: 1,
          padding: '0.35rem 0',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>☰</span>
        <span>Menu</span>
      </button>
    </nav>
  );
}
