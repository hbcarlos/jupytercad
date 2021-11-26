const path = require('path');
const rules = [
  { test: /\.ts$/, loader: 'ts-loader' },
  { test: /\.js$/, loader: 'source-map-loader' },
  { test: /\.css$/, use: ['style-loader', 'css-loader'] },
  {
    test: /\.wasm$/,
    type: 'javascript/auto',
    loader: 'file-loader'
  }
];

const resolve = {
  fallback: {
    fs: false,
    child_process: false,
    crypto: false
  }
};

module.exports = [
  {
    entry: './src/worker.ts',
    output: {
      filename: 'worker.js',
      path: path.resolve(__dirname, 'lib'),
      libraryTarget: 'amd'
    },
    module: {
      rules
    },
    devtool: 'source-map',
    resolve
  }
];