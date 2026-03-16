import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/push-express-sdk.js', format: 'umd', name: 'PushExpress', sourcemap: true },
      { file: 'dist/push-express-sdk.esm.js', format: 'esm', sourcemap: true }
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })]
  },
  {
    input: 'src/service-worker.ts',
    output: { file: 'dist/push-express-sw.js', format: 'iife', sourcemap: true },
    plugins: [typescript({ tsconfig: './tsconfig.sw.json' })]
  }
];
