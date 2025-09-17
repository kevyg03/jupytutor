// webpack.config.js
const path = require('path');

module.exports = {
  // The entry point for the extension.
  entry: './src/index.ts',

  // The output bundle.
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'index.js',
    libraryTarget: 'amd' // The format for JupyterLab extensions.
  },

  // Rules for how to handle different file types.
  module: {
    rules: [
      {
        test: /\.tsx?$/, // Handle .ts and .tsx files.
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/, // Handle .css files.
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.html$/, // Handle .html files.
        use: 'html-loader'
      }
    ]
  },

  // --- THIS IS THE FIX FOR YOUR REACT PROBLEM ---
  // Force all modules to use the same instance of React.
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
    },
    fallback: {
      fs: false,
      path: false,
      os: false,
      crypto: false,
      stream: false,
      util: false,
      buffer: false,
      events: false,
      assert: false,
      constants: false,
      domain: false,
      punycode: false,
      querystring: false,
      string_decoder: false,
      sys: false,
      timers: false,
      tty: false,
      url: false,
      vm: false,
      zlib: false
    }
  },

  // Exclude JupyterLab and Lumino packages from the bundle.
  // They are already provided by JupyterLab itself.
  externals: [/^@jupyterlab\/.+$/, /^@lumino\/.+$/, 'jsdom']
};
