import React from 'react';

export interface ElderlyAvatarProps {
  gender?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  style?: React.CSSProperties;
}

export function ElderlyAvatar({
  gender,
  name = 'Người cao tuổi',
  size = 'md',
  className = '',
  style = {},
}: ElderlyAvatarProps) {
  const isFemale =
    gender === 'FEMALE' ||
    gender === 'Nữ' ||
    gender === 'female' ||
    (typeof gender === 'string' && gender.toUpperCase() === 'FEMALE');

  let pxSize = 40;
  let fontSize = '1.1rem';

  if (typeof size === 'number') {
    pxSize = size;
    fontSize = `${Math.max(12, Math.round(size * 0.55))}px`;
  } else if (size === 'sm') {
    pxSize = 32;
    fontSize = '0.9rem';
  } else if (size === 'lg') {
    pxSize = 52;
    fontSize = '1.4rem';
  } else if (size === 'xl') {
    pxSize = 64;
    fontSize = '1.8rem';
  }

  const bgGradient = isFemale
    ? 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'
    : 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)';

  const borderColor = isFemale ? '#f472b6' : '#38bdf8';
  const iconEmoji = isFemale ? '👵' : '👴';

  return (
    <div
      className={`elderly-avatar ${className}`}
      title={`${name} (${isFemale ? 'Nữ' : 'Nam'})`}
      role="img"
      aria-label={`Icon ${isFemale ? 'Cụ bà' : 'Cụ ông'} ${name}`}
      style={{
        width: `${pxSize}px`,
        height: `${pxSize}px`,
        borderRadius: '50%',
        background: bgGradient,
        border: `2px solid ${borderColor}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
    >
      <span>{iconEmoji}</span>
    </div>
  );
}

export default ElderlyAvatar;
