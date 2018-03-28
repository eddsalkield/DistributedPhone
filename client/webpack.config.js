const path = require('path');
const webpack = require('webpack');

distdir = path.resolve(__dirname, "dist");

module.exports = function(env, argv) {
  if(!env) env = {};
  function makeConfig(out_name, in_file, tsconfig) {
    return {
      mode: env.dev ? "development" : "production",
      devtool: env.dev ? "inline-source-map" : false,
      optimization: {
        minimize: !env.dev
      },

      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: {
              loader: 'ts-loader',
              options: {
                configFile: tsconfig,
              },
            },
            exclude: /node_modules/,
          },
        ],
      },
      resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
          Dist: distdir,
        }
      },
      entry: in_file,
      output: {
        filename: out_name,
        path: distdir,
      },
    }
  }

  stuff = [
    // Order is important.
    makeConfig("worker.js", "./src/worker/worker.ts", "tsconfig-worker.json"),
    makeConfig("index.js", "./index.ts", "tsconfig-dom.json"),
  ];

  if(env.tests) {
    stuff = stuff.concat([
      makeConfig("exec-test-rig.js", "./src/exec/test-rig.ts", "tsconfig-dom.json"),
      makeConfig("test-exec-runner.js", "./src/exec/tests/runner.ts", "tsconfig-dom.json"),
      makeConfig("test-exec-idb.js", "./src/exec/tests/idb.ts", "tsconfig-dom.json"),
    ]);
  }

  return stuff;
}
