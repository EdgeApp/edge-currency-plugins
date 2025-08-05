const { exec } = require('child_process')
const path = require('path')
const { EsbuildPlugin } = require('esbuild-loader')

const webpack = require('webpack')

const debug = process.env.WEBPACK_SERVE

// Try exposing our socket to adb (errors are fine):
if (process.env.WEBPACK_SERVE) {
  console.log('adb reverse tcp:8084 tcp:8084')
  exec('adb reverse tcp:8084 tcp:8084', () => {})
}

const bundlePath = path.resolve(
  __dirname,
  'android/src/main/assets/edge-currency-plugins'
)

module.exports = {
  devtool: debug ? 'source-map' : undefined,
  devServer: {
    allowedHosts: 'all',
    hot: false,
    port: 8084,
    static: bundlePath
  },
  entry: './src/index.ts',
  mode: debug ? 'development' : 'production',
  module: {
    rules: [
      {
        exclude: /(@babel\/runtime|babel-runtime)/,
        test: /\.ts$/,
        use: {
          loader: 'esbuild-loader',
          options: { loader: 'ts', target: 'chrome55' }
        }
      }
    ]
  },
  optimization: {
    minimizer: [
      new EsbuildPlugin({
        target: 'chrome67'
      })
    ]
  },
  output: {
    chunkFilename: '[name].chunk.js',
    filename: 'edge-currency-plugins.js',
    path: bundlePath
  },
  performance: { hints: false },
  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^(https-proxy-agent)$/ }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.ProvidePlugin({
      process: path.resolve('node_modules/process/browser.js')
    })
  ],
  resolve: {
    aliasFields: ['browser'],
    extensions: ['.ts', '.js'],
    fallback: {
      assert: require.resolve('assert'),
      crypto: require.resolve('crypto-browserify'),
      fs: false,
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify'),
      string_decoder: require.resolve('string_decoder'),
      url: require.resolve('url'),
      vm: require.resolve('vm-browserify')
    },
    mainFields: ['browser', 'module', 'main']
  }
}
