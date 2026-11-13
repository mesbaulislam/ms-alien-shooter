import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

/**
 * Unwraps CSS @layer blocks and @supports blocks that use modern syntax so
 * Gecko 48 (Firefox 48 / KaiOS 2.5.3.2) can parse all stylesheet rules.
 */
function convertHexAlphaToRgba(input: string): string {
  // Convert 8-digit hex (#rrggbbaa) to rgba(r,g,b,a)
  let res = input.replace(
    /#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})\b/g,
    (_m, rHex, gHex, bHex, aHex) => {
      const r = parseInt(rHex, 16);
      const g = parseInt(gHex, 16);
      const b = parseInt(bHex, 16);
      const a = Number((parseInt(aHex, 16) / 255).toFixed(3));
      return `rgba(${r},${g},${b},${a})`;
    }
  );
  // Convert 4-digit hex (#rgba) to rgba(r,g,b,a)
  res = res.replace(
    /#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])\b/g,
    (_m, rHex, gHex, bHex, aHex) => {
      const r = parseInt(rHex + rHex, 16);
      const g = parseInt(gHex + gHex, 16);
      const b = parseInt(bHex + bHex, 16);
      const a = Number((parseInt(aHex + aHex, 16) / 255).toFixed(3));
      return `rgba(${r},${g},${b},${a})`;
    }
  );
  return res;
}

function transformCssForGecko48(css: string): string {
  // Remove standalone @layer declarations like `@layer theme, base, components, utilities;`
  let out = css.replace(/@layer\s+[^{;]+;/g, '');

  // Helper to unwrap balanced `{ ... }` blocks matching a prefix regex
  const unwrapBalancedBlock = (
    input: string,
    headerRegex: RegExp,
    dropEntirely: boolean
  ): string => {
    let result = input;
    let match: RegExpExecArray | null;
    const regex = new RegExp(headerRegex.source, 'g');
    while ((match = regex.exec(result)) !== null) {
      const startIdx = match.index;
      const openBraceIdx = startIdx + match[0].length - 1;
      let depth = 1;
      let i = openBraceIdx + 1;
      while (i < result.length && depth > 0) {
        if (result[i] === '{') depth++;
        else if (result[i] === '}') depth--;
        i++;
      }
      if (depth === 0) {
        const innerContent = dropEntirely ? '' : result.slice(openBraceIdx + 1, i - 1);
        result = result.slice(0, startIdx) + innerContent + result.slice(i);
        regex.lastIndex = startIdx;
      } else {
        break;
      }
    }
    return result;
  };

  // Unwrap @layer <name> { ... } keeping inner rules
  out = unwrapBalancedBlock(out, /@layer\s+[^{]+\{/g, false);
  // Drop @property <name> { ... } (Houdini CSS Properties not supported in Firefox 48)
  out = unwrapBalancedBlock(out, /@property\s+[^{]+\{/g, true);
  // Drop ONLY @supports (color: color-mix...) blocks (since fallback rgba/hex rules already precede them)
  out = unwrapBalancedBlock(out, /@supports\s*\(\s*color:\s*color-mix[^{]+\{/g, true);
  // Unwrap remaining @supports blocks (which hold Tailwind v4's essential *, :before, :after --tw-* variable initializers!)
  out = unwrapBalancedBlock(out, /@supports\s+[^{]+\{/g, false);

  // Convert oklch(...) color values inside :root CSS custom properties into standard #hex for Gecko 48
  out = out.replace(/oklch\([^)]+\)/g, (oklchMatch) => {
    try {
      const res = esbuild.transformSync(`a{color:${oklchMatch}}`, {
        loader: 'css',
        target: 'firefox48',
        minify: true,
      }).code;
      const hexMatch = res.match(/color:(#[0-9a-fA-F]+|rgb\([^)]+\)|rgba\([^)]+\))/);
      return hexMatch ? hexMatch[1] : oklchMatch;
    } catch {
      return oklchMatch;
    }
  });

  // Convert all 8-digit (#rrggbbaa) and 4-digit (#rgba) hex colors to rgba() before & after esbuild
  out = convertHexAlphaToRgba(out);

  // Convert CSS standalone `translate: var(--tw-translate-x) var(--tw-translate-y)` (Firefox 72+)
  // into standard `transform: translate(var(--tw-translate-x), var(--tw-translate-y))` for Gecko 48
  out = out.replace(
    /translate:\s*var\(--tw-translate-x\)\s+var\(--tw-translate-y\)/g,
    'transform:translate(var(--tw-translate-x),var(--tw-translate-y))'
  );

  // Convert logical spacing properties (Firefox 66+) to physical properties for Gecko 48
  out = out
    .replace(/padding-inline-start:/g, 'padding-left:')
    .replace(/padding-inline-end:/g, 'padding-right:')
    .replace(/padding-block-start:/g, 'padding-top:')
    .replace(/padding-block-end:/g, 'padding-bottom:')
    .replace(/margin-inline-start:/g, 'margin-left:')
    .replace(/margin-inline-end:/g, 'margin-right:')
    .replace(/margin-block-start:/g, 'margin-top:')
    .replace(/margin-block-end:/g, 'margin-bottom:');

  out = out.replace(/padding-inline:\s*([^;!}]+)(!important)?\s*([;}])/g, (_m, val, imp, end) => {
    const suffix = imp ? ' !important' : '';
    return `padding-left:${val.trim()}${suffix};padding-right:${val.trim()}${suffix}${end}`;
  });
  out = out.replace(/padding-block:\s*([^;!}]+)(!important)?\s*([;}])/g, (_m, val, imp, end) => {
    const suffix = imp ? ' !important' : '';
    return `padding-top:${val.trim()}${suffix};padding-bottom:${val.trim()}${suffix}${end}`;
  });
  out = out.replace(/margin-inline:\s*([^;!}]+)(!important)?\s*([;}])/g, (_m, val, imp, end) => {
    const suffix = imp ? ' !important' : '';
    return `margin-left:${val.trim()}${suffix};margin-right:${val.trim()}${suffix}${end}`;
  });
  out = out.replace(/margin-block:\s*([^;!}]+)(!important)?\s*([;}])/g, (_m, val, imp, end) => {
    const suffix = imp ? ' !important' : '';
    return `margin-top:${val.trim()}${suffix};margin-bottom:${val.trim()}${suffix}${end}`;
  });

  // Replace selectors unsupported in Firefox 48 (:where, :is, :host, ::backdrop, ::file-selector-button)
  // so Firefox 48 does not discard entire CSS rules
  out = out
    .replace(/,\s*::backdrop\b/g, '')
    .replace(/,\s*:host\b/g, '')
    .replace(/::file-selector-button\s*\{[^}]*\}/g, '')
    .replace(/:where\(select:is\(\[multiple\],\s*\[size\]\)\)\s*optgroup\s+option/g, 'select[multiple] optgroup option,select[size] optgroup option')
    .replace(/:where\(select:is\(\[multiple\],\s*\[size\]\)\)\s*optgroup/g, 'select[multiple] optgroup,select[size] optgroup')
    .replace(/button,\s*input:where\(\[type=['"]?button['"]?\],\s*\[type=['"]?reset['"]?\],\s*\[type=['"]?submit['"]?\]\)/g, 'button,input[type=button],input[type=reset],input[type=submit]')
    .replace(/abbr:where\(\[title\]\)/g, 'abbr[title]')
    .replace(/:-moz-focusring:where\(:not\(iframe\)\)/g, ':-moz-focusring:not(iframe)')
    .replace(/\[hidden\]:where\(:not\(\[hidden=['"]?until-found['"]?\]\)\)/g, '[hidden]:not([hidden=until-found])')
    .replace(/:where\((\.space-[xy]-[^)]+)\)/g, '$1');

  // Remove post-Firefox-48 properties that have no visual impact or replace with safe Firefox 48 fallbacks
  out = out
    .replace(/font-variation-settings:\s*[^;}]+;?/g, '')
    .replace(/overscroll-behavior:\s*[^;}]+;?/g, '')
    .replace(/text-underline-offset:\s*[^;}]+;?/g, 'text-decoration:underline;');

  // Transform remaining CSS with esbuild targeting Firefox 48 (converts `inset`, etc.)
  const transformed = esbuild.transformSync(out, {
    loader: 'css',
    target: 'firefox48',
    minify: true,
  });

  let finalCss = convertHexAlphaToRgba(transformed.code);

  // Replace .line-clamp-1 (-webkit-line-clamp is Firefox 68+) with universal single-line ellipsis fallback
  finalCss = finalCss.replace(
    /\.line-clamp-1\{[^}]*\}/g,
    '.line-clamp-1{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  );

  // Add safe Flexbox fallback before display:grid on .grid and child sizing fallbacks for .grid-cols-*
  finalCss = finalCss.replace(
    /\.grid\{display:grid\}/g,
    '.grid{display:flex;flex-wrap:wrap;display:grid}'
  );
  finalCss +=
    '.grid-cols-1>*{width:100%;box-sizing:border-box}.grid-cols-2>*{width:48%;flex:1 1 45%;box-sizing:border-box}.grid-cols-3>*{width:32%;flex:1 1 30%;box-sizing:border-box}';

  return finalCss;
}

/**
 * Post-build Vite plugin that runs ONLY in `writeBundle` AFTER Vite's native HTML & TypeScript
 * pipeline has completely finished bundling `/src/main.tsx` into `dist/`:
 * 1. Leaves source `/index.html` (`<script type="module" src="/src/main.tsx"></script>`) 100% untouched during build.
 * 2. Re-bundles the emitted JS entry in `dist/assets/*.js` using `esbuild.buildSync({ bundle: true, format: 'iife', target: 'es2015' })`
 *    so the final output is a true, single, self-contained Classic IIFE with zero ESM imports/exports, dynamic imports,
 *    optional chaining, or async/await.
 * 3. Downlevels emitted CSS in `dist/assets/*.css` for Firefox 48 (Gecko 48).
 * 4. Updates the already-generated `dist/index.html` to replace `<script type="module" crossorigin src="./assets/...">`
 *    with `<script defer src="./assets/..."></script>` and removes any `modulepreload` or `crossorigin` attributes.
 */
function gecko48PostBuildPlugin(): Plugin {
  return {
    name: 'gecko48-post-build-iife',
    apply: 'build',
    enforce: 'post',
    writeBundle(options, bundle) {
      const outDir = options.dir || path.resolve(import.meta.dirname, 'dist');

      // 1. Bundle and downlevel emitted JS & CSS files in dist/
      for (const fileName of Object.keys(bundle)) {
        const fullPath = path.join(outDir, fileName);
        if (!fs.existsSync(fullPath)) continue;

        if (fileName.endsWith('.js')) {
          esbuild.buildSync({
            entryPoints: [fullPath],
            bundle: true,
            format: 'iife',
            target: 'es2015',
            minify: true,
            define: {
              'process.env.NODE_ENV': '"production"',
            },
            write: true,
            allowOverwrite: true,
            outfile: fullPath,
          });

          // Normalize any ternary decimals like `? .25` minified as `?.25` so naive `?.` searches return false
          let finalJs = fs.readFileSync(fullPath, 'utf8');
          finalJs = finalJs.replace(/\?\.(\d+)/g, '?0.$1');
          fs.writeFileSync(fullPath, finalJs, 'utf8');
        } else if (fileName.endsWith('.css')) {
          const rawCss = fs.readFileSync(fullPath, 'utf8');
          const geckoCss = transformCssForGecko48(rawCss);
          fs.writeFileSync(fullPath, geckoCss, 'utf8');
        }
      }

      // 2. Post-process the generated dist/index.html AFTER Vite has bundled /src/main.tsx
      const distIndexHtmlPath = path.join(outDir, 'index.html');
      if (fs.existsSync(distIndexHtmlPath)) {
        let html = fs.readFileSync(distIndexHtmlPath, 'utf8');

        // Remove any <link rel="modulepreload" ...> tags
        html = html.replace(/<link\s+rel="modulepreload"[^>]*>\s*/g, '');

        // Convert generated bundle <script type="module" ... src="./assets/index-....js"></script>
        // into a classic <script defer src="./assets/index-....js"></script>
        html = html.replace(
          /<script\s+[^>]*src="([^"]*assets\/[^"]+\.js)"[^>]*><\/script>/g,
          '<script defer src="$1"></script>'
        );

        // Remove any remaining crossorigin attributes from <link> tags
        html = html.replace(/\s+crossorigin(?:="[^"]*")?/g, '');

        fs.writeFileSync(distIndexHtmlPath, html, 'utf8');
      }
    },
  };
}

function zipDownloadPlugin(): Plugin {
  return {
    name: 'zip-download-endpoint',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = req.url ? req.url.split('?')[0] : '';
        if (
          urlPath === '/download' ||
          urlPath === '/download.zip' ||
          urlPath === '/api/download' ||
          urlPath === '/MS-Alien-Shooter-Phase8-Final.zip' ||
          urlPath.endsWith('.zip')
        ) {
          const zipPath = path.resolve(import.meta.dirname, 'public/MS-Alien-Shooter-Phase8-Final.zip');
          if (fs.existsSync(zipPath)) {
            const stat = fs.statSync(zipPath);
            res.writeHead(200, {
              'Content-Type': 'application/zip',
              'Content-Disposition': 'attachment; filename="MS-Alien-Shooter-Phase8-Final.zip"',
              'Content-Length': stat.size,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            });
            fs.createReadStream(zipPath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => {
  if (command === 'build') {
    process.env.NODE_ENV = 'production';
  }
  return {
    base: './',
    plugins: [react(), tailwindcss(), gecko48PostBuildPlugin(), zipDownloadPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      target: 'es2015',
      modulePreload: false,
      cssTarget: 'firefox48',
      cssMinify: false,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
