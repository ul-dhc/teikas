import type { APIRoute, GetStaticPaths } from 'astro';
import { browseRecords } from '../../lib/data';

export const getStaticPaths = (() => browseRecords.map((record, index) => ({
  params: { index: String(index) },
  props: { record },
}))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.record), {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
});
