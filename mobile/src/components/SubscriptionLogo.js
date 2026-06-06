import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';

const fallbackColors = [
  '#0f766e', '#7c3aed', '#059669', '#ea580c', 
  '#e11d48', '#2563eb', '#d97706', '#4f46e5'
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
  if (domainMap[lower]) return domainMap[lower];
  for (const [key, domain] of Object.entries(domainMap)) {
    if (lower.includes(key)) return domain;
  }
  const cleaned = lower.replace(/[^a-z0-9]/g, '');
  return cleaned ? `${cleaned}.com` : null;
}

// Build logo URL candidates using free public services (no API key needed).
// Google S2 favicons return high-res icons; DuckDuckGo icons are the fallback.
function getLogoUrls(domain) {
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
  const index = Math.abs(hash) % fallbackColors.length;
  return fallbackColors[index];
}

export default function SubscriptionLogo({ name, size = 40, style }) {
  const [urlIndex, setUrlIndex] = useState(0);

  const domain = getDomain(name);
  const logoUrls = getLogoUrls(domain);
  const logoUrl = urlIndex < logoUrls.length ? logoUrls[urlIndex] : null;

  useEffect(() => {
    setUrlIndex(0);
  }, [domain]);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: Math.max(8, size * 0.2),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  };

  if (logoUrl) {
    return (
      <View style={[containerStyle, { backgroundColor: '#fff' }, style]}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
          onError={() => setUrlIndex((i) => i + 1)}
        />
      </View>
    );
  }

  const initial = (name || '?').charAt(0).toUpperCase();
  const bgColor = getFallbackColor(name);

  return (
    <View style={[containerStyle, { backgroundColor: bgColor }, style]}>
      <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: size * 0.5 }}>
        {initial}
      </Text>
    </View>
  );
}
