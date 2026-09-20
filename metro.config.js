// Metro config — extends Expo's default to support importing .svg files as
// React components (via react-native-svg-transformer). Everything else keeps
// Expo's defaults untouched.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};

config.resolver = {
  ...config.resolver,
  // .svg is no longer treated as an asset — it becomes a source module (component).
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
};

module.exports = config;
