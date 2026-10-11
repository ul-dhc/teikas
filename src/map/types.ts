export type PlaceGeography = {
 verification: string; precision: string; displayStatus: string; coordinateSource: string; reason: string;
 mapUncertainty?: {kind: "none" | "area" | "ambiguous"; reason: string};
 nameEvidence?: Array<{name:string;code:string;kind:string;sourceUrl:string}>;
 authority: {name: string; id: number; featureType: string; sourceUrl: string; coordinateSystem: string} | null;
};
export type PlaceProperties = {
  id: string;
  name: string;
  count: number;
  yearFrom: number | null;
  yearTo: number | null;
  collectorCount: number;
  narratorCount: number;
  legendIds: string;
  geography?: PlaceGeography;
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
  county: string;
  genre: string;
  translation: string;
  collectorId: string;
  narratorId: string;
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

export type NetworkNode = {
  kind?: string;
  illustrative?: boolean;
  id: string;
  name: string;
  coordinates: [number, number];
  count: number;
  connectionCount: number;
  plotCount: number;
  dominantTheme: string;
  collectors?: Array<{id: string; name: string; count: number}>;
  themes: Array<[string, number]>;
  plots: Array<[string, number]>;
  legendIds: string[];
  color: string;
};

export type NetworkEdge = {
  count?: number;
  legendIds?: string[];
  id: string;
  fromId: string;
  toId: string;
  strength: number;
  sharedCount: number;
  strongest: Array<{ key?: string; plot: string; from: number; to: number; weight: number }>;
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
