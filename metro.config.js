// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite sur le web : charge le moteur SQLite compilé en WebAssembly.
config.resolver.assetExts.push('wasm');

// expo-sqlite sur le web a besoin de SharedArrayBuffer, qui exige ces en-têtes.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
