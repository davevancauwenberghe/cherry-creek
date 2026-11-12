import type { APIRoute } from 'astro';
import { statusService } from '@/lib/status/index.ts';

export const prerender = false;

export const GET: APIRoute = async () => {
  const status = await statusService.get();
  return new Response(JSON.stringify(status), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Browsers and Cloudflare may reuse the answer for a short while.
      'Cache-Control': `public, max-age=${Math.min(status.ttl, 30)}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
