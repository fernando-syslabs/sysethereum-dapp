require('dotenv').config();
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin'); // npm i -D node-polyfill-webpack-plugin
const port = process.env.PORT || 3000;

module.exports = {
  webpack: {
    configure: (config) => {
      // Use a plugin for Node core polyfills instead of maintaining a long fallback map
      // Keep explicit "cannot polyfill" cases here.
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false, // Can't polyfill in browser
        vm: false,
      };

      // --- begin: ESM/browser resolution tweaks ---
      // Prefer packages' browser/ESM entries over CJS to avoid manual src/esm aliases
      config.resolve.mainFields = ['browser', 'module', 'main'];

      // Ensure exports resolution considers browser/import conditions
      config.resolve.conditionNames = [
        ...(config.resolve.conditionNames || []),
        'import',
        'module',
        'browser',
        'development',
        'default',
      ];

      // Allow .js imports to resolve to .mjs/.cjs when provided by packages
      config.resolve.extensionAlias = {
        ...(config.resolve.extensionAlias || {}),
        '.js': ['.js', '.mjs', '.cjs'],
      };

      // Parse .mjs files inside node_modules correctly
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      });
      // --- end: ESM/browser resolution tweaks ---

      // Add Node core polyfills and keep your globals
      config.plugins = (config.plugins || []).concat([
        new NodePolyfillPlugin({ excludeAliases: ['fs'] }), // added
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
      ]);

      return config;
    },
  },
};
