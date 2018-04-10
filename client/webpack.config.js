const path = require('path');
const webpack = require('webpack');

distdir = path.resolve(__dirname, "dist");

module.exports = function(env, argv) {
  if(!env) env = {};
  function makeConfig(target, tsconfig) {
    return {
      target: target,
      mode: env.dev ? "development" : "production",
      devtool: env.dev ? "inline-source-map" : false,
      optimization: {
        minimize: !env.dev,
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
      entry: {},
      output: {
        path: distdir,
        filename: '[name].js',
      },
    };
  }

  as_worker = makeConfig("webworker", "tsconfig-worker.json");
  as_dom = makeConfig("web", "tsconfig-dom.json");

  as_worker.entry["worker"] =  "./src/worker/worker.ts";

  as_dom.entry["index"] =  "./src/index.ts";
  if(env.tests) {
    as_dom.entry["exec-test-rig"] = "./src/exec/test-rig.ts";
    as_dom.entry["test-exec-runner"] = "./src/exec/tests/runner.ts";
    as_dom.entry["test-exec-idb"] = "./src/exec/tests/idb.ts";
  }

  return [as_worker, as_dom];
}
