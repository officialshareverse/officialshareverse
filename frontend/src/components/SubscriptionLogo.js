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

// Known subscription-to-domain mappings for accurate logo fetching
const domainMap = {
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  'amazon prime': 'amazon.com',
  'prime video': 'amazon.com',
  'disney+': 'disneyplus.com',
  'disney plus': 'disneyplus.com',
  'apple music': 'apple.com',
  'apple tv': 'apple.com',
  youtube: 'youtube.com',
  'youtube premium': 'youtube.com',
  'youtube music': 'youtube.com',
  hbo: 'hbo.com',
  'hbo max': 'hbo.com',
  hulu: 'hulu.com',
  coursera: 'coursera.org',
  udemy: 'udemy.com',
  canva: 'canva.com',
  figma: 'figma.com',
  notion: 'notion.so',
  chatgpt: 'openai.com',
  openai: 'openai.com',
  'microsoft 365': 'microsoft.com',
  adobe: 'adobe.com',
  dropbox: 'dropbox.com',
  grammarly: 'grammarly.com',
  duolingo: 'duolingo.com',
  crunchyroll: 'crunchyroll.com',
  'jio hotstar': 'hotstar.com',
  hotstar: 'hotstar.com',
  'jio cinema': 'jiocinema.com',
  jiocinema: 'jiocinema.com',
  zee5: 'zee5.com',
  sonyliv: 'sonyliv.com',
  'sony liv': 'sonyliv.com',
  voot: 'voot.com',
  mxplayer: 'mxplayer.in',
  'mx player': 'mxplayer.in',
  wynk: 'wynk.in',
  gaana: 'gaana.com',
  linkedin: 'linkedin.com',
  'linkedin premium': 'linkedin.com',
  slack: 'slack.com',
  zoom: 'zoom.us',
  nordvpn: 'nordvpn.com',
  expressvpn: 'expressvpn.com',
  surfshark: 'surfshark.com',
};

function getDomain(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  // Check exact and partial matches in the domain map
  if (domainMap[lower]) return domainMap[lower];

  // Check if any key is contained in the name
  for (const [key, domain] of Object.entries(domainMap)) {
    if (lower.includes(key)) return domain;
  }

  // Fallback: guess by stripping non-alphanumeric and appending .com
  const cleaned = lower.replace(/[^a-z0-9]/g, '');
  return cleaned ? `${cleaned}.com` : null;
}

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

  const domain = getDomain(name);
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null;

  // Handle size being a string like "100%" or a number
  const isPercentSize = typeof size === 'string' && size.includes('%');
  const numericSize = isPercentSize ? 40 : Number(size) || 40;

  const defaultStyle = {
    width: size,
    height: size,
    borderRadius: isPercentSize ? '20%' : Math.max(8, numericSize * 0.2),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    ...style,
  };

  if (!imgError && logoUrl) {
    return (
      <div style={defaultStyle} className={`sv-sub-logo-wrapper ${className}`}>
        <img
          src={logoUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#fff' }}
          onError={() => setImgError(true)}
          loading="lazy"
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
        fontSize: isPercentSize ? '50%' : numericSize * 0.5,
      }}
      className={`sv-sub-logo-fallback ${className}`}
      title={name}
    >
      {initial}
    </div>
  );
}
