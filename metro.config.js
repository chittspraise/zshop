const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.includes('react-native/Libraries/Components/TextInput/TextInputState')) {
    return {
      type: 'empty',
    };
  }
  // Let the default resolver handle everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
