import type { APIRoute } from 'astro';

export const prerender = false;

/** Liveness probe for Docker/Coolify. Deliberately does not touch Minecraft. */
export const GET: APIRoute = () =>
  new Response('ok', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
