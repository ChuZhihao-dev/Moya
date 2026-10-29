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
  entryPoints: ['assets/moya-product-details.js', 'assets/moya-product-details.css'],
  outdir: 'assets',
  outExtension: { '.js': '.min.js', '.css': '.min.css' },
  minify: true,
  target: ['es2022'],
  logLevel: 'info',
});
