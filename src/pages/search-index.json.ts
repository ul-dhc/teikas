import type { APIRoute } from 'astro';
import { legends, resolveLegend, sourceLabel, legendYear } from '../lib/data';
import { createSearchMetadata } from '../lib/search';

export const GET: APIRoute = () => new Response(JSON.stringify(legends.map(legend => {
  const {collector, narrator, place, primarySources, secondarySources} = resolveLegend(legend);
  return {
    id: legend.id, lv: legend.text.lv ?? '', de: legend.text.de ?? '',
    metadata: createSearchMetadata(legend, [
      collector?.fullName, narrator?.fullName, place?.name, legendYear(legend),
      ...[...primarySources, ...secondarySources].flatMap(({source, relation}) => [sourceLabel(source), source.code, relation.rawCitation]),
    ]),
  };
})), {headers: {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'public, max-age=31536000, immutable'}});
