export type PlaceProperties = {
  id: string;
  name: string;
  count: number;
  yearFrom: number | null;
  yearTo: number | null;
  collectorCount: number;
  narratorCount: number;
  legendIds: string;
};

export type LegendProperties = {
  id: string;
  placeId: string;
  placeName: string;
  titleLv: string;
  titleDe: string;
  themeLv: string;
  themeDe: string;
  volume: string;
  collector: string;
  narrator: string;
  year: string | null;
  coordinateSource: "original" | "place";
};

export type PlaceFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: PlaceProperties;
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: any[];
};

export type SimilarityNode = {
  id: string;
  name: string;
  coordinates: [number, number];
  count: number;
  plotCount: number;
  dominantTheme: string;
  themes: Array<[string, number]>;
  plots: Array<[string, number]>;
  legendIds: string[];
  color: string;
};

export type SimilarityEdge = {
  id: string;
  fromId: string;
  toId: string;
  similarity: number;
  sharedCount: number;
  strongest: Array<{ plot: string; from: number; to: number; weight: number }>;
  coordinates: number[][];
};

export type MapDataset = {
  places: { type: "FeatureCollection"; features: PlaceFeature[] };
  legends: FeatureCollection;
  unmappedLegends: LegendProperties[];
  networks: Record<string, FeatureCollection>;
  unmappedPlaceCount: number;
  unmappedLegendCount: number;
};
