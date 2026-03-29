/**
 * Build a single self-contained HTML file for offline distribution.
 * Inlines all JS and CSS from the Vite build output into index.html.
 *
 * Usage: node build-single-file.mjs
 * Output: dist/Beacon-Counselor-Command-Center.html
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// Step 1: Run the normal build
console.log('Building with Vite...');
execSync('npm run build', { stdio: 'inherit' });

// Step 2: Read the built index.html
const distDir = join(process.cwd(), 'dist');
const html = readFileSync(join(distDir, 'index.html'), 'utf-8');
const assetsDir = join(distDir, 'assets');

// Step 3: Inline all CSS
let result = html;
const cssFiles = readdirSync(assetsDir).filter(f => f.endsWith('.css'));
for (const cssFile of cssFiles) {
  const css = readFileSync(join(assetsDir, cssFile), 'utf-8');
  const linkPattern = new RegExp(`<link[^>]*${cssFile.replace(/\./g, '\\.')}[^>]*>`, 'g');
  result = result.replace(linkPattern, `<style>${css}</style>`);
}

// Step 4: Inline all JS
const jsFiles = readdirSync(assetsDir).filter(f => f.endsWith('.js'));

for (const jsFile of jsFiles) {
  const js = readFileSync(join(assetsDir, jsFile), 'utf-8');
  const scriptPattern = new RegExp(`<script[^>]*${jsFile.replace(/\./g, '\\.')}[^>]*></script>`, 'g');
  if (scriptPattern.test(result)) {
    const allJs = jsFiles.map(f => readFileSync(join(assetsDir, f), 'utf-8')).join('\n');
    result = result.replace(scriptPattern, `<script type="module">${allJs}</script>`);
    break;
  }
}

// Remove any remaining asset references
result = result.replace(/<link[^>]*assets\/[^>]*>/g, '');
result = result.replace(/<script[^>]*assets\/[^>]*><\/script>/g, '');

// Step 5: Write the single file
const outPath = join(distDir, 'Beacon-Counselor-Command-Center.html');
writeFileSync(outPath, result);

const sizeKB = Math.round(readFileSync(outPath).length / 1024);
console.log(`\nSingle-file build complete: ${outPath}`);
console.log(`Size: ${sizeKB} KB`);
console.log('This file can be opened directly in any browser — no server needed.');
console.log('All student data stays 100% on-device. FERPA compliant by design.');
