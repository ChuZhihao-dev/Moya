import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  // Shopify CLI already supplies esbuild in this workspace; no runtime dependency.
  const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  esbuild = require(join(root, '@shopify/cli/node_modules/esbuild'));
}
await esbuild.build({
  entryPoints: ['assets/moya-talk.js', 'assets/moya-talk.css'],
  outdir: 'assets',
  outExtension: { '.js': '.min.js', '.css': '.min.css' },
  minify: true,
  target: ['es2022'],
  logLevel: 'info',
});
