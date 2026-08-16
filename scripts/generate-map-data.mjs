import { readFile, writeFile, mkdir } from "node:fs/promises";

const project = new URL("../", import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, project), "utf8"));
const places = await readJson("teikas_json/places.json");
const legends = await readJson("teikas_json/legends.json");
const collectors = await readJson("teikas_json/collectors.json");
const narrators = await readJson("teikas_json/narrators.json");
const collectorNames = new Map(
  collectors.map((collector) => [collector.id, collector.fullName]),
);
const narratorNames = new Map(
  narrators.map((narrator) => [narrator.id, narrator.fullName]),
);
const mappedPlaces = new Map(
  places.filter((place) => place.coordinates).map((place) => [place.id, place]),
);
const allPlaces = new Map(places.map((place) => [place.id, place]));
const placeDetails = new Map();

for (const legend of legends) {
  if (!legend.placeId || !mappedPlaces.has(legend.placeId)) continue;
  const detail = placeDetails.get(legend.placeId) ?? {
    years: new Set(),
    collectors: new Set(),
    narrators: new Set(),
    legendIds: [],
  };
  const year = legend.originalMetadata?.match(/\b(1[6-9]\d{2}|20\d{2})\b/)?.[1];
  if (year) detail.years.add(Number(year));
  if (legend.collectorId) detail.collectors.add(legend.collectorId);
  if (legend.narratorId) detail.narrators.add(legend.narratorId);
  detail.legendIds.push(legend.id);
  placeDetails.set(legend.placeId, detail);
}

const placeFeatures = [...mappedPlaces.values()].map((place) => {
  const detail = placeDetails.get(place.id) ?? {
    years: new Set(),
    collectors: new Set(),
    narrators: new Set(),
    legendIds: [],
  };
  const years = [...detail.years].sort((a, b) => a - b);
  return {
    type: "Feature",
    id: place.id,
    geometry: {
      type: "Point",
      coordinates: [place.coordinates.longitude, place.coordinates.latitude],
    },
    properties: {
      id: place.id,
      name: place.name,
      count: place.legendCount,
      yearFrom: years[0] ?? null,
      yearTo: years.at(-1) ?? null,
      collectorCount: detail.collectors.size,
      narratorCount: detail.narrators.size,
      legendIds: detail.legendIds.join(","),
    },
  };
});

const legendProperties = (legend, place) => {
  const collector = collectorNames.get(legend.collectorId) ?? "";
  return {
    id: legend.id,
    placeId: place?.id ?? legend.placeId ?? "",
    placeName: place?.name ?? "",
    titleLv: legend.title?.lv ?? "",
    titleDe: legend.title?.de ?? "",
    themeLv: legend.chapter?.lv ?? "",
    themeDe: legend.chapter?.de ?? "",
    volume: legend.volume ?? "",
    collector: collector === "Nezināms" ? "" : collector,
    narrator: legend.narratorId ? narratorNames.get(legend.narratorId) ?? "" : "",
    year: legend.originalMetadata?.match(/\b(1[6-9]\d{2}|20\d{2})\b/)?.[1] ?? null,
    coordinateSource: legend.originalCoordinates ? "original" : "place",
  };
};

const legendFeatures = legends.flatMap((legend) => {
  const place = legend.placeId ? mappedPlaces.get(legend.placeId) : null;
  if (!place) return [];
  const coordinates = legend.originalCoordinates ?? place.coordinates;
  return [{
    type: "Feature",
    id: legend.id,
    geometry: {
      type: "Point",
      coordinates: [coordinates.longitude, coordinates.latitude],
    },
    properties: legendProperties(legend, place),
  }];
});
const unmappedLegends = legends
  .filter((legend) => !legend.placeId || !mappedPlaces.has(legend.placeId))
  .map((legend) => legendProperties(legend, legend.placeId ? allPlaces.get(legend.placeId) : null));

const curveCoordinates = (from, to, key) => {
  const start = [from.coordinates.longitude, from.coordinates.latitude];
  const end = [to.coordinates.longitude, to.coordinates.latitude];
  const latitude = (start[1] + end[1]) / 2;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);
  const dx = (end[0] - start[0]) * longitudeScale;
  const dy = end[1] - start[1];
  const distance = Math.hypot(dx, dy);
  const direction = [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % 2 ? 1 : -1;
  const offset = Math.min(0.34, Math.max(0.025, distance * 0.11)) * direction;
  const control = [
    (start[0] + end[0]) / 2 - (dy / Math.max(distance, 0.001)) * offset / longitudeScale,
    (start[1] + end[1]) / 2 + (dx / Math.max(distance, 0.001)) * offset,
  ];
  return Array.from({ length: 17 }, (_, index) => {
    const time = index / 16;
    const inverse = 1 - time;
    return [
      inverse * inverse * start[0] + 2 * inverse * time * control[0] + time * time * end[0],
      inverse * inverse * start[1] + 2 * inverse * time * control[1] + time * time * end[1],
    ];
  });
};

const createNetwork = (entityValue, entityLabel, minimumStrength, limit = 250) => {
  const entityPlaces = new Map();
  for (const legend of legends) {
    if (!legend.placeId || !mappedPlaces.has(legend.placeId)) continue;
    const value = entityValue(legend);
    if (!value) continue;
    const placeIds = entityPlaces.get(value) ?? new Set();
    placeIds.add(legend.placeId);
    entityPlaces.set(value, placeIds);
  }
  const edgeEntities = new Map();
  for (const [entityId, placeIds] of entityPlaces) {
    const ids = [...placeIds].sort();
    for (let first = 0; first < ids.length; first += 1) {
      for (let second = first + 1; second < ids.length; second += 1) {
        const key = `${ids[first]}|${ids[second]}`;
        const shared = edgeEntities.get(key) ?? new Set();
        shared.add(entityId);
        edgeEntities.set(key, shared);
      }
    }
  }
  return [...edgeEntities.entries()]
    .filter(([, shared]) => shared.size >= minimumStrength)
    .sort((first, second) => second[1].size - first[1].size)
    .slice(0, limit)
    .map(([key, shared]) => {
    const [fromId, toId] = key.split("|");
    const from = mappedPlaces.get(fromId);
    const to = mappedPlaces.get(toId);
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: curveCoordinates(from, to, key),
      },
      properties: {
        id: key,
        fromId,
        toId,
        strength: shared.size,
        labels: [...shared]
          .map(entityLabel)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "lv"))
          .join(" · "),
      },
    };
  });
};

const networks = {
  collectors: {
    type: "FeatureCollection",
    features: createNetwork(
      (legend) => legend.collectorId,
      (id) => collectorNames.get(id),
      2,
    ),
  },
  narrators: {
    type: "FeatureCollection",
    features: createNetwork(
      (legend) => legend.narratorId,
      (id) => narratorNames.get(id),
      1,
    ),
  },
  themes: {
    type: "FeatureCollection",
    features: createNetwork(
      (legend) => legend.chapter?.lv,
      (value) => value,
      2,
      180,
    ),
  },
};

const countryUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const coastUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson";
const boundaryUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces_lines.geojson";
const riverUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson";
const lakeUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson";
const cityUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson";
const basemapResponses = await Promise.all([
  fetch(countryUrl),
  fetch(coastUrl),
  fetch(boundaryUrl),
  fetch(riverUrl),
  fetch(lakeUrl),
  fetch(cityUrl),
]).catch(() => null);
let northernEurope;
if (!basemapResponses) {
  northernEurope = await readJson("public/data/map/northern-europe.json");
} else {
const [countryResponse, coastResponse, boundaryResponse, riverResponse, lakeResponse, cityResponse] = basemapResponses;
if (!countryResponse.ok || !coastResponse.ok || !boundaryResponse.ok || !riverResponse.ok || !lakeResponse.ok || !cityResponse.ok) {
  northernEurope = await readJson("public/data/map/northern-europe.json");
} else {
const [countries, coastlines, boundaries, rivers, lakes, cities] = await Promise.all([
  countryResponse.json(),
  coastResponse.json(),
  boundaryResponse.json(),
  riverResponse.json(),
  lakeResponse.json(),
  cityResponse.json(),
]);
const withinRegion = (coordinates) =>
  typeof coordinates[0] === "number"
    ? coordinates[0] >= -25 &&
      coordinates[0] <= 50 &&
      coordinates[1] >= 47 &&
      coordinates[1] <= 72
    : coordinates.some(withinRegion);
const regionNames = new Set([
  "Belarus",
  "Belgium",
  "Denmark",
  "Estonia",
  "Finland",
  "Germany",
  "Iceland",
  "Ireland",
  "Latvia",
  "Lithuania",
  "Netherlands",
  "Norway",
  "Poland",
  "Russia",
  "Sweden",
  "Ukraine",
  "United Kingdom",
]);
northernEurope = {
  land: {
    type: "FeatureCollection",
    features: countries.features
      .filter((feature) => regionNames.has(feature.properties.ADMIN))
      .map((feature) => ({
        type: "Feature",
        properties: { name: feature.properties.ADMIN },
        geometry: feature.geometry,
      })),
  },
  coast: {
    type: "FeatureCollection",
    features: coastlines.features.filter((feature) =>
      withinRegion(feature.geometry.coordinates),
    ),
  },
  boundaries: {
    type: "FeatureCollection",
    features: boundaries.features.filter((feature) =>
      withinRegion(feature.geometry.coordinates),
    ),
  },
  rivers: {
    type: "FeatureCollection",
    features: rivers.features.filter((feature) =>
      withinRegion(feature.geometry.coordinates),
    ),
  },
  lakes: {
    type: "FeatureCollection",
    features: lakes.features.filter((feature) =>
      withinRegion(feature.geometry.coordinates),
    ),
  },
  cities: {
    type: "FeatureCollection",
    features: cities.features
      .filter((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        return (
          longitude >= -25 &&
          longitude <= 50 &&
          latitude >= 47 &&
          latitude <= 72 &&
          Number(feature.properties.scalerank) <= 3
        );
      })
      .map((feature) => ({
        type: "Feature",
        properties: {
          name: feature.properties.name,
          rank: feature.properties.scalerank,
        },
        geometry: feature.geometry,
      })),
  },
};
}
}

await mkdir(new URL("public/data/map/", project), { recursive: true });
await mkdir(new URL("src/data/", project), { recursive: true });
await writeFile(
  new URL("public/data/map/northern-europe.json", project),
  `${JSON.stringify(northernEurope)}\n`,
);
await writeFile(
  new URL("src/data/map-data.json", project),
  `${JSON.stringify({
    places: { type: "FeatureCollection", features: placeFeatures },
    legends: { type: "FeatureCollection", features: legendFeatures },
    unmappedLegends,
    networks,
    unmappedPlaceCount: places.length - mappedPlaces.size,
    unmappedLegendCount: unmappedLegends.length,
    sources: {
      corpus: "latvian_legends_master_data.xlsx",
      geography: [countryUrl, coastUrl, boundaryUrl, riverUrl, lakeUrl, cityUrl],
    },
  })}\n`,
);
console.log(
  `Generated ${placeFeatures.length} places, ${legendFeatures.length} legend points and ${Object.values(networks).reduce((total, network) => total + network.features.length, 0)} network edges.`,
);
