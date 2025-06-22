import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { readFileSync } from 'node:fs';
import nodePolyfills from 'rollup-plugin-node-polyfills';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const createRegExp = (str) => new RegExp(`^${str}`);
const external = [
  ...Object.keys(pkg.dependencies || {}).map(createRegExp),
  ...Object.keys(pkg.peerDependencies || {}).map(createRegExp),
];

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'EventBus',
        file: 'dist/index.umd.min.js',
        format: 'umd',
        sourcemap: true,
        plugins: [terser()],
      },
      {
        name: 'EventBus',
        file: 'dist/index.umd.js',
        format: 'umd',
      },
    ],
    plugins: [
      commonjs(),
      nodePolyfills(),
      nodeResolve({
        browser: true,
        preferBuiltins: false,
      }),
      json(),
      typescript(),
    ],
  },
  {
    input: 'src/index.ts',
    external,
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        exports: 'named',
      },
      {
        file: pkg.module,
        format: 'es',
      },
    ],
    plugins: [commonjs(), typescript()],
  },
];
