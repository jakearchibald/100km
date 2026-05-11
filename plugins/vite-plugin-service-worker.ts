import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

const TEMPLATE = 'sw/sw.template.js';
const OUTPUT = 'sw.js';

const SKIP = new Set(['sw.js', '_headers', '.assetsignore', 'wrangler.json', 'index.html']);

function isIcon(path: string): boolean {
  const name = path.split('/').pop() ?? '';
  return /^(icon[-.]|apple-touch-icon)/i.test(name);
}

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else if (entry.isFile()) {
      out.push('/' + relative(base, full).replaceAll('\\', '/'));
    }
  }
  return out;
}

export default function serviceWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'vite-plugin-service-worker',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    async closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      const templatePath = resolve(config.root, TEMPLATE);
      const swPath = join(outDir, OUTPUT);

      const allFiles = await walk(outDir);
      const precache = allFiles.filter((p) => {
        const name = p.slice(1);
        if (SKIP.has(name)) return false;
        if (isIcon(p)) return false;
        return true;
      });
      // Always include '/' so the navigation entry is cached.
      const precacheWithRoot = Array.from(new Set([...precache, '/']));
      precacheWithRoot.sort();

      // Hash the precache list so the cache name changes whenever any precached file does.
      const listHash = createHash('sha256')
        .update(precacheWithRoot.join('\n'))
        .digest('hex')
        .slice(0, 16);
      const cacheName = `100km-${listHash}`;

      const template = await readFile(templatePath, 'utf8');
      const sw = template
        .replaceAll('__PRECACHE_LIST__', JSON.stringify(precacheWithRoot))
        .replaceAll('__CACHE_NAME__', cacheName);

      // Append a content hash of the SW body so the browser always sees a byte change
      // when the precache list (or template) changes, triggering an update.
      const swBodyHash = createHash('sha256').update(sw).digest('hex').slice(0, 12);
      const finalSw = `${sw}\n// build:${swBodyHash}\n`;
      await writeFile(swPath, finalSw);

      const totalBytes = (
        await Promise.all(
          precache.map(async (p) => {
            try {
              return (await stat(join(outDir, p.slice(1)))).size;
            } catch {
              return 0;
            }
          }),
        )
      ).reduce((s, n) => s + n, 0);

      this.info(
        `service worker emitted: ${precache.length} files precached (~${(totalBytes / 1024).toFixed(0)} kB), cache=${cacheName}`,
      );
    },
  };
}
