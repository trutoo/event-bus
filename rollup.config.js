import { readFileSync } from 'fs';

import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import nodePolyfills from 'rollup-plugin-node-polyfills';

const pkg = JSON.parse(readFileSync('./package.json'));

const startsWithRegExp = (str) => RegExp(`^${str}`);

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'EventBus',
        file: pkg.browser,
        format: 'umd',
        plugins: [terser()],
        sourcemap: true,
      },
      {
        name: 'EventBus',
        file: `${pkg.browser.replace(/\.min\.js$/, '.js')}`,
        format: 'umd',
      },
    ],
    plugins: [commonjs(), nodePolyfills(), nodeResolve({ browser: true, preferBuiltins: false }), typescript()],
  },
  {
    input: 'src/index.ts',
    external: [
      ...Object.keys(pkg.dependencies || {}).map(startsWithRegExp),
      ...Object.keys(pkg.peerDependencies || {}).map(startsWithRegExp),
    ],
    plugins: [commonjs(), typescript()],
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' },
    ],
  },
];
