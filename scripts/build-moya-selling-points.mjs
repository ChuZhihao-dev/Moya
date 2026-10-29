import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  esbuild = require(join(root, '@shopify/cli/node_modules/esbuild'));
}
await esbuild.build({
  entryPoints: ['assets/moya-selling-points.js', 'assets/moya-selling-points.css'],
  outdir: 'assets',
  outExtension: { '.js': '.min.js', '.css': '.min.css' },
  bundle: true,
  format: 'esm',
  minify: true,
  target: ['es2022'],
  logLevel: 'info',
});
