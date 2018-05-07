const path = require('path');
const webpack = require('webpack');

distdir = path.resolve(__dirname, "dist");

module.exports = function(env, argv) {
  if(!env) env = {dev: true, tests: true, utils: true};

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
            exclude: [distdir, /node_modules/],
            use: {
              loader: 'ts-loader',
              options: {
                configFile: tsconfig,
              },
            },
          }, {
            test: /\.css$/,
            use: ['style-loader', 'css-loader'],
          },
        ],
      },
      resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
          'Dist': distdir,
          '@': path.resolve(__dirname, 'src'),
          'react-router': path.resolve(__dirname, 'node_modules/react-router'),
          'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom/es'),
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
  as_node = makeConfig("node", "tsconfig-node.json");

  as_worker.entry["worker"] =  "./src/worker/worker.ts";

  as_dom.entry["index"] =  "./src/index.tsx";
  if(env.tests) {
    as_dom.entry["exec-test-rig"] = "./src/exec/test-rig.ts";
    as_dom.entry["client-test-rig"] = "./src/client-test-rig.tsx";
    as_dom.entry["test-exec-repo"] = "./src/exec/tests/repo.ts";
    as_dom.entry["test-exec-work-dispatcher"] = "./src/exec/tests/work-dispatcher.ts";
    as_dom.entry["test-exec-runner"] = "./src/exec/tests/runner.ts";
    as_dom.entry["test-exec-idb"] = "./src/exec/tests/idb.ts";
  }

  if(env.utils) {
    as_node.entry["node-executor"] =  "./src/node-executor.ts";
    as_node.entry["test"] =  "./src/test.ts";
  }

  const outs = [];
  for(const kind of [as_worker, as_dom, as_node]) {
    if(Object.keys(kind.entry).length > 0) outs.push(kind);
  }
  return outs;
}
