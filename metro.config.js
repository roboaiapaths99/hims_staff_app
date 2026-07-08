const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude any build artifacts or local temporary folders from being watched
config.resolver.blockList = [
  // Exclude native android/ios folders if they exist
  /.*\/android\/.*/,
  /.*\/ios\/.*/,
  // Exclude parent node_modules or other project caches
  /node_modules\/.*\/node_modules/,
];

module.exports = config;
