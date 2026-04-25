import * as esbuild from 'esbuild';
import { dirname, fromFileUrl, resolve } from 'jsr:@std/path@1';

const projectRoot = resolve(dirname(fromFileUrl(import.meta.url)), '..');
const isDev = Deno.args.includes('--dev');
const watch = Deno.args.includes('--watch');

const tsEntry = resolve(projectRoot, 'src/ts/index.tsx');
const jsEntry = resolve(projectRoot, 'src/js/index.js');

let entryPoint: string;
try {
  await Deno.stat(tsEntry);
  entryPoint = tsEntry;
} catch {
  entryPoint = jsEntry;
  console.warn(
    `[bundle] TS entry not found at ${tsEntry}, falling back to JS entry ${jsEntry}`,
  );
}

const buildOptions: esbuild.BuildOptions = {
  entryPoints: [entryPoint],
  outfile: resolve(projectRoot, 'public/index.js'),
  bundle: true,
  platform: 'node',
  target: 'chrome87',
  format: 'cjs',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  loader: {
    '.js': 'jsx',
    '.json': 'json',
    '.png': 'file',
    '.jpg': 'file',
    '.gif': 'file',
    '.mp3': 'file',
    '.wav': 'file',
    '.ttf': 'file',
  },
  external: [
    'electron',
    '@electron/remote',
    'fs',
    'path',
    'os',
    'crypto',
    'child_process',
    'stream',
    'http',
    'https',
    'url',
    'util',
    'events',
    'buffer',
    'querystring',
    'zlib',
  ],
  sourcemap: isDev,
  minify: !isDev,
  logLevel: 'info',
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  nodePaths: [resolve(projectRoot, 'public/node_modules')],
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('[bundle] watching for changes...');
} else {
  const result = await esbuild.build(buildOptions);
  if (result.errors.length > 0) {
    console.error('[bundle] build failed', result.errors);
    Deno.exit(1);
  }
  await esbuild.stop();
  console.log(`[bundle] wrote ${buildOptions.outfile}`);
}
