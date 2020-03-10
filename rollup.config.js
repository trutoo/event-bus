import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'EventBus',
        file: pkg.browser,
        format: 'umd',
        plugins: [terser()],
      },
      {
        name: 'EventBus',
        file: `${pkg.browser.replace(/\.min\.js$/, '.js')}`,
        format: 'umd',
      },
    ],
    plugins: [
      resolve({ browser: true, preferBuiltins: true }),
      commonjs(),
      globals(),
      builtins(),
      typescript({
        typescript: require('typescript'),
      }),
    ],
  },
  {
    input: 'src/index.ts',
    external: [...Object.keys(pkg.dependencies || {}), 'globalthis/shim', ...Object.keys(pkg.peerDependencies || {})],
    plugins: [
      typescript({
        typescript: require('typescript'),
      }),
    ],
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' },
    ],
  },
];
