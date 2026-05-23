const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, 'public', 'service-worker.js');

try {
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Replace the CACHE_VERSION with a new timestamp
  const newVersion = `shareverse-pwa-${Date.now()}`;
  swContent = swContent.replace(
    /const CACHE_VERSION = ".*?";/, 
    `const CACHE_VERSION = "${newVersion}";`
  );
  
  fs.writeFileSync(swPath, swContent);
  console.log(`Successfully updated Service Worker cache version to ${newVersion}`);
} catch (error) {
  console.error('Failed to update service worker version:', error);
}
