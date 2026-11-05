import { legends } from '../lib/data';
import { canonicalUrl } from '../lib/seo.js';

export function GET() {
  const paths = ['', 'teksti/', 'temas/', 'personas/', 'karte/', 'dati/', 'par-projektu/', ...legends.map(legend => `teksti/${legend.id}/`)];
  const urls = paths.map(path => `<url><loc>${canonicalUrl(`/teikas/${path}`)}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
