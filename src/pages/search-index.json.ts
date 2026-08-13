import type { APIRoute } from 'astro';
import { legends } from '../lib/data';

export const GET: APIRoute = () => new Response(JSON.stringify(legends.map(legend => ({
  id: legend.id,
  lv: legend.text.lv ?? '',
  de: legend.text.de ?? '',
}))), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=31536000, immutable' } });
