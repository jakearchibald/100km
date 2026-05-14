import { renderOgImage } from './og-image.ts';
import { injectOgMeta } from './meta-inject.ts';

function hasShareParams(url: URL): boolean {
  return (
    url.searchParams.has('lat') &&
    url.searchParams.has('lon') &&
    url.searchParams.has('t')
  );
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/og-image.jpg') {
      try {
        return await renderOgImage(req, env);
      } catch (err) {
        console.error('og-image failed', err);
        return new Response('og-image render failed', { status: 500 });
      }
    }

    if (
      req.method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/index.html') &&
      hasShareParams(url)
    ) {
      return injectOgMeta(req, env);
    }

    return env.ASSETS.fetch(req);
  },
};
