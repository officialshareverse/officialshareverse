import React, { useState } from 'react';

// A set of colors to use for the fallback initials background
const fallbackColors = [
  '#0f766e', // teal
  '#7c3aed', // violet
  '#059669', // emerald
  '#ea580c', // orange
  '#e11d48', // rose
  '#2563eb', // blue
  '#d97706', // amber
  '#4f46e5', // indigo
];

function getFallbackColor(name) {
  if (!name) return fallbackColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % fallbackColors.length;
  return fallbackColors[index];
}

export default function SubscriptionLogo({ name, size = 40, className = '', style = {} }) {
  const [imgError, setImgError] = useState(false);

  // Guess the domain by removing spaces and non-alphanumeric chars, then appending .com
  const cleanName = (name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const domain = `${cleanName}.com`;
  const logoUrl = `https://logo.clearbit.com/${domain}`;

  const defaultStyle = {
    width: size,
    height: size,
    borderRadius: Math.max(8, size * 0.2), // responsive border radius
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    ...style,
  };

  if (!imgError && cleanName) {
    return (
      <div style={defaultStyle} className={`sv-sub-logo-wrapper ${className}`}>
        <img
          src={logoUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#fff' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: colored circle with first letter
  const initial = (name || '?').charAt(0).toUpperCase();
  const bgColor = getFallbackColor(name);

  return (
    <div
      style={{
        ...defaultStyle,
        backgroundColor: bgColor,
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: size * 0.5,
      }}
      className={`sv-sub-logo-fallback ${className}`}
      title={name}
    >
      {initial}
    </div>
  );
}
