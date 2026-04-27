// Babel config Expo SDK 55 + Tamagui
// Voir CLAUDE.md §Stack technique figée

module.exports = function (api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // Tamagui : optimisations + tree-shaking
      [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui'],
          config: './tamagui.config.ts',
          logTimings: true,
          disableExtraction: process.env.NODE_ENV === 'development',
        },
      ],
      // Reanimated DOIT être le dernier plugin
      'react-native-worklets/plugin',
    ],
  };
};
