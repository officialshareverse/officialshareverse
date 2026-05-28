import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const fallbackColors = [
  '#0f766e', '#7c3aed', '#059669', '#ea580c', 
  '#e11d48', '#2563eb', '#d97706', '#4f46e5'
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

export default function SubscriptionLogo({ name, size = 40, style }) {
  const [imgError, setImgError] = useState(false);

  const cleanName = (name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const domain = `${cleanName}.com`;
  const logoUrl = `https://logo.clearbit.com/${domain}`;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: Math.max(8, size * 0.2),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  };

  if (!imgError && cleanName) {
    return (
      <View style={[containerStyle, { backgroundColor: '#fff' }, style]}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
          onError={() => setImgError(true)}
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
