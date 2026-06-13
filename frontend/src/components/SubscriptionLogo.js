import React, { useState } from 'react';

// Known subscription-to-domain mappings
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
  'apna college': 'apnacollege.in',
  'apna college sigma': 'apnacollege.in',
};

// Inline SVG brand logos for major services — no network needed
const brandLogos = {
  'apnacollege.in': (
    <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" width="90%" height="90%">
      <text x="60" y="26" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontWeight="900" fontSize="26" fill="#1a1a1a">APNA</text>
      <text x="60" y="52" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontWeight="900" fontSize="22" fill="#F5A623">COLLEGE</text>
    </svg>
  ),
  'netflix.com': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#E50914" width="70%" height="70%">
      <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c.04.007 0 0 .41.065V0zM5.398 1.05V24c1.873-.225 2.81-.312 4.715-.398v-9.22z"/>
    </svg>
  ),
  'spotify.com': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#1DB954" width="70%" height="70%">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),
  'youtube.com': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#FF0000" width="70%" height="70%">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  'openai.com': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#10A37F" width="65%" height="65%">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071.005l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071-.005l4.83 2.786a4.494 4.494 0 0 1-.696 8.1v-5.7a.79.79 0 0 0-.387-.63zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  ),
  'figma.com': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="55%" height="55%">
      <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491z" fill="#1ABCFE"/>
      <path d="M6.676 16.018a4.49 4.49 0 0 1 4.588-4.49h4.588v4.49a4.49 4.49 0 0 1-4.588 4.49 4.49 4.49 0 0 1-4.588-4.49z" fill="#0ACF83"/>
      <path d="M6.676 4.49A4.49 4.49 0 0 1 11.264 0h4.588v8.981h-4.588A4.49 4.49 0 0 1 6.676 4.49z" fill="#F24E1E"/>
      <path d="M6.676 13.527a4.49 4.49 0 0 1 4.588-4.49h4.588v4.49a4.49 4.49 0 0 1-4.588 4.491 4.49 4.49 0 0 1-4.588-4.49z" fill="#FF7262"/>
      <path d="M15.852 13.527a4.49 4.49 0 0 0-4.588-4.49v8.981a4.49 4.49 0 0 0 4.588-4.49z" fill="#A259FF"/>
    </svg>
  ),
  'linkedin.com': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#0A66C2" width="65%" height="65%">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  'slack.com': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="65%" height="65%">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
      <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/>
    </svg>
  ),
  'zoom.us': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#2D8CFF" width="65%" height="65%">
      <path d="M24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12zm-4.406-3.373c-.375-.267-.855-.32-1.284-.14l-2.62 1.1V8.2c0-.76-.62-1.376-1.376-1.376H5.946c-.76 0-1.376.616-1.376 1.376v7.6c0 .76.616 1.376 1.376 1.376h8.368c.76 0 1.376-.616 1.376-1.376v-1.388l2.62 1.1c.43.18.91.127 1.284-.14.375-.266.6-.7.6-1.16V9.787c0-.46-.225-.893-.6-1.16z"/>
    </svg>
  ),
  'canva.com': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#00C4CC" width="65%" height="65%">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.14 16.793c-.292.398-.727.63-1.22.654-.56.028-1.178-.228-1.752-.724-.762-.657-1.46-1.722-1.86-3.024-.08-.26-.303-.44-.57-.466-.267-.026-.52.114-.643.355-.64 1.262-1.544 1.983-2.478 1.983-1.57 0-2.784-1.98-2.784-4.545 0-2.564 1.214-4.544 2.784-4.544.768 0 1.46.448 2.023 1.164.17.217.45.3.707.214.257-.087.432-.324.443-.597.04-1.024.306-1.93.76-2.6.515-.76 1.2-1.162 1.985-1.162 1.57 0 2.85 2.093 2.85 4.67 0 1.193-.256 2.31-.725 3.167-.16.293-.128.653.082.913.21.26.546.368.856.274.284-.086.554-.13.8-.13.897 0 1.58.56 1.58 1.295 0 1.238-1.452 2.483-3.838 2.847z"/>
    </svg>
  ),
};

// Fallback colors for unknown brands
const fallbackColors = [
  '#0f766e', '#7c3aed', '#059669', '#ea580c',
  '#e11d48', '#2563eb', '#d97706', '#4f46e5',
];

function getDomain(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  if (domainMap[lower]) return domainMap[lower];
  for (const [key, domain] of Object.entries(domainMap)) {
    if (lower.includes(key)) return domain;
  }
  const cleaned = lower.replace(/[^a-z0-9]/g, '');
  return cleaned ? `${cleaned}.com` : null;
}

// Public favicon services allowed by CSP
function getFaviconUrls(domain) {
  if (!domain) return [];
  return [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

function getFallbackColor(name) {
  if (!name) return fallbackColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
}

export default function SubscriptionLogo({ name, size = 40, className = '', style = {} }) {
  const [faviconFailed, setFaviconFailed] = useState(0);
  const domain = getDomain(name);

  const isPercentSize = typeof size === 'string' && size.includes('%');
  const numericSize = isPercentSize ? 40 : Number(size) || 40;

  const containerStyle = {
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

  // 1) Inline SVG logo for major brands — instant, no network
  if (domain && brandLogos[domain]) {
    return (
      <div
        style={{ ...containerStyle, backgroundColor: '#fff', padding: isPercentSize ? '15%' : Math.max(4, numericSize * 0.12) }}
        className={`sv-sub-logo-wrapper ${className}`}
      >
        {brandLogos[domain]}
      </div>
    );
  }

  // 2) Google Favicon for all other known domains (128px high-res)
  if (domain) {
    const faviconUrls = getFaviconUrls(domain);

    if (faviconFailed < faviconUrls.length) {
      return (
        <div
          style={{ ...containerStyle, backgroundColor: '#fff' }}
          className={`sv-sub-logo-wrapper ${className}`}
        >
          <img
            src={faviconUrls[faviconFailed]}
            alt={name}
            style={{ width: '70%', height: '70%', objectFit: 'contain' }}
            onError={() => setFaviconFailed((prev) => prev + 1)}
            loading="lazy"
          />
        </div>
      );
    }
  }

  // 3) Final fallback — colored circle with first letter
  const initial = (name || '?').charAt(0).toUpperCase();
  const bgColor = getFallbackColor(name);

  return (
    <div
      style={{
        ...containerStyle,
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
