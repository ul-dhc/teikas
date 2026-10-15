import {showPlatformTooltip,movePlatformTooltip,hidePlatformTooltip} from '../scripts/tooltips';
import {encodeSelection} from '../lib/selection.js';
import * as maplibregl from "maplibre-gl";
import { createElement, Maximize, Minimize, MapPin } from "lucide";
import workerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import { buildMetadataNetwork, strongestConnectionIds, indexNetworkEdges, networkRenderCollection, visibleNetworkEdges } from "./networks.js";
import { installUncertaintyStrokes } from "./uncertainty";
import { placeProfileMarkup, placeProfileSelection, pointCoordinateKey } from "./place-profile";
import type { LegendProperties, MapDataset, PlaceProperties, NetworkEdge, NetworkNode } from "./types";
const page = document.querySelector<HTMLElement>("[data-map-page]")!,
  mapStage = page.querySelector<HTMLElement>(".map-stage")!,
  container = page.querySelector<HTMLElement>("[data-map]")!,
  panel = page.querySelector<HTMLElement>("[data-map-panel]")!,
  layerMenu = page.querySelector<HTMLDetailsElement>("[data-layer-menu]")!,
  countLabel = page.querySelector<HTMLAnchorElement>("[data-map-count]")!,
  countText = countLabel.querySelector<HTMLElement>("[data-map-count-text]")!,
  heatKey = page.querySelector<HTMLElement>("[data-heat-key]")!,
  heatControls = page.querySelector<HTMLElement>("[data-heat-controls]")!,
  pointControls = page.querySelector<HTMLElement>("[data-point-controls]")!,
  networkToolbar = page.querySelector<HTMLDetailsElement>("[data-network-toolbar]")!,
  networkContext = page.querySelector<HTMLElement>("[data-network-context]")!,
  heatInput = page.querySelector<HTMLInputElement>(
    "[data-heat-intensity]",
  )!,
  heatOutput = page.querySelector<HTMLOutputElement>("[data-heat-output]")!,
  placesSize = page.querySelector<HTMLInputElement>("[data-places-size]")!,
  placesSizeOutput = page.querySelector<HTMLOutputElement>("[data-places-size-output]")!,
  pointIntensity = page.querySelector<HTMLInputElement>("[data-point-intensity]")!,
  pointIntensityOutput = page.querySelector<HTMLOutputElement>("[data-point-intensity-output]")!,
  heatRadius = page.querySelector<HTMLInputElement>("[data-heat-radius]")!,
  radiusOutput = page.querySelector<HTMLOutputElement>(
    "[data-radius-output]",
  )!,
  networkType = page.querySelector<HTMLSelectElement>(
    "[data-network-type]",
  )!,
  networkStrongestOnly = page.querySelector<HTMLInputElement>("[data-network-strongest-only]")!,
  networkVisibility = page.querySelector<HTMLElement>("[data-network-visibility]")!,
  networkSizeBy = page.querySelector<HTMLSelectElement>("[data-network-size-by]")!,
  networkOthers = page.querySelector<HTMLSelectElement>("[data-network-others]")!,
  networkSize = page.querySelector<HTMLInputElement>("[data-network-size]")!,
  networkSizeOutput = page.querySelector<HTMLOutputElement>("[data-network-size-output]")!,
  networkIntensity = page.querySelector<HTMLInputElement>("[data-network-intensity]")!,
  networkIntensityOutput = page.querySelector<HTMLOutputElement>("[data-network-intensity-output]")!,
  networkColor = page.querySelector<HTMLSelectElement>("[data-network-color]")!,
  basemapStyle = page.querySelector<HTMLInputElement>(
    "[data-basemap-style]",
  )!,
  basemapMenu = page.querySelector<HTMLDetailsElement>("[data-basemap-menu]")!,
  basemapLabel = page.querySelector<HTMLElement>("[data-basemap-label]")!,
  filterPanel = page.querySelector<HTMLElement>("[data-map-filters]")!,
  filterClear = page.querySelector<HTMLButtonElement>("[data-map-filter-clear]")!,
  yearFromInput = page.querySelector<HTMLInputElement>("[data-map-year-from-input]")!,
  yearToInput = page.querySelector<HTMLInputElement>("[data-map-year-to-input]")!,
  yearFromOutput = page.querySelector<HTMLOutputElement>("[data-map-year-from]")!,
  yearToOutput = page.querySelector<HTMLOutputElement>("[data-map-year-to]")!,
  includeUndated = page.querySelector<HTMLInputElement>("[data-map-undated]")!,
  includeUnknownPlace = page.querySelector<HTMLInputElement>('[data-map-include-unknown="place"]')!,
  mobileFilterToggle = page.querySelector<HTMLButtonElement>("[data-map-mobile-filter-toggle]")!,
  filterCollapse = page.querySelector<HTMLSpanElement>("[data-map-filter-collapse]")!,
  mapWorkspace = page.querySelector<HTMLElement>(".map-workspace")!,
  downloadMenu = page.querySelector<HTMLDetailsElement>("[data-map-download]")!,
  downloadHint = page.querySelector<HTMLElement>("[data-map-download-hint]")!,
  emptyState = page.querySelector<HTMLElement>("[data-map-empty-state]")!;
const dataset = JSON.parse(
    document.querySelector("#corpus-map-data")!.textContent || "{}",
  ) as MapDataset,
  base = page.dataset.base || "/teikas/",
  tr = (key: string, values: Record<string, string | number> = {}) =>
    typeof (window as any).teikasT === "function"
      ? (window as any).teikasT(key, values)
      : key,
  formatter = () => new Intl.NumberFormat(document.documentElement.lang),
  params = new URLSearchParams(location.search);
const placeUncertaintyById = new Map(dataset.places.features.map(place => [place.properties.id, place.properties.geography?.mapUncertainty?.kind || 'none']));
for (const feature of dataset.legends.features) (feature.properties as any).locationUncertain = ['area', 'ambiguous'].includes(placeUncertaintyById.get(feature.properties.placeId) || 'none') ? 1 : 0;
const uncertaintyToggle = page.querySelector<HTMLInputElement>('[data-show-uncertainty]')!;
uncertaintyToggle.checked = params.get('uncertainty') === '1';
const requestedLayers = new Set(
    (params.get("layers") || "geography,labels").split(","),
  ),
  initialCenter: [number, number] = [
    Number(params.get("lng")) || 24.6359,
    Number(params.get("lat")) || 56.8962,
  ],
  initialZoom = Number(params.get("z")) || 6.26;
let mapMode = ["places", "points", "clusters", "heatmap", "network"].includes(params.get("mode") || "") ? params.get("mode")! : "points";
const filterKeys = ["theme", "narrator", "collector", "place", "volume", "translation"] as const,
  selectedFilters = Object.fromEntries(filterKeys.map((key) => [key, new Set((params.get(key) || "").split("|").filter((value) => value && !(key === "place" && value.startsWith("place-"))))])) as Record<(typeof filterKeys)[number], Set<string>>;
const unknownPersonValue = "__unknown__", personFilterKeys = ["narrator", "collector"] as const,
  unknownPersonKey = { narrator: "map.unknownNarrators", collector: "map.unknownCollectors" } as const,
  personFilterExplicit: Record<(typeof personFilterKeys)[number], boolean> = {
    narrator: params.has("narrator") || params.get("narratorMode") === "selection" || params.get("onlyUnknownNarrators") === "1" || params.get("unknownNarrators") === "0",
    collector: params.has("collector") || params.get("collectorMode") === "selection" || params.get("onlyUnknownCollectors") === "1" || params.get("unknownCollectors") === "0",
  },
  filterOptionValues = {} as Record<(typeof filterKeys)[number], string[]>;
const filterExplicit = Object.fromEntries(filterKeys.map((key) => [key, params.has(key) || params.get(`${key}Mode`) === "selection"])) as Record<(typeof filterKeys)[number], boolean>;
personFilterKeys.forEach((key) => filterExplicit[key] = personFilterExplicit[key]);
if (params.get("onlyUnknownNarrators") === "1") selectedFilters.narrator = new Set([unknownPersonValue]);
if (params.get("onlyUnknownCollectors") === "1") selectedFilters.collector = new Set([unknownPersonValue]);
let filteredFeatures = dataset.legends.features, filteredUnmappedLegends = dataset.unmappedLegends || [];
let unmappedSelected = false;
const propertyForFilter = { theme: "themeLv", narrator: "narrator", collector: "collector", place: "placeName", volume: "volume", county: "county", genre: "genre", translation: "translation" } as const;
const allLegendProperties = [...dataset.legends.features.map((feature) => feature.properties), ...(dataset.unmappedLegends || [])];
for (const key of filterKeys) {
  const values = [...new Set(allLegendProperties.map((properties) => properties[propertyForFilter[key]]).filter(Boolean))].sort((first, second) => String(first).localeCompare(String(second), "no", { numeric: true })).map(String);
  if (key === "narrator" || key === "collector") values.unshift(unknownPersonValue);
  filterOptionValues[key] = values;
  const options = filterPanel.querySelector<HTMLElement>(`[data-map-filter="${key}"] .multi-options`)!;
  for (const value of values) {
    const label = document.createElement("label"), input = document.createElement("input"), text = document.createElement("span");
    input.type = "checkbox";
    input.value = String(value);
    if (value === unknownPersonValue && (key === "narrator" || key === "collector")) {
      text.dataset.unknownPersonType = key;
      text.textContent = tr(unknownPersonKey[key]);
    } else text.textContent = key === "translation" ? tr(`map.translation.${value}`) : String(value);
    if (key === "theme") {
      const properties = allLegendProperties.find((properties) => properties.themeLv === value)!;
      text.dataset.themeLv = properties.themeLv;
      text.dataset.themeDe = properties.themeDe || properties.themeLv;
    }
    label.append(input, text);
    options.append(label);
  }
}
heatInput.value = String(Math.min(200, Math.max(40, Number(params.get("heat")) || 100)));
pointIntensity.value = String(Math.min(200, Math.max(20, Number(params.get("pointIntensity")) || 60)));
pointIntensityOutput.value = `${pointIntensity.value}%`;
placesSize.value = String(params.has("placesSize") && Number.isFinite(Number(params.get("placesSize"))) ? Math.min(200, Math.max(15, Number(params.get("placesSize")))) : 100);
placesSizeOutput.value = `${placesSize.value}%`;
heatRadius.value = String(Number(params.get("radius")) || 14);
networkStrongestOnly.checked = params.get("networkShowAll") === "0";
networkSize.value = String(params.has("networkSize") && Number.isFinite(Number(params.get("networkSize"))) ? Math.min(200, Math.max(25, Number(params.get("networkSize")))) : 60);
networkSizeOutput.value = `${networkSize.value}%`;
networkIntensity.value = String(params.has("networkIntensity") && Number.isFinite(Number(params.get("networkIntensity"))) ? Math.min(200, Math.max(0, Number(params.get("networkIntensity")))) : 15);
networkIntensityOutput.value = `${networkIntensity.value}%`;
networkType.value = params.get("networkType") === "plots" ? "plots" : "collectors";
networkSizeBy.value = params.get("networkSizeBy") === "connections" ? "connections" : "legends";
networkOthers.value = params.get("networkOthers") === "hide" ? "hide" : "fade";
networkColor.value = ["collector", "theme", "single"].includes(params.get("networkColor") || "") ? params.get("networkColor")! : "collector";
const previousBasemaps: Record<string, string> = { light: "positron", terrain: "fiord", minimal: "fiord" };
const basemapParam = params.get("basemap") || "", requestedBasemap = previousBasemaps[basemapParam] || basemapParam;
const allowedBasemaps = ["dark", "fiord", "positron", "streets"];
let basemapExplicit = allowedBasemaps.includes(requestedBasemap);
basemapStyle.value = basemapExplicit ? requestedBasemap : document.documentElement.dataset.theme === "dark" ? "dark" : "positron";
const singlePalettes = ["green", "blue", "yellow", "coral"];
let networkPalette = singlePalettes.includes(params.get("networkPalette") || "") ? params.get("networkPalette")! : "yellow";
let pointPalette = singlePalettes.includes(params.get("palette") || "") ? params.get("palette")! : "yellow";
let densityPalette = ["spectrum", ...singlePalettes].includes(params.get("densityPalette") || "") ? params.get("densityPalette")! : mapMode === "heatmap" && singlePalettes.includes(params.get("palette") || "") ? params.get("palette")! : "spectrum";
const syncPaletteSelection = () => {
  const selected = mapMode === "heatmap" ? densityPalette : pointPalette;
  page.querySelectorAll<HTMLInputElement>('[data-map-palette] input[name="map-palette"]').forEach((input) => {
    input.checked = input.value === selected;
    input.closest("label")!.hidden = input.value === "spectrum" && mapMode !== "heatmap";
  });
};
syncPaletteSelection();
let pointColorBy = ["single", "theme", "narrator", "collector"].includes(params.get("colorBy") || "") ? params.get("colorBy")! : "theme";
page.querySelector<HTMLInputElement>(`[data-point-color-by] input[value="${pointColorBy}"]`)!.checked = true;
let placesSizeBy = params.get("placesSizeBy") === "uniform" ? "uniform" : "legends";
page.querySelector<HTMLInputElement>(`[name="places-size-by"][value="${placesSizeBy}"]`)!.checked = true;
let pointStyle = params.get("pointStyle") === "rays" ? "rays" : "bubbles";
page.querySelector<HTMLInputElement>(`[data-point-style-choice] input[value="${pointStyle}"]`)!.checked = true;
const syncPointStyleText = () => {
  const pointText = page.querySelector<HTMLElement>(".point-key span:last-child")!, noteText = page.querySelector<HTMLElement>(".overlap-key")!, pointKey = pointStyle === "rays" ? "map.rayLegend" : "map.bubbleLegend", noteKey = pointStyle === "rays" ? "map.rayExplanation" : "map.bubbleExplanation";
  page.dataset.pointStyle = pointStyle;
  pointText.dataset.i18n = pointKey;
  noteText.dataset.i18n = noteKey;
  pointText.textContent = tr(pointKey);
  noteText.textContent = tr(noteKey);
};
syncPointStyleText();
const syncBasemapMenu = () => {
  const options = page.querySelectorAll<HTMLButtonElement>("[data-basemap-option]");
  options.forEach((option) => option.setAttribute("aria-checked", String(option.dataset.basemapOption === basemapStyle.value)));
  const selected = page.querySelector<HTMLButtonElement>(`[data-basemap-option="${basemapStyle.value}"]`);
  basemapLabel.textContent = selected?.textContent || "";
};
syncBasemapMenu();
page
  .querySelectorAll<HTMLInputElement>("[data-layer]")
  .forEach(
    (input) => (input.checked = requestedLayers.has(input.dataset.layer!)),
  );
for (const key of filterKeys)
  filterPanel.querySelectorAll<HTMLInputElement>(`[data-map-filter="${key}"] .multi-options input[type="checkbox"]`).forEach((input) => input.checked = !filterExplicit[key] || (key === "narrator" || key === "collector") && !personFilterExplicit[key] || selectedFilters[key].has(input.value));
for (const key of personFilterKeys) if (params.get(`unknown${key === "narrator" ? "Narrators" : "Collectors"}`) === "0" && !params.has(key) && !selectedFilters[key].size) {
  selectedFilters[key] = new Set(filterOptionValues[key].filter((value) => value !== unknownPersonValue));
  filterPanel.querySelectorAll<HTMLInputElement>(`[data-map-filter="${key}"] .multi-options input[type="checkbox"]`).forEach((input) => input.checked = input.value !== unknownPersonValue);
}
yearFromInput.value = params.get("yearFrom") || yearFromInput.min;
yearToInput.value = params.get("yearTo") || yearToInput.max;
includeUndated.checked = params.get("undated") !== "0";
includeUnknownPlace.checked = params.get("unknownPlaces") !== "0";
const css = (name: string) =>
    getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim(),
  mix = (color: string, opacity: number) => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.fillStyle = color;
    const normalized = context.fillStyle;
    if (normalized.startsWith("#")) {
      const value = normalized.slice(1),
        full =
          value.length === 3
            ? [...value].map((part) => part + part).join("")
            : value;
      return `rgba(${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)},${opacity})`;
    }
    return color;
  };
const themeColors = (mapDark = document.documentElement.dataset.theme === "dark") => {
  const dark = mapDark;
  const tone = dark ? "dark" : "light";
  const spectrum = ["blue", "gold", "coral"].map(name => css(`--map-spectrum-${name}-${tone}`));
  return {
    dark,
    raised: css("--raised"),
    ink: css("--ink"),
    muted: css("--muted"),
    blue: css("--blue"),
    accent: css("--accent"),
    navy: css("--navy"),
    green: css(`--map-data-${pointPalette}-${tone}`),
    density: densityPalette === "spectrum" ? spectrum[0] : css(`--map-data-${densityPalette}-${tone}`),
    spectrum,
    category: Array.from({ length: 7 }, (_, index) => css(`--map-category-${index + 1}-${tone}`)),
    categoryNeutral: css(`--map-category-neutral-${dark ? "dark" : "light"}`),
    pin: css("--pin"),
    land: dark ? "#0b172b" : "#f4f7fb",
    water: dark ? "#070d1c" : "#ffffff",
    halo: css("--paper"),
    city: mix(css("--ink"), dark ? 0.68 : 0.58),
    coast: mix(css("--muted"), dark ? 0.56 : 0.42),
    boundary: mix(css("--muted"), dark ? 0.36 : 0.3),
    waterFeature: mix(css("--blue"), dark ? 0.16 : 0.08),
    river: mix(css("--blue"), dark ? 0.34 : 0.22),
  };
};
const basemapPalette = (style: string) => (style === "dark" || style === "fiord") ? true : false;
let colors = themeColors(basemapExplicit ? basemapPalette(basemapStyle.value) ?? document.documentElement.dataset.theme === "dark" : document.documentElement.dataset.theme === "dark"),
  selectedId = params.get("selectedPlace") || (params.get("place")?.startsWith("place-") ? params.get("place") : null),
  selectedPointCenter = params.get("selectedCenter")?.includes("|") && selectedId
    ? dataset.places.features.find(place => place.properties.id === selectedId)?.geometry.coordinates.join(",") || null
    : params.get("selectedCenter"),
  moveTimer = 0;
let pointLinkOpacity: unknown = 0.28,
  pointBubbleOpacity: unknown = 0,
  pointBubbleStrokeOpacity: unknown = 0.76;
mapStage.dataset.mapTheme = colors.dark ? "dark" : "light";
const map = new maplibregl.Map({
  container,
  cooperativeGestures: true,
  center: initialCenter,
  zoom: initialZoom,
  minZoom: 3,
  maxZoom: 15,
  maxBounds: [
    [-26, 46],
    [51, 80],
  ],
  attributionControl: false,
  style: {
        glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": colors.water },
          },
        ],
      },
});
const navigationControl = new maplibregl.NavigationControl({
  showCompass: false,
  visualizePitch: false,
});
map.addControl(navigationControl, "top-right");
const navigationGroup = page.querySelector<HTMLElement>(".maplibregl-ctrl-top-right .maplibregl-ctrl-group"),
  centerMapButton = document.createElement("button");
centerMapButton.type = "button";
centerMapButton.className = "map-center-control";
centerMapButton.setAttribute("aria-label", tr("map.resetExtent"));
centerMapButton.dataset.tooltip = tr("map.resetExtent");
centerMapButton.innerHTML = '<i data-lucide="locate-fixed"></i>';
(window as any).renderLucideIcons?.();
const resetExtent = () => {
  const bounds = new maplibregl.LngLatBounds();
  dataset.legends.features.forEach(feature => bounds.extend(feature.geometry.coordinates));
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: { top: 80, right: 45, bottom: 70, left: 45 }, duration: 0 });
};
centerMapButton.addEventListener("click", resetExtent);
navigationGroup?.append(centerMapButton);
const uncertaintyButton = document.createElement("button");
uncertaintyButton.type = "button";
uncertaintyButton.className = "map-uncertainty-control";
uncertaintyButton.replaceChildren(createElement(MapPin, {width:18,height:18,"stroke-width":1.8,"aria-hidden":"true"}));
navigationGroup?.append(uncertaintyButton);
const syncUncertaintyButton = () => {
 const label = tr("map.showUncertainty");
 uncertaintyButton.hidden = true;
 uncertaintyButton.dataset.tooltip = label;
 uncertaintyButton.setAttribute("aria-label", label);
 uncertaintyButton.setAttribute("aria-pressed", String(uncertaintyToggle.checked));
};
uncertaintyButton.addEventListener("click", () => {
 uncertaintyToggle.checked = !uncertaintyToggle.checked;
 uncertaintyToggle.dispatchEvent(new Event("change"));
});
syncUncertaintyButton();
window.addEventListener("ui-language-change", syncUncertaintyButton);
const fullscreenButton = document.createElement("button");
fullscreenButton.type = "button";
fullscreenButton.className = "map-fullscreen-control";
navigationGroup?.append(fullscreenButton);
const fullscreenActive = () => document.fullscreenElement === mapWorkspace || mapWorkspace.classList.contains("is-fullscreen");
const syncFullscreen = () => {
  const active = fullscreenActive(), label = tr(active ? "map.exitFullscreen" : "map.enterFullscreen");
  fullscreenButton.dataset.tooltip = label;
  fullscreenButton.setAttribute("aria-label", label);
  fullscreenButton.setAttribute("aria-pressed", String(active));
  fullscreenButton.replaceChildren(createElement(active ? Minimize : Maximize, { width: 18, height: 18, "stroke-width": 1.8, "aria-hidden": "true" }));
  document.body.classList.toggle("map-fullscreen-active", active);
  (window as any).renderLucideIcons?.();
  requestAnimationFrame(() => map.resize());
  window.setTimeout(() => map.resize(), 220);
};
fullscreenButton.addEventListener("click", async () => {
  if (document.fullscreenElement === mapWorkspace) await document.exitFullscreen();
  else if (mapWorkspace.classList.contains("is-fullscreen")) mapWorkspace.classList.remove("is-fullscreen");
  else {
    try {
      if (!mapWorkspace.requestFullscreen) throw new Error("Fullscreen unavailable");
      await mapWorkspace.requestFullscreen();
    } catch { mapWorkspace.classList.add("is-fullscreen"); }
  }
  syncFullscreen();
});
document.addEventListener("fullscreenchange", syncFullscreen);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && mapWorkspace.classList.contains("is-fullscreen")) {
    mapWorkspace.classList.remove("is-fullscreen");
    syncFullscreen();
    fullscreenButton.focus();
  }
});
syncFullscreen();
for (const [selector, icon] of [[".maplibregl-ctrl-zoom-in", "plus"], [".maplibregl-ctrl-zoom-out", "minus"]]) {
  const button = page.querySelector<HTMLButtonElement>(selector);
  if (button) button.innerHTML = `<i data-lucide="${icon}"></i>`;
}
(window as any).renderLucideIcons?.();
requestAnimationFrame(() => {
  const label = tr("map.resetExtent");
  centerMapButton.setAttribute("aria-label", label);
  centerMapButton.dataset.tooltip = label;
});
map.addControl(
  new maplibregl.AttributionControl({
    compact: true,
  }),
  "bottom-right",
);
const visible = (name: string) =>
  page.querySelector<HTMLInputElement>(`[data-layer="${name}"]`)?.checked
    ? "visible"
    : "none";
const updateUrl = (push = false) => {
  const center = map.getCenter(),
    url = new URL(location.href),
    layers = [
      ...page.querySelectorAll<HTMLInputElement>("[data-layer]:checked"),
    ].map((input) => input.dataset.layer!);
  url.searchParams.set("lng", center.lng.toFixed(4));
  url.searchParams.set("lat", center.lat.toFixed(4));
  url.searchParams.set("z", map.getZoom().toFixed(2));
  url.searchParams.set("layers", layers.join(","));
  url.searchParams.set("mode", mapMode);
  url.searchParams.set("heat", heatInput.value);
  url.searchParams.set("radius", heatRadius.value);
  url.searchParams.set("networkType", networkType.value);
  url.searchParams.set("networkIntensity", networkIntensity.value);
  url.searchParams.set("networkSize", networkSize.value);
  url.searchParams.set("networkSizeBy", networkSizeBy.value);
  url.searchParams.set("networkOthers", networkOthers.value);
  url.searchParams.set("networkShowAll", !networkStrongestOnly.checked ? "1" : "0");
  url.searchParams.delete("networkDensity");
  url.searchParams.set("networkColor", networkColor.value);
  url.searchParams.set("networkPalette", networkPalette);
  url.searchParams.delete("networkFocus");
  url.searchParams.set("palette", pointPalette);
  url.searchParams.set("densityPalette", densityPalette);
  url.searchParams.set("colorBy", pointColorBy);
  url.searchParams.set("pointStyle", pointStyle);
  url.searchParams.set("placesSize", placesSize.value);
  url.searchParams.set("placesSizeBy", placesSizeBy);
  url.searchParams.set("pointIntensity", pointIntensity.value);
  if (uncertaintyToggle.checked) url.searchParams.set("uncertainty", "1"); else url.searchParams.delete("uncertainty");
  basemapExplicit
    ? url.searchParams.set("basemap", basemapStyle.value)
    : url.searchParams.delete("basemap");
  for (const key of filterKeys) {
    if (key === "narrator" || key === "collector") {
      if (personFilterExplicit[key]) {
        url.searchParams.set(`${key}Mode`, "selection");
        const value = [...selectedFilters[key]].join("|");
        value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
      } else {
        url.searchParams.delete(`${key}Mode`);
        url.searchParams.delete(key);
      }
      continue;
    }
    const value = [...selectedFilters[key]].join("|");
    if (filterExplicit[key]) {
      url.searchParams.set(`${key}Mode`, "selection");
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    } else {
      url.searchParams.delete(`${key}Mode`);
      url.searchParams.delete(key);
    }
  }
  url.searchParams.set("yearFrom", yearFromInput.value);
  url.searchParams.set("yearTo", yearToInput.value);
  url.searchParams.set("undated", includeUndated.checked ? "1" : "0");
  url.searchParams.delete("unknownNarrators");
  url.searchParams.delete("unknownCollectors");
  url.searchParams.set("unknownPlaces", includeUnknownPlace.checked ? "1" : "0");
  url.searchParams.delete("onlyUnknownNarrators");
  url.searchParams.delete("onlyUnknownCollectors");
  selectedId
    ? url.searchParams.set("selectedPlace", selectedId)
    : url.searchParams.delete("selectedPlace");
  selectedPointCenter
    ? url.searchParams.set("selectedCenter", selectedPointCenter)
    : url.searchParams.delete("selectedCenter");
  history[push ? "pushState" : "replaceState"]({}, "", url);
};
const updateCount = () => {
  if (!map.getSource("legends")) return;
  const bounds = map.getBounds(), visibleFeatures = filteredFeatures.filter((feature) => bounds.contains(feature.geometry.coordinates));
  const value = visibleFeatures.length;
  const countTemplate = tr(matchMedia("(max-width: 600px)").matches ? "map.mobileCount" : "map.resultsInView", {
    count: "__visible_count__", total: formatter().format(filteredFeatures.length),
  });
  const [countPrefix, countSuffix] = countTemplate.split("__visible_count__"), visibleCount = document.createElement("strong");
  visibleCount.textContent = formatter().format(value);
  countText.replaceChildren(document.createTextNode(countPrefix), visibleCount, document.createTextNode(countSuffix || ""));
  const visibleIds = visibleFeatures.map((feature) => feature.properties.id);
  if (visibleIds.length) countLabel.href = `${base}teksti/?selection=${encodeURIComponent(encodeSelection(visibleIds))}`;
  else countLabel.removeAttribute("href");
  const unlocatedLink = page.querySelector<HTMLAnchorElement>("[data-map-unlocated-count]")!;
  unlocatedLink.hidden = filteredUnmappedLegends.length === 0;
  const unlocatedText = tr("map.unlocatedCount", { count: formatter().format(filteredUnmappedLegends.length) });
  unlocatedLink.querySelector("span")!.textContent = unlocatedText;
  unlocatedLink.href = `${base}teksti/?selection=${encodeURIComponent(encodeSelection(filteredUnmappedLegends.map(record => record.id)))}`;
  unlocatedLink.dataset.tooltip = tr("map.coordinateCountDetails", { mapped: formatter().format(filteredFeatures.length), unmapped: formatter().format(filteredUnmappedLegends.length) });
  unlocatedLink.setAttribute("aria-label", unlocatedLink.dataset.tooltip!);
  countLabel.setAttribute("aria-disabled", String(visibleIds.length === 0));
  countLabel.setAttribute("aria-label", tr("map.openVisibleSelection", { count: formatter().format(value) }));
};
const syncFilterInterface = () => {
  let active = yearFromInput.value !== yearFromInput.min || yearToInput.value !== yearToInput.max || !includeUndated.checked || !includeUnknownPlace.checked || Object.values(personFilterExplicit).some(Boolean);
  for (const key of filterKeys) {
    const count = selectedFilters[key].size;
    active ||= filterExplicit[key];
    filterPanel.querySelector<HTMLElement>(`[data-map-filter="${key}"] [data-map-filter-count]`)!.textContent = !filterExplicit[key] ? tr(`map.filterAll.${key}`) : String(count);
  }
  const activeFilterDisplay = page.querySelector<HTMLElement>("[data-network-active-filters]")!;
  activeFilterDisplay.replaceChildren();
  const addFilterChip = (label: string, values: string[], countLabel?: string) => {
    const chip = document.createElement("details"), summary = document.createElement("summary"), list = document.createElement("ul");
    chip.className = "network-filter-chip";
    summary.textContent = countLabel || `${label}: ${values[0] || tr("map.noSelectedValues")}${values.length > 1 ? ` +${values.length - 1}` : ""}`;
    (values.length ? values : [tr("map.noSelectedValues")]).forEach(value => { const item = document.createElement("li"); item.textContent = value; list.append(item); });
    chip.append(summary, list);
    activeFilterDisplay.append(chip);
  };
  for (const key of filterKeys) {
    if (!filterExplicit[key]) continue;
    const label = filterPanel.querySelector<HTMLElement>(`[data-map-filter="${key}"] > summary > span`)!.textContent || key;
    const values = [...selectedFilters[key]].map(value => {
      if ((key === "collector" || key === "narrator") && value === unknownPersonValue) return tr(unknownPersonKey[key]);
      if (key === "translation") return tr(`map.translation.${value}`);
      if (key === "theme") {
        const record = allLegendProperties.find(record => record.themeLv === value);
        return record ? (document.documentElement.dataset.uiLang === "de" ? record.themeDe || record.themeLv : record.themeLv) : value;
      }
      return value;
    });
    addFilterChip(label, values, key === "theme" ? tr(values.length === 1 ? "map.selectedThemeCountOne" : "map.selectedThemeCount", { count: formatter().format(values.length) }) : undefined);
  }
  if (yearFromInput.value !== yearFromInput.min || yearToInput.value !== yearToInput.max) addFilterChip(tr("map.timeRange"), [`${yearFromInput.value}–${yearToInput.value}`]);
  if (!includeUndated.checked) addFilterChip(tr("map.timeRange"), [tr("map.datedOnly")]);
  if (!includeUnknownPlace.checked) addFilterChip(tr("map.filterPlaces"), [tr("map.knownPlacesOnly")]);
  activeFilterDisplay.hidden = activeFilterDisplay.childElementCount === 0;
  if (!activeFilterDisplay.hidden) {
    const clear = document.createElement("button");
    clear.type = "button"; clear.className = "network-filter-clear";
    clear.dataset.tooltip = tr("map.clearFiltersLong"); clear.setAttribute("aria-label", clear.dataset.tooltip!);
    clear.innerHTML = '<i data-lucide="x"></i>';
    clear.addEventListener("click", () => filterClear.click());
    activeFilterDisplay.append(clear);
    (window as any).renderLucideIcons?.();
  }
  filterClear.hidden = !active;
  yearFromOutput.value = yearFromInput.value;
  yearToOutput.value = yearToInput.value;
  yearFromOutput.classList.toggle("is-changed", yearFromInput.value !== yearFromInput.min);
  yearToOutput.classList.toggle("is-changed", yearToInput.value !== yearToInput.max);
  const minimum = Number(yearFromInput.min), maximum = Number(yearFromInput.max), left = ((Number(yearFromInput.value) - minimum) / (maximum - minimum)) * 100, right = 100 - ((Number(yearToInput.value) - minimum) / (maximum - minimum)) * 100;
  filterPanel.querySelector<HTMLElement>(".range-track")!.style.cssText = `--range-left:${left}%;--range-right:${right}%`;
  filterPanel.querySelector<HTMLElement>(".timeline")!.classList.toggle("is-active", yearFromInput.value !== yearFromInput.min || yearToInput.value !== yearToInput.max);
  const downloadable = (active || mapMode === "network") && (filteredFeatures.length + filteredUnmappedLegends.length) > 0;
  downloadMenu.dataset.disabled = String(!downloadable);
  downloadMenu.querySelector("summary")!.setAttribute("aria-disabled", String(!downloadable));
  downloadMenu.querySelectorAll<HTMLButtonElement>("button").forEach((button) => button.disabled = !downloadable);
  downloadHint.hidden = downloadable;
  const networkEmpty = mapMode === "network" && networkNodes.length === 0;
  emptyState.hidden = !networkEmpty && (!active || filteredFeatures.length + filteredUnmappedLegends.length > 0);
  const emptyTitle = emptyState.querySelector<HTMLElement>("strong")!;
  emptyTitle.dataset.i18n = networkEmpty && filteredFeatures.length > 0 ? "map.networkEmpty" : "map.emptyTitle";
  emptyTitle.textContent = tr(emptyTitle.dataset.i18n);
};
let pointSpreadZoom = -1, activePointPlace: string | null = null, activePointLegend: string | null = null, selectedPointLegend: string | null = null;
let hoveredPointLegendState: string | null = null;
let hoveredClusterId: number | null = null;
const clusterDetailZoom = 11.5;
const legendMapActive = () => mapMode === "points" || mapMode === "places";
const clusterDetailActive = () => mapMode === "clusters" && map.getZoom() >= clusterDetailZoom;
const bubbleInteractionActive = () => mapMode === "places" || (mapMode === "points" ? pointStyle === "bubbles" : clusterDetailActive());
const effectivePointStyle = () => mapMode === "places" || clusterDetailActive() ? "bubbles" : pointStyle;
let clusterDetailRendered = false;
const placeCircleRadius = (count: number) => (placesSizeBy === "uniform" ? 6 : Math.min(24, 4 + 2 * (Math.sqrt(count) - 1))) * Number(placesSize.value) / 100;
const placeAnchorRadii = new Map<string, number>();
const pointAnchors = new Map<string, [number, number]>(), pointDisplayFeatures = new Map<string, any>();
const setHoveredPointLegendState = (legendId: string | null) => {
  if (hoveredPointLegendState === legendId) return;
  if (hoveredPointLegendState) {
    map.setFeatureState({ source: "point-links", id: hoveredPointLegendState }, { hovered: false });
    map.setFeatureState({ source: "legends", id: hoveredPointLegendState }, { hovered: false });
  }
  hoveredPointLegendState = legendId;
  if (legendId) {
    map.setFeatureState({ source: "point-links", id: legendId }, { hovered: true });
    map.setFeatureState({ source: "legends", id: legendId }, { hovered: true });
  }
};
const pointLinkCoordinates = (anchor: [number, number], endpoint: [number, number]) => {
  const startPixel = map.project(anchor), endPixel = map.project(endpoint), dx = endPixel.x - startPixel.x, dy = endPixel.y - startPixel.y,
    distance = Math.hypot(dx, dy), offset = mapMode === "places" ? (placeAnchorRadii.get(anchor.join(",")) || 4) + .5 : effectivePointStyle() === "rays" ? 4.5 : 5.5,
    ratio = distance ? Math.min(mapMode === "places" ? .95 : .42, offset / distance) : 0;
  return [[anchor[0] + (endpoint[0] - anchor[0]) * ratio, anchor[1] + (endpoint[1] - anchor[1]) * ratio], endpoint] as [[number, number], [number, number]];
};
const nearestPointLegend = (event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
  let nearestId = "", nearestDistance = Number.POSITIVE_INFINITY;
  for (const feature of event.features || []) {
    const id = String(feature.properties?.id || ""), display = pointDisplayFeatures.get(id), anchor = pointAnchors.get(id);
    if (!id || !display || !anchor) continue;
    const start = map.project(anchor), end = map.project(display.geometry.coordinates), dx = end.x - start.x, dy = end.y - start.y,
      lengthSquared = dx * dx + dy * dy,
      position = lengthSquared ? Math.max(0, Math.min(1, ((event.point.x - start.x) * dx + (event.point.y - start.y) * dy) / lengthSquared)) : 0,
      distance = Math.hypot(event.point.x - (start.x + position * dx), event.point.y - (start.y + position * dy));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = id;
    }
  }
  return nearestId;
};
const pointCategoryValue = (properties: LegendProperties) => String(pointColorBy === "theme" ? properties.themeLv : pointColorBy === "narrator" ? properties.narrator : properties.collector).trim();
const pointCategoryIndex = (properties: LegendProperties) => {
  if (pointColorBy === "single") return 0;
  const value = pointCategoryValue(properties);
  if (!value) return colors.category.length;
  const hash = [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
  return Math.abs(hash) % colors.category.length;
};
const categoryColor = (properties: LegendProperties) => pointColorBy === "single"
  ? colors.green
  : pointCategoryIndex(properties) === colors.category.length
    ? colors.categoryNeutral
    : colors.category[pointCategoryIndex(properties)];
const canonicalPointCoordinates = new Map(dataset.places.features.map((feature) => [feature.properties.id, feature.geometry.coordinates]));
const colocatedPlaces = new Map<string, typeof dataset.places.features>();
for (const feature of dataset.places.features) {
  const key = feature.geometry.coordinates.join(",");
  const group = colocatedPlaces.get(key) || [];
  group.push(feature);
  colocatedPlaces.set(key, group);
}
const placesAtCoordinates = (placeId: string) => {
  const coordinates = canonicalPointCoordinates.get(placeId);
  return coordinates ? colocatedPlaces.get(coordinates.join(",")) || [] : [];
};
const pointGroupCoordinates = (feature: (typeof dataset.legends.features)[number]) => {
  const coordinates = feature.geometry.coordinates,
    canonical = canonicalPointCoordinates.get(feature.properties.placeId);
  return canonical && Math.abs(coordinates[0] - canonical[0]) < 0.0001 && Math.abs(coordinates[1] - canonical[1]) < 0.0001 ? canonical : coordinates;
};
const updatePointSources = () => {
  const legendSource = map.getSource("legends") as maplibregl.GeoJSONSource | undefined,
    placeSource = map.getSource("point-places") as maplibregl.GeoJSONSource | undefined,
    linkSource = map.getSource("point-links") as maplibregl.GeoJSONSource | undefined;
  if (!legendSource || !placeSource || !linkSource) return;
  const zoom = map.getZoom(), displayStyle = effectivePointStyle(), overviewSpacing = Math.max(0, Math.min(1.6, (zoom - 6) * 0.35)), detailSpacing = Math.max(0, zoom - 9) * 0.85,
    spacing = 1.1 + overviewSpacing + detailSpacing, rayLength = displayStyle === "rays" ? 1.05 + Number(pointIntensity.value) / 360 : 1, groups = new Map<string, any[]>();
  filteredFeatures.forEach((feature) => {
    const [longitude, latitude] = pointGroupCoordinates(feature), key = pointCoordinateKey([longitude, latitude]);
    const group = groups.get(key) || [];
    group.push(feature);
    groups.set(key, group);
  });
  const features: any[] = [], centers: any[] = [], goldenAngle = Math.PI * (3 - Math.sqrt(5));
  pointAnchors.clear();
  placeAnchorRadii.clear();
  pointDisplayFeatures.clear();
  groups.forEach((group, key) => {
    group.sort((first, second) => pointCategoryIndex(first.properties) - pointCategoryIndex(second.properties)
      || pointCategoryValue(first.properties).localeCompare(pointCategoryValue(second.properties), "no")
      || String(first.properties.id).localeCompare(String(second.properties.id)));
    const [longitude, latitude] = pointGroupCoordinates(group[0]), latitudeRadians = latitude * Math.PI / 180,
      metersPerPixel = 156543.03392 * Math.cos(latitudeRadians) / 2 ** zoom,
      placements = group.map((_, index) => ({
        radiusIndex: index,
        angle: index * goldenAngle,
      })).sort((first, second) => {
        const normalizedFirst = (first.angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2),
          normalizedSecond = (second.angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        return normalizedFirst - normalizedSecond;
      });
    placeAnchorRadii.set([longitude, latitude].join(","), placeCircleRadius(group.length));
    group.forEach((feature, index) => {
      const placement = pointColorBy === "single" ? { radiusIndex: index, angle: index * goldenAngle } : placements[index],
        radiusPixels = ((mapMode === "places" ? Math.max(9.5, placeCircleRadius(group.length) + 6) : displayStyle === "rays" ? 8.5 : 9.5) + spacing * Math.sqrt(placement.radiusIndex + 1)) * rayLength, radiusMeters = radiusPixels * metersPerPixel, angle = placement.angle,
        latitudeOffset = Math.sin(angle) * radiusMeters / 111320,
        longitudeOffset = Math.cos(angle) * radiusMeters / Math.max(111320 * Math.cos(latitudeRadians), 1);
      const displayFeature = { ...feature, geometry: { type: "Point", coordinates: [longitude + longitudeOffset, latitude + latitudeOffset] }, properties: { ...feature.properties, visuallyDispersed: true, placeCount: group.length, centerKey: key, categoryColor: categoryColor(feature.properties) } };
      features.push(displayFeature);
      pointAnchors.set(feature.properties.id, [longitude, latitude]);
      pointDisplayFeatures.set(feature.properties.id, displayFeature);
    });
    const categoryCounts = new Map<string, {record: LegendProperties; count: number}>();
    for (const feature of group) {
      const value = pointCategoryValue(feature.properties);
      if (!value) continue;
      const item = categoryCounts.get(value) || {record: feature.properties, count: 0};
      item.count++; categoryCounts.set(value, item);
    }
    const dominant = [...categoryCounts].sort((a,b) => b[1].count-a[1].count || a[0].localeCompare(b[0], "no"))[0]?.[1].record;
    const placeColor = pointColorBy === "single" ? colors.green : dominant ? categoryColor(dominant) : colors.categoryNeutral;
    centers.push({ type: "Feature", id: `${group[0].properties.placeId}-${longitude}-${latitude}`, geometry: { type: "Point", coordinates: [longitude, latitude] }, properties: { placeId: group[0].properties.placeId, centerKey: key, placeName: group[0].properties.placeName, placeColor, locationUncertain: group.some(feature => (feature.properties as any).locationUncertain === 1), count: group.length, radius: 11 + spacing * Math.sqrt(group.length) } });
  });
  legendSource.setData({ type: "FeatureCollection", features } as any);
  placeSource.setData({ type: "FeatureCollection", features: centers } as any);
  const links = features.map((feature) => {
    const anchor = pointAnchors.get(feature.properties.id);
    if (!anchor || !feature.properties.visuallyDispersed) return null;
    return { type: "Feature", id: feature.properties.id, geometry: { type: "LineString", coordinates: pointLinkCoordinates(anchor, feature.geometry.coordinates) }, properties: { id: feature.properties.id, placeId: feature.properties.placeId, centerKey: feature.properties.centerKey, placeCount: feature.properties.placeCount, categoryColor: feature.properties.categoryColor } };
  }).filter(Boolean);
  linkSource.setData({ type: "FeatureCollection", features: links } as any);
  pointSpreadZoom = zoom;
  requestAnimationFrame(() => {
    if (selectedPointLegend) map.setFeatureState({ source: "legends", id: selectedPointLegend }, { selected: true });
    if (hoveredPointLegendState) {
      map.setFeatureState({ source: "legends", id: hoveredPointLegendState }, { hovered: true });
      map.setFeatureState({ source: "point-links", id: hoveredPointLegendState }, { hovered: true });
    }
    if (activePointLegend) showPointLegendLink(activePointLegend, activePointLegend === selectedPointLegend);
    else if (activePointPlace) showPointLinks(activePointPlace, activePointPlace === selectedPointCenter);
  });
};
const showPointLinks = (centerKey: string | null, selected = false) => {
  activePointPlace = centerKey;
  activePointLegend = null;
  const source = map.getSource("point-focus-links") as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  const visibleCenters = new Set((mapMode === "places" ? [selectedPointCenter] : [selectedPointCenter, centerKey]).filter(Boolean));
  const lines = visibleCenters.size ? [...pointDisplayFeatures.values()].filter((feature) => visibleCenters.has(feature.properties.centerKey)).map((feature) => {
    const display = pointDisplayFeatures.get(feature.properties.id), anchor = pointAnchors.get(feature.properties.id);
    return display && anchor ? { type: "Feature", geometry: { type: "LineString", coordinates: pointLinkCoordinates(anchor, display.geometry.coordinates) }, properties: { id: feature.properties.id, categoryColor: display.properties.categoryColor, placeCount: display.properties.placeCount, selected: feature.properties.centerKey === selectedPointCenter || selected && feature.properties.centerKey === centerKey } } : null;
  }).filter(Boolean) : [];
  source.setData({ type: "FeatureCollection", features: lines } as any);
};
const showPointLegendLink = (legendId: string | null, selected = false) => {
  activePointLegend = legendId;
  activePointPlace = null;
  const source = map.getSource("point-focus-links") as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  const ids = [...new Set([selectedPointLegend, legendId].filter(Boolean))] as string[], selectedPlaceFeatures = selectedPointCenter ? [...pointDisplayFeatures.values()].filter((feature) => feature.properties.centerKey === selectedPointCenter && !ids.includes(feature.properties.id)).map((feature) => {
    const anchor = pointAnchors.get(feature.properties.id);
    return anchor ? { type: "Feature", geometry: { type: "LineString", coordinates: pointLinkCoordinates(anchor, feature.geometry.coordinates) }, properties: { id: feature.properties.id, selected: true, placeCount: feature.properties.placeCount, categoryColor: feature.properties.categoryColor } } : null;
  }).filter(Boolean) : [], features = [...selectedPlaceFeatures, ...ids.map((id) => {
    const display = pointDisplayFeatures.get(id), anchor = pointAnchors.get(id);
    if (!display || !anchor) return null;
    const isSelected = id === selectedPointLegend || selected, isHovered = id === legendId && id !== selectedPointLegend, endpoint = display.geometry.coordinates,
      extension = isHovered ? 1.15 : 1,
      extendedEndpoint = [anchor[0] + (endpoint[0] - anchor[0]) * extension, anchor[1] + (endpoint[1] - anchor[1]) * extension];
    return { type: "Feature", geometry: { type: "LineString", coordinates: pointLinkCoordinates(anchor, extendedEndpoint as [number, number]) }, properties: { id, selected: isSelected, hovered: isHovered, placeCount: display.properties.placeCount, categoryColor: display.properties.categoryColor } };
  }).filter(Boolean)];
  source.setData({ type: "FeatureCollection", features } as any);
};
const selectPointLegend = (legendId: string | null) => {
  if (selectedPointLegend) map.setFeatureState({ source: "legends", id: selectedPointLegend }, { selected: false });
  selectedPointLegend = legendId;
  if (legendId) map.setFeatureState({ source: "legends", id: legendId }, { selected: true });
  showPointLegendLink(legendId, true);
};
const placesRadiusExpression = () => ["*", placesSizeBy === "uniform" ? 6 : ["min", 24, ["+", 4, ["*", 2, ["-", ["sqrt", ["get", "count"]], 1]]]], Number(placesSize.value) / 100];
const syncPlaceExpansion = () => {
  const filter = mapMode === "places" ? ["==", ["get", "centerKey"], selectedPointCenter || ""] : null;
  for (const id of ["points", "points-hit", "point-end-bubbles", "point-links", "point-links-hit", "point-place-containers"])
    if (map.getLayer(id)) map.setFilter(id, filter as any);
};
const updatePointCenterSelection = () => {
  syncPlaceExpansion();
  if (!map.getLayer("point-place-centers")) return;
  const selected = selectedPointCenter || "", displayStyle = effectivePointStyle(), detailActive = clusterDetailActive();
  const focusedOpacity = (base: unknown, dimmed: number) => selectedPointCenter ? ["case", ["any", ["boolean", ["feature-state", "hovered"], false], ["boolean", ["feature-state", "selected"], false]], base, ["==", ["get", "centerKey"], selected], base, ["*", base, dimmed]] : base;
  map.setPaintProperty("point-links", "line-opacity", focusedOpacity(pointLinkOpacity, displayStyle === "rays" ? 0.24 : 0.3) as never);
  map.setPaintProperty("point-end-bubbles", "circle-opacity", focusedOpacity(pointBubbleOpacity, 0.3) as never);
  map.setPaintProperty("point-end-bubbles", "circle-stroke-opacity", focusedOpacity(pointBubbleStrokeOpacity, 0.34) as never);
  const strength = Number(pointIntensity.value) / 100;
  const scale = (opacity: number) => Math.min(1, opacity * strength);
  // The place anchor responds to intensity, with a visibility boost over its records.
  const mainStroke = (opacity: number) => Math.min(1, 0.16 + opacity * strength);
  map.setPaintProperty("point-place-containers", "circle-opacity", legendMapActive() ? 0 : selectedPointCenter ? ["case", ["==", ["get", "centerKey"], selected], displayStyle === "rays" ? 0 : scale(colors.dark ? 0.018 : 0.008), displayStyle === "rays" ? 0 : scale(colors.dark ? 0.006 : 0.003)] : displayStyle === "rays" ? 0 : scale(colors.dark ? 0.018 : 0.008));
  map.setPaintProperty("point-place-containers", "circle-stroke-opacity", selectedPointCenter ? ["case", ["==", ["get", "centerKey"], selected], displayStyle === "rays" ? 0 : scale(colors.dark ? 0.16 : 0.12), displayStyle === "rays" ? 0 : scale(colors.dark ? 0.05 : 0.04)] : displayStyle === "rays" ? 0 : scale(colors.dark ? 0.16 : 0.12));
  map.setPaintProperty("point-place-centers", "circle-stroke-color", mapMode === "places" ? ["get", "placeColor"] : colors.green);
  map.setPaintProperty("point-place-centers", "circle-color", ["case", ["==", ["get", "centerKey"], selected], colors.green, detailActive ? colors.green : colors.land]);
  map.setPaintProperty("point-place-centers", "circle-opacity", detailActive
    ? ["case", ["==", ["get", "centerKey"], selected], scale(colors.dark ? 0.42 : 0.34), selectedPointCenter ? scale(colors.dark ? 0.16 : 0.12) : scale(colors.dark ? 0.22 : 0.16)]
    : 0);
  map.setPaintProperty("point-place-centers", "circle-stroke-opacity", mapMode === "places" ? mainStroke(colors.dark ? 0.76 : 0.82) : detailActive
    ? ["case", ["==", ["get", "centerKey"], selected], mainStroke(1), selectedPointCenter ? mainStroke(0.46) : mainStroke(0.84)]
    : ["case", ["==", ["get", "centerKey"], selected], mainStroke(0.95), selectedPointCenter ? mainStroke(colors.dark ? 0.24 : 0.28) : mainStroke(colors.dark ? 0.76 : 0.82)]);
  map.setPaintProperty("point-place-center-halo", "circle-opacity", legendMapActive() ? 0 : ["case", ["==", ["get", "centerKey"], selected], scale(colors.dark ? 0.13 : 0.1), 0]);
  map.setPaintProperty("point-place-centers", "circle-radius", mapMode === "places"
    ? placesRadiusExpression()
    : detailActive
    ? ["interpolate", ["linear"], ["get", "count"], 1, 11, 10, 12.5, 50, 14.5, 150, 17]
    : displayStyle === "rays" ? ["interpolate", ["linear"], ["zoom"], 5, 3.2, 10, 4.6] : ["interpolate", ["linear"], ["zoom"], 5, 4.4, 10, 6.2]);
  if (map.getLayer("point-place-hit")) map.setPaintProperty("point-place-hit", "circle-radius", mapMode === "places" ? ["max", 10, placesRadiusExpression()] : 10);
  if (map.getLayer("point-place-selection-ring")) map.setPaintProperty("point-place-selection-ring", "circle-opacity", legendMapActive() ? 0 : 0.08);
  if (map.getLayer("point-place-selection-ring")) map.setPaintProperty("point-place-selection-ring", "circle-radius", mapMode === "places" ? ["+", placesRadiusExpression(), 3] : ["interpolate", ["linear"], ["zoom"], 5, 8, 10, 11]);
  if (map.getLayer("point-place-selection-ring")) map.setFilter("point-place-selection-ring", ["==", ["get", "centerKey"], selected]);
  if (map.getLayer("point-place-selection-label")) map.setFilter("point-place-selection-label", ["==", ["get", "centerKey"], selected]);
};
const applyFilters = (save = true) => {
  const from = Number(yearFromInput.value), to = Number(yearToInput.value), timeFilterActive = yearFromInput.value !== yearFromInput.min || yearToInput.value !== yearToInput.max;
  const matchesFilters = (properties: LegendProperties) => {
    const year = Number(properties.year);
    if (year ? timeFilterActive && (year < from || year > to) : !includeUndated.checked) return false;
    if (filterExplicit.narrator && !selectedFilters.narrator.has(properties.narrator || unknownPersonValue)) return false;
    if (filterExplicit.collector && !selectedFilters.collector.has(properties.collector || unknownPersonValue)) return false;
    if (!properties.placeName && !includeUnknownPlace.checked) return false;
    return (!filterExplicit.theme || selectedFilters.theme.has(properties.themeLv)) &&
      (!filterExplicit.place || selectedFilters.place.has(properties.placeName)) &&
      (!filterExplicit.volume || selectedFilters.volume.has(properties.volume)) &&
      (["translation"] as const).every(key => !filterExplicit[key] || selectedFilters[key].has(properties[key]));
  };
  filteredFeatures = dataset.legends.features.filter(({ properties }) => matchesFilters(properties));
  filteredUnmappedLegends = (dataset.unmappedLegends || []).filter(matchesFilters);
  const selectedLegendRemoved = Boolean(selectedPointLegend && !filteredFeatures.some(({ properties }) => properties.id === selectedPointLegend));
  if (selectedLegendRemoved) {
    map.setFeatureState({ source: "legends", id: selectedPointLegend! }, { selected: false });
    selectedPointLegend = null;
    activePointLegend = null;
  }
  const collection = { type: "FeatureCollection", features: filteredFeatures } as any;
  updatePointSources();
  const selectedCenterRemoved = Boolean(selectedPointCenter && ![...pointDisplayFeatures.values()].some((feature) => feature.properties.centerKey === selectedPointCenter));
  if (selectedCenterRemoved) {
    selectedId = null;
    selectedPointCenter = null;
    activePointPlace = null;
    updatePointCenterSelection();
  }
  if (legendMapActive() && (selectedLegendRemoved || selectedCenterRemoved)) renderPanel();
  (map.getSource("legend-clusters") as maplibregl.GeoJSONSource)?.setData(collection);
  (map.getSource("unmapped") as maplibregl.GeoJSONSource)?.setData({
    type: "Feature",
    geometry: { type: "Point", coordinates: [23.65, 57.35] },
    properties: { id: "unmapped", count: filteredUnmappedLegends.length },
  } as any);
  if (mapMode === "network" && map.getSource("network")) recalculateNetwork();
  syncFilterInterface();
  updateCount();
  if (selectedId && (legendMapActive() || clusterDetailActive())) renderPointPlace(selectedId, selectedPointCenter);
  else if (unmappedSelected) renderUnmapped();
  else if (mapMode === "clusters") renderPanel();
  if (save) updateUrl();
};
const sharedPlaceProfile = (placeId: string, name: string, options: {tone?: string; connections?: number; networkRecords?: number; extra?: string} = {}) => {
  const locationPlaces = placesAtCoordinates(placeId), grouped = locationPlaces.length > 1 && options.connections === undefined;
  const selection = placeProfileSelection(placeId, locationPlaces.map(place => place.properties), filteredFeatures.map(feature => feature.properties), grouped);
  const { records } = selection;
  const recordedPlaces = locationPlaces.length > 1 ? selection.recordedPlaces.map(place => ({...place, href: recordHref(place.legendIds)})) : undefined;
  const profileName = grouped ? selection.recordedPlaces.filter(place => place.count > 0).map(place => place.name).join(" / ") : name;
  return placeProfileMarkup({name: profileName, records, recordedPlaces, geography: grouped ? undefined : dataset.places.features.find(place => place.properties.id === placeId)?.properties.geography, grouped, href: `${recordHref(records.map(record => record.id))}${grouped ? "" : `&place=${encodeURIComponent(placeId)}`}`, tone: options.tone || colors.green,
    tr, format: count => formatter().format(count), english: document.documentElement.dataset.uiLang === "de",
    categoryColor: record => {
      if (!record.themeLv) return colors.categoryNeutral;
      const hash = [...record.themeLv.trim()].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
      return colors.category[Math.abs(hash) % colors.category.length];
    }, ...options});
};
const renderPanel = (properties?: PlaceProperties) => {
  if (!properties) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.hidden = false;
  panel.innerHTML = sharedPlaceProfile(properties.id, properties.name);
  (window as any).renderLucideIcons?.();
  panel
    .querySelector("button")
    ?.addEventListener("click", () => selectPlace(null, true));
};
const renderLegend = (properties: LegendProperties) => {
  selectedId = null;
  selectedPointCenter = null;
  updatePointCenterSelection();
  selectPointLegend(properties.id);
  const english = document.documentElement.dataset.uiLang === "de",
    title =
      (english ? properties.titleDe : properties.titleLv) ||
      properties.titleLv ||
      properties.id,
    theme =
      (english ? properties.themeDe : properties.themeLv) ||
      properties.themeLv;
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.profile.legend")} · ${properties.id}</p><h2>${title}</h2><dl><div><dt>${tr("meta.place")}</dt><dd>${properties.placeName}</dd></div>${theme ? `<div><dt>${tr("meta.theme")}</dt><dd>${theme}</dd></div>` : ""}${properties.narrator ? `<div><dt>${tr("meta.narrator")}</dt><dd>${properties.narrator}</dd></div>` : ""}${properties.collector ? `<div><dt>${tr("meta.collector")}</dt><dd>${properties.collector}</dd></div>` : ""}<div><dt>${tr("meta.year")}</dt><dd>${properties.year || tr("map.noYear")}</dd></div></dl><a class="button" href="${base}teikas/${properties.id}/"><span>${tr("map.openLegend")}</span><i data-lucide="arrow-right"></i></a><button class="button button-secondary" type="button" data-open-point-place="${properties.placeId}">${tr("map.openPlaceLegends")}</button>`;
  (window as any).renderLucideIcons?.();
  panel
    .querySelector("button")
    ?.addEventListener("click", () => {
      selectPointLegend(null);
      renderPanel();
    });
  panel.querySelector<HTMLButtonElement>("[data-open-point-place]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    renderPointPlace(properties.placeId, String((properties as LegendProperties & { centerKey?: string }).centerKey || "") || null);
  }, { capture: true });
};
const renderPointPlace = (placeId: string, centerKey: string | null = null) => {
  if (selectedPointLegend) map.setFeatureState({ source: "legends", id: selectedPointLegend }, { selected: false });
  selectedPointLegend = null;
  const { records } = placeProfileSelection(placeId, placesAtCoordinates(placeId).map(place => place.properties), filteredFeatures.map(feature => feature.properties), true);
  const placeName = dataset.places.features.find(feature => feature.properties.id === placeId)?.properties.name;
  if (!placeName || !records.length) return;
  selectedId = placeId;
  selectedPointCenter = centerKey || [...pointDisplayFeatures.values()].find((feature) => records.some(record => record.id === feature.properties.id))?.properties.centerKey || null;
  updatePointCenterSelection();
  showPointLinks(selectedPointCenter, true);
  panel.hidden = false;
  panel.innerHTML = sharedPlaceProfile(placeId, placeName);
  panel.querySelector(".map-panel-close")?.addEventListener("click", () => {
    selectedId = null;
    selectedPointCenter = null;
    updatePointCenterSelection();
    showPointLinks(null);
    renderPanel();
    updateUrl();
  });
  (window as any).renderLucideIcons?.();
  showPointLinks(selectedPointCenter, true);
  updateUrl();
};
const renderUnmapped = () => {
  unmappedSelected = true;
  map.setFeatureState({ source: "unmapped", id: "unmapped" }, { selected: true });
  const english = document.documentElement.dataset.uiLang === "de",
    themes = new Set(filteredUnmappedLegends.map((properties) => properties.themeLv).filter(Boolean)),
    narrators = new Set(filteredUnmappedLegends.map((properties) => properties.narrator).filter(Boolean)),
    collectors = new Set(filteredUnmappedLegends.map((properties) => properties.collector).filter(Boolean)),
    themeCounts = new Map<string, { label: string; count: number }>();
  for (const properties of filteredUnmappedLegends) {
    if (!properties.themeLv) continue;
    const entry = themeCounts.get(properties.themeLv) ?? { label: english ? properties.themeDe || properties.themeLv : properties.themeLv, count: 0 };
    entry.count += 1;
    themeCounts.set(properties.themeLv, entry);
  }
  const topThemes = [...themeCounts.values()].sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, english ? "en" : "no")).slice(0, 5),
    largestThemeCount = topThemes[0]?.count || 1,
    themeChart = topThemes.length
      ? `<section class="place-theme-chart"><h3>${tr("map.placeTopThemes")}</h3><ol>${topThemes.map((theme) => `<li><div><span>${theme.label}</span><strong>${formatter().format(theme.count)}</strong></div><i><b style="--theme-share:${(theme.count / largestThemeCount) * 100}%"></b></i></li>`).join("")}</ol></section>`
      : "",
    ids = filteredUnmappedLegends.map((properties) => properties.id).filter(Boolean),
    href = ids.length ? `${base}teksti/?selection=${encodeURIComponent(encodeSelection(ids))}` : `${base}teksti/`;
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.analyticalSummary")}</p><h2>${tr("map.unmappedTitle")}</h2><p class="map-panel-note unmapped-panel-note">${tr("map.unmappedExplanation")}</p><dl class="place-summary"><div><dt>${tr("map.legendCount")}</dt><dd>${formatter().format(filteredUnmappedLegends.length)}</dd></div><div><dt>${tr("map.placeThemeCount")}</dt><dd>${formatter().format(themes.size)}</dd></div><div><dt>${tr("map.narrators")}</dt><dd>${formatter().format(narrators.size)}</dd></div><div><dt>${tr("map.collectors")}</dt><dd>${formatter().format(collectors.size)}</dd></div></dl>${themeChart}<a class="button place-browser-button" href="${href}"><span>${tr("map.openLegendBrowser")}</span><i data-lucide="arrow-right"></i></a>`;
  (window as any).renderLucideIcons?.();
  panel
    .querySelector("button")
    ?.addEventListener("click", () => {
      unmappedSelected = false;
      map.setFeatureState({ source: "unmapped", id: "unmapped" }, { selected: false });
      renderPanel();
    });
};
const renderAggregate = (title: string, features: any[], total = features.length, eyebrow = tr("map.analyticalSummary")) => {
  const values = features.map((feature) => feature.properties), themes = new Map<string, number>();
  values.forEach((value) => value.themeLv && themes.set(value.themeLv, (themes.get(value.themeLv) || 0) + 1));
  const dominantTheme = [...themes].sort((first, second) => second[1] - first[1])[0]?.[0] || tr("map.notAvailable"),
    ids = values.map((value) => value.id).filter(Boolean),
    href = ids.length ? `${base}teksti/?selection=${encodeURIComponent(encodeSelection(ids))}` : `${base}teksti/`;
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${eyebrow}</p><h2>${title}</h2><dl><div><dt>${tr("map.legendCount")}</dt><dd>${formatter().format(total)}</dd></div><div><dt>${tr("map.dominantTheme")}</dt><dd>${dominantTheme}</dd></div></dl><a class="button" href="${href}"><span>${tr("map.openTexts")}</span><i data-lucide="arrow-right"></i></a>`;
  (window as any).renderLucideIcons?.();
  panel.querySelector("button")?.addEventListener("click", () => renderPanel());
};
const selectPlace = (id: string | null, push = false) => {
  selectedId = id;
  updatePointCenterSelection();
  if (id) {
    const feature = dataset.places.features.find(
      (item) => item.properties.id === id,
    );
    if (feature) {
      if (legendMapActive() || clusterDetailActive()) renderPointPlace(id, selectedPointCenter);
      else renderPanel(feature.properties);
      map.easeTo({
        center: feature.geometry.coordinates,
        zoom: Math.max(map.getZoom(), 8),
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 600,
      });
    }
  } else renderPanel();
  updateUrl(push);
};
const heatIntensity = () => [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  (0.35 * Number(heatInput.value)) / 100,
  10,
  (1.15 * Number(heatInput.value)) / 100,
];
const heatRadiusValue = () => [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  Math.max(8, Number(heatRadius.value) * 0.65),
  10,
  Number(heatRadius.value),
];
let networkRecordCount = 0;
let networkNodes: NetworkNode[] = [],
  networkEdges: NetworkEdge[] = [],
  activeNetworkNode: string | null = null,
  hoveredNetworkNode: string | null = null;
const placeFeatures = new Map(dataset.places.features.map((feature) => [feature.properties.id, feature]));
const networkLegendProperties = new Map(dataset.legends.features.map(feature => [String(feature.properties.id), feature.properties as LegendProperties]));
const networkCollectorFor = (ids: string[]) => {
  const counts = new Map<string, number>();
  ids.forEach(id => {
    const name = networkLegendProperties.get(id)?.collector?.trim();
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "no"))[0]?.[0] || "";
};
const networkCollectorColor = (name: string) => {
  if (!name) return colors.categoryNeutral;
  const hash = [...name.trim()].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
  return colors.category[Math.abs(hash) % colors.category.length];
};
const singleNetworkColors = new Map<string, string>();
const networkSingleColor = () => {
  const token = `--map-data-${networkPalette}-${colors.dark ? "dark" : "light"}`;
  if (!singleNetworkColors.has(token)) singleNetworkColors.set(token, css(token));
  return singleNetworkColors.get(token)!;
};
const networkColorFor = (node: NetworkNode) => {
  if (networkColor.value === "single") return networkSingleColor();
  if (networkColor.value === "collector") return networkCollectorColor(node.kind === "collector" ? node.name : networkCollectorFor(node.legendIds));
  if (!node.dominantTheme.trim()) return colors.categoryNeutral;
  const hash = [...node.dominantTheme.trim()].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
  return colors.category[Math.abs(hash) % colors.category.length];
};
const networkThemeFor = (ids: string[]) => {
  const counts = new Map<string, number>();
  ids.forEach(id => { const theme = networkLegendProperties.get(id)?.themeLv; if (theme) counts.set(theme, (counts.get(theme) || 0) + 1); });
  return [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
};
let edgeColors = new WeakMap<NetworkEdge, string>();
const networkEdgeColor = (edge: NetworkEdge) => {
  let color = edgeColors.get(edge);
  if (!color) {
    color = networkColor.value === "single" ? networkSingleColor() : networkColor.value === "collector" ? networkCollectorColor(networkCollectorFor(edge.legendIds || [])) : networkCollectorColor(networkType.value === "collectors" ? networkThemeFor(edge.legendIds || []) : edge.strongest[0]?.plot || "");
    edgeColors.set(edge, color);
  }
  return color;
};
const graphCollections = () => ({
  nodes: {
    type: "FeatureCollection",
    features: networkNodes.map((node) => ({
      type: "Feature",
      id: node.id,
      geometry: { type: "Point", coordinates: node.coordinates },
      properties: { id: node.id, name: node.name, kind: node.kind || "place", count: node.count, connectionCount: node.connectionCount, plotCount: node.plotCount, dominantTheme: node.dominantTheme, color: node.color, legendIds: node.legendIds.join(",") },
    })),
  },
  edges: {
    type: "FeatureCollection",
    features: networkEdges.map((edge) => ({
      type: "Feature",
      id: edge.id,
      geometry: { type: "LineString", coordinates: edge.coordinates },
      properties: { id: edge.id, color: networkEdgeColor(edge), fromId: edge.fromId, toId: edge.toId, count: edge.count || 0, legendIds: (edge.legendIds || []).join(","), relationshipType: networkType.value, sharedCount: edge.sharedCount, strongest: JSON.stringify(edge.strongest) },
    })),
  },
});
let overviewConnections = new Set<string>();
let overviewEdges: NetworkEdge[] = [];
let adjacentEdges = new Map<string, NetworkEdge[]>();
let renderedNetworkKey = "";
let networkFocusFrame = 0;
const scheduleNetworkFocus = () => {
  if (networkFocusFrame) return;
  networkFocusFrame = requestAnimationFrame(() => {
    networkFocusFrame = 0;
    applyNetworkFocus(activeNetworkNode || hoveredNetworkNode);
  });
};
const publishNetwork = () => {
  renderedNetworkKey = "";
  const nodes = { type: "FeatureCollection", features: networkNodes.map(node => ({
    type: "Feature", id: node.id, geometry: { type: "Point", coordinates: node.coordinates },
    properties: { id: node.id, name: node.name, count: node.count, connectionCount: node.connectionCount, color: node.color },
  })) };
  (map.getSource("network-nodes") as maplibregl.GeoJSONSource)?.setData(nodes as any);
  networkContext.textContent = tr("map.networkBuiltFrom", { count: formatter().format(networkRecordCount) });
  const label = page.querySelector<HTMLElement>('[data-i18n="map.networkEdgeStrength"], [data-i18n="map.networkEdgeRecords"], [data-i18n="map.networkEdgeMLTypes"], [data-i18n="map.networkEdgeCollectors"]');
  if (label) { label.dataset.i18n = networkType.value === "collectors" ? "map.networkEdgeCollectors" : "map.networkEdgeMLTypes"; label.textContent = tr(label.dataset.i18n); }
  const method = page.querySelector<HTMLElement>("[data-network-method] span")!;
  method.dataset.i18n = "map.networkMethodMetadata";
  method.textContent = tr(method.dataset.i18n);
  method.parentElement!.dataset.tooltip = method.textContent || "";
  if (activeNetworkNode && !networkNodes.some(node => node.id === activeNetworkNode)) { activeNetworkNode = null; panel.hidden = true; }
  if (hoveredNetworkNode && !networkNodes.some(node => node.id === hoveredNetworkNode)) { hoveredNetworkNode = null; hidePlatformTooltip(); }
  applyNetworkFocus(activeNetworkNode || hoveredNetworkNode);
  syncFilterInterface();
};
// Use the complete dataset as the visual reference, so filtering never rescales
// an unchanged relationship or degree to look stronger than it was before.
const networkScaleReferences = new Map<string, {maxWeight: number; maxConnections: number}>();
const completeNetworks = new Map<string, ReturnType<typeof buildMetadataNetwork>>();
const graphOverviews = new WeakMap<ReturnType<typeof buildMetadataNetwork>, Set<string>>();
const selectedNetworks = new Map<string, { features: typeof filteredFeatures; graph: ReturnType<typeof buildMetadataNetwork>; overview: Set<string> }>();
const completeNetwork = () => {
  const type = networkType.value;
  if (!completeNetworks.has(type)) {
    const graph = buildMetadataNetwork(type, dataset.legends.features);
    completeNetworks.set(type, graph);
    networkScaleReferences.set(type, {
      maxWeight: graph.edges.reduce((max, edge) => Math.max(max, edge.sharedCount), 1),
      maxConnections: graph.nodes.reduce((max, node) => Math.max(max, node.connectionCount), 1),
    });
  }
  return completeNetworks.get(type)!;
};
const recolorNetwork = () => {
  edgeColors = new WeakMap();
  networkNodes.forEach(node => node.color = networkColorFor(node));
  if (mapMode === "network") publishNetwork();
};
const recalculateNetwork = () => {
  const complete = completeNetwork();
  let selected = selectedNetworks.get(networkType.value);
  if (!selected || selected.features !== filteredFeatures) {
    const graph = filteredFeatures.length === dataset.legends.features.length ? complete : buildMetadataNetwork(networkType.value, filteredFeatures);
    if (!graphOverviews.has(graph)) graphOverviews.set(graph, strongestConnectionIds(graph.edges));
    selected = { features: filteredFeatures, graph, overview: graphOverviews.get(graph)! };
    selectedNetworks.set(networkType.value, selected);
  }
  const graph = selected.graph;
  page.querySelector<HTMLAnchorElement>("[data-network-method]")!.href = `${base}par-projektu/#dati`;
  networkRecordCount = graph.recordCount;
  const { maxWeight } = networkScaleReferences.get(networkType.value)!;
  hoveredNetworkNode = null;
  hidePlatformTooltip();
  networkNodes = graph.nodes.map(node => ({ ...node, color: networkColorFor(node as NetworkNode) })) as NetworkNode[];
  networkEdges = graph.edges.map(edge => ({ ...edge, strength: Math.sqrt(edge.sharedCount / maxWeight) }));
  edgeColors = new WeakMap();
  overviewConnections = selected.overview;
  overviewEdges = networkEdges.filter(edge => overviewConnections.has(edge.id));
  adjacentEdges = indexNetworkEdges(networkEdges);
  publishNetwork();
};
const relatedNodeIds = (id: string) => [id, ...(adjacentEdges.get(id) || []).map(edge => edge.fromId === id ? edge.toId : edge.fromId)];
const networkBubbleRadius = () => {
  const radius = networkSizeBy.value === "connections"
    ? ["interpolate", ["linear"], ["sqrt", ["get", "connectionCount"]], 0, 2, Math.sqrt((networkScaleReferences.get(networkType.value)?.maxConnections || 1)), 10]
    : ["interpolate", ["linear"], ["sqrt", ["get", "count"]], 2, 3, 17, 10];
  return ["*", radius, Number(networkSize.value) / 100];
};
const applyNetworkFocus = (hoveredId: string | null) => {
  if (!map.getLayer("network") || !map.getLayer("network-nodes")) return;
  const id = activeNetworkNode || hoveredId;
  const focused = id && (hoveredNetworkNode || activeNetworkNode), related = focused ? relatedNodeIds(id!) : [];
  const incident = ["any", ["==", ["get", "fromId"], id], ["==", ["get", "toId"], id]], hideOthers = focused && networkOthers.value === "hide";
  const key = JSON.stringify([focused ? id : null, networkStrongestOnly.checked, Boolean(hideOthers)]);
  if (key !== renderedNetworkKey) {
    const shownEdges = visibleNetworkEdges(networkEdges, overviewEdges, adjacentEdges, focused ? id : null, networkStrongestOnly.checked, Boolean(hideOthers));
    (map.getSource("network") as maplibregl.GeoJSONSource).setData(networkRenderCollection(shownEdges, networkEdgeColor) as any);
    renderedNetworkKey = key;
    networkVisibility.textContent = tr(!focused && networkStrongestOnly.checked ? "map.networkStrongestConnections" : "map.networkVisibleConnections", { shown: formatter().format(shownEdges.length), total: formatter().format(networkEdges.length) });
    const nodeFilter = hideOthers ? ["in", ["get", "id"], ["literal", related]] : null;
    for (const layer of ["network-nodes", "network-node-hit", "network-node-labels"]) if (map.getLayer(layer)) map.setFilter(layer, nodeFilter as any);
  }
  const stroke = colors.dark ? 0.62 : 0.66, dimmed = colors.dark ? 0.16 : 0.22;
  const edgeColor = ["get", "color"];
  map.setPaintProperty("network", "line-color", edgeColor as any);
  map.setPaintProperty("network-halo", "line-color", edgeColor as any);
  map.setPaintProperty("network-nodes", "circle-radius", networkBubbleRadius() as any);
  if (map.getLayer("network-node-hit")) map.setPaintProperty("network-node-hit", "circle-radius", ["case", ["==", ["get", "id"], activeNetworkNode || ""], ["max", 10, ["+", networkBubbleRadius(), 6]], ["max", 6, networkBubbleRadius()]] as any);
  map.setPaintProperty("network-nodes", "circle-opacity", 0);
  map.setPaintProperty("network-nodes", "circle-stroke-color", ["get", "color"]);
  map.setPaintProperty("network-nodes", "circle-stroke-opacity", focused ? ["case", ["==", ["get", "id"], id], 1, ["in", ["get", "id"], ["literal", related]], 0.82, dimmed] : stroke);
  map.setPaintProperty("network-nodes", "circle-stroke-width", activeNetworkNode ? ["case", ["==", ["get", "id"], activeNetworkNode], Math.max(2.4, 2.2 * Number(networkSize.value) / 100), Math.max(0.65, 1.55 * Number(networkSize.value) / 100)] : Math.max(0.65, 1.55 * Number(networkSize.value) / 100));
  const overviewOpacity = ["interpolate", ["linear"], ["get", "strength"], 0.1, 0.12, 0.75, 0.52];
  const edgeOpacity = focused ? ["case", incident, ["interpolate", ["linear"], ["get", "strength"], 0.1, 0.65, 0.75, 1], ["*", overviewOpacity, 0.18]] : overviewOpacity;
  const threadStrength = Number(networkIntensity.value) / 100;
  map.setPaintProperty("network", "line-opacity", ["min", 1, ["*", edgeOpacity, threadStrength]] as any);
  if (map.getLayer("network-node-labels")) map.setPaintProperty("network-node-labels", "text-opacity", focused ? ["case", ["in", ["get", "id"], ["literal", related]], 1, 0.15] : 0.85);
  for (const layer of ["network-selected-ring", "network-selected-label"]) {
    if (!map.getLayer(layer)) continue;
    map.setFilter(layer, ["==", ["get", "id"], activeNetworkNode || ""]);
    map.setLayoutProperty(layer, "visibility", mapMode === "network" ? "visible" : "none");
  }
  if (map.getLayer("network-selected-ring")) {
    map.setPaintProperty("network-selected-ring", "circle-radius", ["+", networkBubbleRadius(), 4] as any);
    map.setPaintProperty("network-selected-ring", "circle-stroke-color", css(`--map-data-yellow-${colors.dark ? "dark" : "light"}`));
  }
  if (map.getLayer("network-selected-label")) {
    map.setPaintProperty("network-selected-label", "text-color", colors.ink);
    map.setPaintProperty("network-selected-label", "text-halo-color", colors.raised);
  }
  map.setPaintProperty("network-halo", "line-opacity", 0);
  map.setPaintProperty("network", "line-blur", 0);
};
const recordHref = (ids: string[]) => `${base}teksti/?selection=${encodeURIComponent(encodeSelection(ids))}`;
const networkKindLabel = (node: NetworkNode) => tr(`map.networkKind.${node.kind || "place"}`);
const renderNetworkNodePanel = (id: string) => {
  const node = networkNodes.find((item) => item.id === id);
  if (!node) return;
  activeNetworkNode = id;
  const related = [...(adjacentEdges.get(id) || [])]
    .sort((a, b) => b.sharedCount - a.sharedCount);
  const escapeText = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  const relatedList = related.slice(0, 5).map((edge) => {
    const other = networkNodes.find((item) => item.id === (edge.fromId === id ? edge.toId : edge.fromId));
    if (!other) return "";
    return `<li><button type="button" data-network-related="${escapeText(other.id)}"><span>${escapeText(other.name)}<small>${networkKindLabel(other)}</small></span><strong>${formatter().format(edge.sharedCount)}</strong><i data-lucide="chevron-right"></i></button></li>`;
  }).join("");
  panel.hidden = false;
  panel.innerHTML = sharedPlaceProfile(node.id.replace(/^place:/, ""), node.name, {
    tone: node.color, connections: node.connectionCount, networkRecords: node.count,
    extra: relatedList ? `<p class="place-connection-key">${tr(networkType.value === "collectors" ? "map.networkSharedCollectors" : "map.sharedPlots")}</p><ul class="network-profile-links">${relatedList}</ul>` : "",
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-network-related]").forEach((button) => button.addEventListener("click", () => renderNetworkNodePanel(button.dataset.networkRelated!)));
  panel.querySelector(".map-panel-close")?.addEventListener("click", () => { activeNetworkNode = null; panel.hidden = true; applyNetworkFocus(null); });
  (window as any).renderLucideIcons?.();
  applyNetworkFocus(id);
};
const renderNetworkEdgePanel = (id: string) => {
  const edge = networkEdges.find((item) => item.id === id);
  if (!edge) return;
  const from = networkNodes.find(node => node.id === edge.fromId)!, to = networkNodes.find(node => node.id === edge.toId)!;
  const escapeText = (value: string) => value.replace(/[&<>"']/g, character => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[character]!);
  const rows = edge.strongest.map(item => `<li><span>${escapeText(item.plot)}</span><strong>${item.from} / ${item.to}</strong></li>`).join("");
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.profile.connection")}</p><h2>${escapeText(from.name)} ↔ ${escapeText(to.name)}</h2><p class="network-panel-count">${tr(networkType.value === "collectors" ? (edge.sharedCount === 1 ? "map.networkSharedCollectorCountOne" : "map.networkSharedCollectorCount") : "map.networkSharedTypeCount", { count: formatter().format(edge.sharedCount) })}</p><p class="map-panel-note">${tr(networkType.value === "collectors" ? "map.networkCollectorRecordCounts" : "map.networkTypeRecordCounts", { from: from.name, to: to.name })}</p><ul class="network-ranked">${rows}</ul><a class="button" href="${recordHref(edge.legendIds || [])}"><span>${tr("map.openTexts")}</span><i data-lucide="arrow-right"></i></a>`;
  panel.querySelector(".map-panel-close")?.addEventListener("click", () => { panel.hidden = true; });
  (window as any).renderLucideIcons?.();
};
const syncPointStyleLayers = () => {
  page.querySelectorAll<HTMLInputElement>('[data-point-style-choice] input[name="point-style"]').forEach((input) => { input.checked = input.value === pointStyle; });
  page.dataset.pointStyle = pointStyle;
  const pointModeActive = legendMapActive(), detailActive = clusterDetailActive(), pointLayersVisible = pointModeActive || detailActive;
  for (const id of ["points", "point-place-containers", "point-links", "point-focus-links", "point-place-center-halo", "point-place-centers", "point-place-selection-ring", "point-place-selection-label", "point-place-hit"])
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", pointLayersVisible ? "visible" : "none");
  if (map.getLayer("point-place-cluster-count")) map.setLayoutProperty("point-place-cluster-count", "visibility", detailActive ? "visible" : "none");
  if (map.getLayer("point-links-hit")) map.setLayoutProperty("point-links-hit", "visibility", pointModeActive && effectivePointStyle() === "rays" ? "visible" : "none");
  for (const id of ["point-end-bubbles", "points-hit"])
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", pointModeActive && effectivePointStyle() === "bubbles" || detailActive ? "visible" : "none");
  if (map.getLayer("point-place-centers")) updatePointCenterSelection();
  if (!selectedPointLegend) showPointLinks(selectedPointCenter, Boolean(selectedPointCenter));
};
const setMapMode = (mode: string, save = true) => {
  if (!['places', 'points', 'clusters', 'heatmap', 'network'].includes(mode)) mode = 'points';
  mapMode = mode;
  page.querySelector<HTMLElement>('.uncertainty-settings')!.hidden = true;
  page.querySelector<HTMLElement>('[data-uncertainty-key]')!.hidden = !uncertaintyToggle.checked || mode === 'heatmap';
  syncUncertaintyButton();
  const uncertaintyKey = page.querySelector<HTMLElement>('[data-uncertainty-key] p')!;
  uncertaintyKey.dataset.i18n = mode === 'clusters' ? 'map.uncertaintyClusterKey' : 'map.uncertaintyKey';
  uncertaintyKey.textContent = tr(uncertaintyKey.dataset.i18n);
  syncPaletteSelection();
  page
    .querySelectorAll<HTMLButtonElement>("[data-map-mode]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mapMode === mode),
      ),
    );
  for (const [id, visibleMode] of [
    ["points", "points"],
    ["points-hit", "points"],
    ["point-place-containers", "points"],
    ["point-links", "points"],
    ["point-links-hit", "points"],
    ["point-focus-links", "points"],
    ["point-place-center-halo", "points"],
    ["point-place-centers", "points"],
    ["point-place-selection-ring", "points"],
    ["point-place-selection-label", "points"],
    ["point-place-cluster-count", "points"],
    ["point-place-hit", "points"],
    ["cluster-aura", "clusters"],
    ["cluster-ring", "clusters"],
    ["clusters", "clusters"],
    ["cluster-hover", "clusters"],
    ["cluster-count", "clusters"],
    ["heatmap", "heatmap"],
  ] as const)
    if (map.getLayer(id))
      map.setLayoutProperty(
        id,
        "visibility",
        mode === visibleMode ? "visible" : "none",
      );
  syncPointStyleLayers();
  if (mode === "network" && map.getSource("network")) recalculateNetwork();
  if (map.getLayer("point-links")) applyTheme(true);
  clusterDetailRendered = clusterDetailActive();
  for (const id of ["network-halo", "network", "network-nodes", "network-node-hit", "network-selected-ring", "network-selected-label"])
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", mode === "network" ? "visible" : "none");
  heatControls.hidden = mode !== "heatmap";
  pointControls.hidden = !legendMapActive();
  page.querySelectorAll<HTMLElement>("[data-point-layer-control]").forEach((control) => control.hidden = !legendMapActive());
  heatKey.hidden = mode !== "heatmap";
  networkToolbar.hidden = mode !== "network";
  page.querySelector<HTMLElement>("[data-map-legend]")!.dataset.mode = mode;
  if ((legendMapActive() || clusterDetailActive()) && Math.abs(map.getZoom() - pointSpreadZoom) >= 0.2) updatePointSources();
  syncControls();
  if (mode === "clusters") renderPanel();
  if (save) updateUrl();
};
const applyTheme = (preserveMapPalette = false) => {
  if (!preserveMapPalette) colors = themeColors();
  mapStage.dataset.mapTheme = colors.dark ? "dark" : "light";
  page.style.setProperty("--map-palette-color", colors.green);
  page.style.setProperty("--map-density-color", colors.density);
  page.style.setProperty("--map-density-ramp", densityPalette === "spectrum"
    ? `linear-gradient(90deg, ${mix(colors.spectrum[0], 0.25)}, ${colors.spectrum[0]}, ${colors.spectrum[1]}, ${colors.spectrum[2]})`
    : `linear-gradient(90deg, transparent, ${mix(colors.density, 0.18)}, ${mix(colors.density, 0.45)}, ${mix(colors.density, 0.72)}, ${mix(colors.density, 0.9)}, ${colors.density})`);
  page.style.setProperty("--map-palette-spectrum", `linear-gradient(90deg, ${colors.spectrum.join(",")})`);
  page.style.setProperty("--map-palette-coral", css(`--map-data-coral-${colors.dark ? "dark" : "light"}`));
  page.style.setProperty("--map-palette-green", css(colors.dark ? "--map-data-green-dark" : "--map-data-green-light"));
  page.style.setProperty("--map-palette-blue", css(colors.dark ? "--map-data-blue-dark" : "--map-data-blue-light"));
  page.style.setProperty("--map-palette-yellow", css(colors.dark ? "--map-data-yellow-dark" : "--map-data-yellow-light"));
  const paint = (id: string, property: string, value: unknown) =>
    map.getLayer(id) && map.setPaintProperty(id, property, value as never);
  const displayStyle = effectivePointStyle(), pointStrength = Number(pointIntensity.value) / 100,
    scalePointOpacity = (value: number | unknown[]) => typeof value === "number" ? Math.min(1, value * pointStrength) : ["min", 1, ["*", value, pointStrength]];
  paint("background", "background-color", colors.water);
  paint("land", "fill-color", colors.land);
  paint("coast", "line-color", colors.coast);
  paint("territory-boundaries", "line-color", colors.boundary);
  paint("rivers", "line-color", colors.river);
  paint("lakes", "fill-color", colors.waterFeature);
  paint("city-dots", "circle-color", colors.city);
  paint("city-labels", "text-color", colors.muted);
  paint("city-labels", "text-halo-color", colors.halo);
  paint("place-labels", "text-color", colors.dark ? "#c9d3e3" : "#46566b");
  paint("place-labels", "text-halo-color", colors.dark ? "rgba(23,29,43,.65)" : "rgba(252,250,246,.65)");
  const corpusPointColor = ["coalesce", ["get", "categoryColor"], colors.green];
  const corpusLinkColor = ["coalesce", ["get", "categoryColor"], colors.green];
  const clusterColor = colors.green;
  paint("cluster-aura", "circle-color", clusterColor);
  paint("cluster-aura", "circle-opacity", colors.dark ? 0.17 : 0.14);
  paint("cluster-ring", "circle-color", clusterColor);
  paint("cluster-ring", "circle-opacity", colors.dark ? 0.035 : 0.025);
  paint("cluster-ring", "circle-stroke-color", clusterColor);
  paint("cluster-ring", "circle-stroke-opacity", colors.dark ? 0.1 : 0.08);
  paint("clusters", "circle-color", clusterColor);
  paint("clusters", "circle-opacity", colors.dark ? 0.2 : 0.16);
  paint("clusters", "circle-stroke-color", clusterColor);
  paint("clusters", "circle-stroke-opacity", colors.dark ? 0.82 : 0.76);
  paint("cluster-hover", "circle-color", clusterColor);
  paint("cluster-hover", "circle-opacity", colors.dark ? 0.2 : 0.16);
  paint("cluster-hover", "circle-stroke-color", clusterColor);
  paint("cluster-hover", "circle-stroke-opacity", colors.dark ? 0.96 : 0.9);
  paint("cluster-count", "text-color", colors.dark ? "#eef3fb" : "#17243a");
  paint("cluster-count", "text-halo-color", colors.dark ? "rgba(7,13,28,.72)" : "rgba(255,255,255,.84)");
  paint("cluster-count", "text-halo-width", colors.dark ? 0.6 : 1.1);
  paint("points", "circle-color", ["case", ["boolean", ["feature-state", "selected"], false], corpusPointColor, colors.raised]);
  paint("points", "circle-opacity", 0);
  paint("points", "circle-stroke-color", corpusPointColor);
  paint("points", "circle-radius", ["interpolate", ["linear"], ["zoom"], 5, 2.3, 8, 3, 11, 4.3]);
  paint("points", "circle-stroke-opacity", ["case", ["boolean", ["feature-state", "selected"], false], 0.98, 0]);
  paint("points", "circle-stroke-width", ["interpolate", ["linear"], ["zoom"], 5, ["case", ["boolean", ["feature-state", "selected"], false], 2, 0.9], 10, ["case", ["boolean", ["feature-state", "selected"], false], 2, 1.2]]);
  paint("point-end-bubbles", "circle-color", colors.land);
  paint("point-end-bubbles", "circle-radius", ["interpolate", ["linear"], ["zoom"], 5, ["case", ["boolean", ["feature-state", "hovered"], false], 3.8, ["boolean", ["feature-state", "selected"], false], 3.2, 2], 8, ["case", ["boolean", ["feature-state", "hovered"], false], 4.8, ["boolean", ["feature-state", "selected"], false], 4.2, 2.8], 11, ["case", ["boolean", ["feature-state", "hovered"], false], 6.2, ["boolean", ["feature-state", "selected"], false], 5.4, 3.8]]);
  pointBubbleOpacity = 0;
  paint("point-end-bubbles", "circle-opacity", pointBubbleOpacity);
  paint("point-end-bubbles", "circle-stroke-color", corpusPointColor);
  pointBubbleStrokeOpacity = ["case", ["any", ["boolean", ["feature-state", "hovered"], false], ["boolean", ["feature-state", "selected"], false]], 1, scalePointOpacity(["interpolate", ["linear"], ["get", "placeCount"], 1, colors.dark ? 0.82 : 0.78, 20, colors.dark ? 0.76 : 0.72, 200, colors.dark ? 0.68 : 0.64, 700, colors.dark ? 0.58 : 0.54])];
  paint("point-end-bubbles", "circle-stroke-opacity", pointBubbleStrokeOpacity);
  const bubbleStrokeScale = Math.min(1.45, 0.75 + pointStrength * 0.25);
  paint("point-end-bubbles", "circle-stroke-width", ["interpolate", ["linear"], ["zoom"], 5, ["case", ["boolean", ["feature-state", "hovered"], false], 2.2, ["boolean", ["feature-state", "selected"], false], 1.8, 0.7 * bubbleStrokeScale], 10, ["case", ["boolean", ["feature-state", "hovered"], false], 2.2, ["boolean", ["feature-state", "selected"], false], 1.8, bubbleStrokeScale]]);
  paint("point-place-containers", "circle-color", colors.green);
  paint("point-place-containers", "circle-stroke-color", colors.green);
  paint("point-place-containers", "circle-opacity", displayStyle === "rays" ? 0 : colors.dark ? 0.018 : 0.008);
  paint("point-place-containers", "circle-stroke-opacity", displayStyle === "rays" ? 0 : colors.dark ? 0.16 : 0.12);
  paint("point-links", "line-color", corpusLinkColor);
  pointLinkOpacity = ["case", ["boolean", ["feature-state", "hovered"], false], 1, scalePointOpacity(displayStyle === "rays" ? ["interpolate", ["linear"], ["get", "placeCount"], 1, colors.dark ? pointColorBy === "single" ? 0.74 : 0.76 : pointColorBy === "single" ? 0.62 : 0.7, 20, colors.dark ? pointColorBy === "single" ? 0.56 : 0.6 : pointColorBy === "single" ? 0.47 : 0.54, 200, colors.dark ? pointColorBy === "single" ? 0.37 : 0.42 : pointColorBy === "single" ? 0.32 : 0.4, 700, colors.dark ? pointColorBy === "single" ? 0.25 : 0.32 : pointColorBy === "single" ? 0.22 : 0.31] : ["interpolate", ["linear"], ["get", "placeCount"], 1, colors.dark ? 0.48 : 0.42, 20, colors.dark ? 0.38 : 0.34, 200, colors.dark ? 0.27 : 0.25, 700, colors.dark ? 0.19 : 0.18])];
  paint("point-links", "line-opacity", pointLinkOpacity);
  const linkWidthScale = Math.min(1.6, 0.8 + pointStrength * 0.28);
  const linkWidths = displayStyle === "rays" ? [0.88, 1.08, 1.32] : [0.72, 0.9, 1.08];
  paint("point-links", "line-width", ["interpolate", ["linear"], ["zoom"], 5, ["case", ["boolean", ["feature-state", "hovered"], false], 2.25, linkWidths[0] * linkWidthScale], 9, ["case", ["boolean", ["feature-state", "hovered"], false], 2.25, linkWidths[1] * linkWidthScale], 12, ["case", ["boolean", ["feature-state", "hovered"], false], 2.25, linkWidths[2] * linkWidthScale]]);
  paint("point-links", "line-blur", displayStyle === "rays" ? Math.max(0.08, 0.18 - pointStrength * 0.06) : 0);
  paint("point-focus-links", "line-color", corpusLinkColor);
  paint("point-focus-links", "line-opacity", ["case", ["boolean", ["get", "hovered"], false], 1, ["boolean", ["get", "selected"], false], ["min", 0.72, ["+", 0.12, scalePointOpacity(["interpolate", ["linear"], ["get", "placeCount"], 1, colors.dark ? 0.72 : 0.66, 20, colors.dark ? 0.56 : 0.5, 100, colors.dark ? 0.4 : 0.35, 300, colors.dark ? 0.26 : 0.23])]], ["interpolate", ["linear"], ["get", "placeCount"], 1, colors.dark ? 0.64 : 0.58, 20, colors.dark ? 0.42 : 0.36, 100, colors.dark ? 0.22 : 0.18, 300, colors.dark ? 0.14 : 0.12]]);
  paint("point-focus-links", "line-width", ["case", ["boolean", ["get", "hovered"], false], 2.4, ["boolean", ["get", "selected"], false], ["interpolate", ["linear"], ["get", "placeCount"], 1, 1.45, 20, 1.25, 100, 1.05, 300, 0.9], ["interpolate", ["linear"], ["get", "placeCount"], 1, 1.2, 20, 0.95, 100, 0.72, 300, 0.6]]);
  paint("point-focus-links", "line-blur", ["case", ["boolean", ["get", "selected"], false], 0.08, 0.16]);
  paint("point-place-centers", "circle-color", colors.land);
  paint("point-place-centers", "circle-stroke-color", colors.green);
  paint("point-place-center-halo", "circle-color", colors.green);
  paint("point-place-selection-ring", "circle-stroke-color", colors.green);
  paint("point-place-selection-label", "text-color", colors.dark ? "#e0e6ef" : "#34465b");
  paint("point-place-selection-label", "text-halo-color", colors.dark ? "rgba(7,13,28,.9)" : "rgba(255,255,255,.92)");
  paint("point-place-selection-label", "text-halo-width", 0.7);
  paint("point-place-selection-label", "text-halo-blur", 0.3);
  paint("point-place-cluster-count", "text-color", colors.dark ? "#eef8f5" : "#173b37");
  paint("point-place-cluster-count", "text-halo-color", colors.dark ? "rgba(7,13,28,.86)" : "rgba(255,255,255,.9)");
  paint("point-place-cluster-count", "text-halo-width", colors.dark ? 1.1 : 1.5);
  updatePointCenterSelection();
  paint("network", "line-color", ["get", "color"]);
  paint("network-halo", "line-color", ["get", "color"]);
  paint("network-nodes", "circle-color", ["get", "color"]);
  paint("network-node-labels", "text-color", colors.dark ? "#c9d3e3" : "#46566b");
  paint("network-node-labels", "text-halo-color", colors.dark ? "rgba(23,29,43,.65)" : "rgba(252,250,246,.65)");
  paint("unmapped", "circle-color", colors.green);
  paint("unmapped", "circle-opacity", ["case", ["boolean", ["feature-state", "selected"], false], colors.dark ? 0.22 : 0.16, ["boolean", ["feature-state", "hovered"], false], colors.dark ? 0.17 : 0.12, colors.dark ? 0.08 : 0.055]);
  paint("unmapped", "circle-stroke-color", colors.green);
  paint("unmapped", "circle-stroke-opacity", ["case", ["any", ["boolean", ["feature-state", "selected"], false], ["boolean", ["feature-state", "hovered"], false]], 0.92, colors.dark ? 0.5 : 0.58]);
  paint("unmapped-aura", "circle-color", colors.green);
  paint("unmapped-aura", "circle-opacity", ["case", ["boolean", ["feature-state", "selected"], false], colors.dark ? 0.12 : 0.08, ["boolean", ["feature-state", "hovered"], false], colors.dark ? 0.09 : 0.06, colors.dark ? 0.045 : 0.03]);
  for (let index = 0; index < 12; index += 1) {
    paint(`unmapped-dot-${index}`, "circle-color", colors.green);
    paint(`unmapped-dot-${index}`, "circle-opacity", ["case", ["any", ["boolean", ["feature-state", "selected"], false], ["boolean", ["feature-state", "hovered"], false]], 1, colors.dark ? 0.7 : 0.76]);
  }
  paint("unmapped-count", "text-color", colors.dark ? "#eef8f5" : "#173b37");
  const heatmapRamp = densityPalette === "spectrum" ? [
    "interpolate", ["linear"], ["heatmap-density"],
    0, mix(colors.spectrum[0], 0),
    0.04, mix(colors.spectrum[0], 0.25),
    0.16, colors.spectrum[0],
    0.4, colors.spectrum[1],
    0.75, colors.spectrum[2],
    1, colors.spectrum[2],
  ] : [
    "interpolate", ["linear"], ["heatmap-density"],
    0, mix(colors.density, 0),
    0.04, mix(colors.density, 0.18),
    0.18, mix(colors.density, 0.45),
    0.38, mix(colors.density, 0.72),
    0.65, mix(colors.density, 0.9),
    1, colors.density,
  ];
  paint("heatmap", "heatmap-color", heatmapRamp);
  paint("heatmap", "heatmap-opacity", [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    colors.dark ? 0.96 : 0.9,
    11,
    colors.dark ? 0.7 : 0.62,
  ]);
  if (!preserveMapPalette && networkNodes.length) recolorNetwork();
  pointSpreadZoom = -1;
  updatePointSources();
  syncPointStyleLayers();
  applyBasemapStyle();
};
const openFreeMapLayers: { id: string; style: string; labels: boolean }[] = [];
const applyBasemapStyle = () => {
  if (!map.getLayer("land")) return;
  const style = basemapStyle.value, geography = visible("geography") === "visible", labels = visible("labels") === "visible";
  for (const id of ["land", "coast", "lakes", "rivers", "territory-boundaries", "city-dots", "city-labels"])
    map.setLayoutProperty(id, "visibility", "none");
  map.setLayoutProperty("place-labels", "visibility", labels ? "visible" : "none");
  if (map.getLayer("network-node-labels")) map.setLayoutProperty("network-node-labels", "visibility", labels && mapMode === "network" ? "visible" : "none");
  map.setLayoutProperty("carto-streets", "visibility", style === "streets" && geography ? "visible" : "none");
  for (const layer of openFreeMapLayers)
    map.setLayoutProperty(layer.id, "visibility", layer.style === style && (layer.labels ? labels : geography) ? "visible" : "none");
};
map.on("load", async () => {
  const region = await fetch(`${base}data/map/northern-europe.json`).then(
    (response) => response.json(),
  );
  const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    addOsmSource = (id: string) => map.addSource(id, {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: osmAttribution,
    });
  addOsmSource("carto-streets");
  const openFreeMapStyles = await Promise.all(["dark", "fiord", "positron"].map(async (name) => ({
    name, style: await fetch(`${base}data/map/openfreemap-${name}.json`).then(response => response.json()) as maplibregl.StyleSpecification,
  })));
  const sharedStyle = openFreeMapStyles[0].style;
  map.setGlyphs(sharedStyle.glyphs);
  if (typeof sharedStyle.sprite === "string") map.setSprite(sharedStyle.sprite);
  for (const [id, source] of Object.entries(sharedStyle.sources)) map.addSource(`ofm-${id}`, source);
  map.addSource("land", { type: "geojson", data: region.land });
  map.addSource("coast", { type: "geojson", data: region.coast });
  map.addSource("territory-boundaries", { type: "geojson", data: region.boundaries });
  map.addSource("rivers", { type: "geojson", data: region.rivers });
  map.addSource("lakes", { type: "geojson", data: region.lakes });
  map.addSource("cities", { type: "geojson", data: region.cities });
  map.addSource("places", { type: "geojson", data: dataset.places });
  map.addSource("legends", {
    type: "geojson",
    data: dataset.legends,
    promoteId: "id",
  });
  map.addSource("point-places", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("point-links", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("point-focus-links", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("legend-clusters", {
    type: "geojson",
    data: dataset.legends,
    cluster: true,
    clusterRadius: 44,
    clusterProperties: {uncertainCount: ["+", ["get", "locationUncertain"]]},
    clusterMaxZoom: 11,
    promoteId: "id",
  });
  map.addSource("network", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    promoteId: "id",
  });
  map.addSource("network-nodes", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    promoteId: "id",
  });
  map.addSource("unmapped", {
    type: "geojson",
    promoteId: "id",
    data: {
      type: "Feature",
      geometry: { type: "Point", coordinates: [23.65, 57.35] },
      properties: { id: "unmapped", count: filteredUnmappedLegends.length },
    },
  });
  map.addLayer({ id: "carto-streets", type: "raster", source: "carto-streets", layout: { visibility: "none" } });
  for (const { name, style } of openFreeMapStyles) {
    for (const layer of style.layers) {
      const id = `ofm-${name}-${layer.id}`, labels = layer.type === "symbol" && Boolean(layer.layout?.["text-field"]);
      map.addLayer({ ...layer, id, ...("source" in layer ? { source: `ofm-${layer.source}` } : {}), layout: { ...layer.layout, visibility: "none" } } as maplibregl.LayerSpecification);
      openFreeMapLayers.push({ id, style: name, labels });
    }
  }
  map.addLayer({
    id: "land",
    type: "fill",
    source: "land",
    layout: { visibility: visible("geography") },
    paint: { "fill-color": colors.land, "fill-opacity": 0.68 },
  });
  map.addLayer({
    id: "coast",
    type: "line",
    source: "coast",
    layout: { visibility: visible("geography"), "line-cap": "round" },
    paint: {
      "line-color": colors.coast,
      "line-opacity": 0.28,
      "line-width": 0.55,
    },
  });
  map.addLayer({
    id: "lakes",
    type: "fill",
    source: "lakes",
    layout: { visibility: visible("geography") },
    paint: { "fill-color": colors.waterFeature, "fill-opacity": 0.72 },
  });
  map.addLayer({
    id: "rivers",
    type: "line",
    source: "rivers",
    minzoom: 4,
    layout: { visibility: visible("geography"), "line-cap": "round" },
    paint: { "line-color": colors.river, "line-opacity": 0.3, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.35, 9, 0.8] },
  });
  map.addLayer({
    id: "territory-boundaries",
    type: "line",
    source: "territory-boundaries",
    minzoom: 4,
    layout: { visibility: visible("geography"), "line-cap": "round" },
    paint: { "line-color": colors.boundary, "line-opacity": 0.32, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.35, 9, 0.7], "line-dasharray": [2, 2.5] },
  });
  map.addLayer({
    id: "city-dots",
    type: "circle",
    source: "cities",
    layout: { visibility: visible("labels") },
    paint: {
      "circle-radius": 2.2,
      "circle-color": colors.city,
      "circle-opacity": 0.7,
    },
  });
  map.addLayer({
    id: "city-labels",
    type: "symbol",
    source: "cities",
    layout: {
      visibility: visible("labels"),
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9, 7, 12],
      "text-offset": [0, 0.8],
      "text-anchor": "top",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": colors.muted,
      "text-halo-color": colors.halo,
      "text-halo-width": 1.2,
      "text-opacity": 0.76,
    },
  });
  map.addLayer({
    id: "heatmap",
    type: "heatmap",
    source: "legends",
    maxzoom: 12,
    layout: { visibility: "none" },
    paint: {
      "heatmap-weight": 0.25,
      "heatmap-intensity": heatIntensity() as any,
      "heatmap-radius": heatRadiusValue() as any,
      "heatmap-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        0.6,
        11,
        0.38,
        12,
        0,
      ],
    },
  });
  map.addLayer({
    id: "network-halo",
    type: "line",
    source: "network",
    layout: { visibility: visible("network"), "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": colors.green,
      "line-opacity": ["interpolate", ["linear"], ["get", "strength"], 0.1, 0.025, 0.75, 0.11],
      "line-width": ["interpolate", ["linear"], ["get", "strength"], 0.1, 2, 0.75, 6],
      "line-blur": 0,
    },
  });
  map.addLayer({
    id: "network",
    type: "line",
    source: "network",
    layout: { visibility: visible("network"), "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": colors.green,
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["get", "strength"],
        0.1,
        0.12,
        0.75,
        0.52,
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["get", "strength"],
        0.1,
        0.65,
        0.75,
        2.6,
      ],
      "line-blur": 0,
    },
  });
  map.addLayer({
    id: "network-nodes",
    type: "circle",
    source: "network-nodes",
    layout: { visibility: visible("network") },
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": networkBubbleRadius() as any,
      "circle-opacity": 0,
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-opacity": colors.dark ? 0.62 : 0.66,
      "circle-stroke-width": 1.55,
    },
  });
  map.addLayer({
    id: "network-node-hit", type: "circle", source: "network-nodes",
    layout: { visibility: visible("network") },
    paint: { "circle-radius": ["max", 6, networkBubbleRadius()] as any, "circle-opacity": 0 },
  });
  map.addLayer({
    id: "network-node-labels", type: "symbol", source: "network-nodes", minzoom: 6,
    layout: { visibility: "none", "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 10.5, "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 },
    paint: { "text-color": colors.dark ? "#c9d3e3" : "#46566b", "text-halo-color": colors.halo, "text-halo-width": 0.6, "text-halo-blur": 0.3 },
  });
  map.addLayer({
    id: "network-selected-ring", type: "circle", source: "network-nodes",
    filter: ["==", ["get", "id"], ""], layout: { visibility: visible("network") },
    paint: { "circle-radius": ["+", networkBubbleRadius(), 4] as any, "circle-opacity": 0,
      "circle-stroke-color": css(`--map-data-yellow-${colors.dark ? "dark" : "light"}`), "circle-stroke-opacity": 1, "circle-stroke-width": 2 },
  });
  map.addLayer({
    id: "network-selected-label", type: "symbol", source: "network-nodes",
    filter: ["==", ["get", "id"], ""],
    layout: { visibility: visible("network"), "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 13,
      "text-offset": [0, -2], "text-anchor": "bottom", "text-max-width": 14, "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": colors.ink, "text-halo-color": colors.raised, "text-halo-width": 2, "text-halo-blur": 0 },
  });
  const clusterRadius = [
    "step",
    ["get", "point_count"],
    15,
    10,
    18,
    50,
    22,
    150,
    26,
    500,
    30,
  ] as any;
  map.addLayer({
    id: "cluster-aura",
    type: "circle",
    source: "legend-clusters",
    filter: ["has", "point_count"],
    layout: { visibility: "none" },
    paint: {
      "circle-color": colors.green,
      "circle-opacity": colors.dark ? 0.17 : 0.14,
      "circle-radius": ["+", clusterRadius, 17],
      "circle-blur": 0.78,
    },
  });
  map.addLayer({
    id: "cluster-ring",
    type: "circle",
    source: "legend-clusters",
    filter: ["has", "point_count"],
    layout: { visibility: "none" },
    paint: {
      "circle-color": colors.green,
      "circle-opacity": colors.dark ? 0.035 : 0.025,
      "circle-radius": ["+", clusterRadius, 4],
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": colors.dark ? 0.1 : 0.08,
      "circle-stroke-width": 1,
      "circle-blur": 0.52,
    },
  });
  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "legend-clusters",
    filter: ["has", "point_count"],
    layout: { visibility: "none" },
    paint: {
      "circle-color": colors.green,
      "circle-opacity": colors.dark ? 0.2 : 0.16,
      "circle-radius": clusterRadius,
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": colors.dark ? 0.82 : 0.76,
      "circle-stroke-width": 1.6,
      "circle-blur": 0,
    },
  });
  map.addLayer({
    id: "cluster-hover",
    type: "circle",
    source: "legend-clusters",
    filter: ["all", ["has", "point_count"], ["==", ["get", "cluster_id"], -1]],
    layout: { visibility: "none" },
    paint: {
      "circle-color": colors.green,
      "circle-opacity": colors.dark ? 0.2 : 0.16,
      "circle-radius": ["+", clusterRadius, 8],
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": colors.dark ? 0.96 : 0.9,
      "circle-stroke-width": 2,
      "circle-blur": 0.32,
    },
  });
  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "legend-clusters",
    filter: ["has", "point_count"],
    layout: {
      visibility: "none",
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": ["step", ["get", "point_count"], 10, 50, 11, 150, 12],
    },
    paint: {
      "text-color": colors.dark ? "#eef3fb" : "#17243a",
      "text-halo-color": colors.dark ? "rgba(7,13,28,.72)" : "rgba(255,255,255,.84)",
      "text-halo-width": colors.dark ? 0.6 : 1.1,
    },
  });
  map.addLayer({
    id: "point-place-containers",
    type: "circle",
    source: "point-places",
    layout: { visibility: "visible" },
    paint: {
      "circle-color": colors.green,
      "circle-opacity": colors.dark ? 0.018 : 0.008,
      "circle-radius": ["get", "radius"],
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": colors.dark ? 0.16 : 0.12,
      "circle-stroke-width": 0.65,
    },
  });
  map.addLayer({
    id: "point-links",
    type: "line",
    source: "point-links",
    layout: { visibility: "visible", "line-cap": "round" },
    paint: { "line-color": colors.green, "line-opacity": colors.dark ? 0.28 : 0.24, "line-width": 0.6 },
  });
  map.addLayer({
    id: "point-links-hit",
    type: "line",
    source: "point-links",
    layout: { visibility: "visible", "line-cap": "round" },
    paint: { "line-color": colors.green, "line-opacity": 0.001, "line-width": 9 },
  });
  map.addLayer({
    id: "point-focus-links",
    type: "line",
    source: "point-focus-links",
    layout: { visibility: "visible", "line-cap": "round" },
    paint: { "line-color": colors.green, "line-opacity": ["case", ["boolean", ["get", "selected"], false], 0.9, colors.dark ? 0.68 : 0.62], "line-width": ["case", ["boolean", ["get", "selected"], false], 2.1, 1.2] },
  });
  map.addLayer({
    id: "point-end-bubbles",
    type: "circle",
    source: "legends",
    layout: { visibility: pointStyle === "bubbles" ? "visible" : "none" },
    paint: {
      "circle-color": colors.land,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2, 8, 2.8, 11, 3.8],
      "circle-opacity": 0,
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": ["interpolate", ["linear"], ["get", "placeCount"], 1, colors.dark ? 0.82 : 0.78, 20, colors.dark ? 0.76 : 0.72, 200, colors.dark ? 0.68 : 0.64, 700, colors.dark ? 0.58 : 0.54],
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 0.7, 10, 1],
    },
  });
  map.addLayer({
    id: "points",
    type: "circle",
    source: "legends",
    layout: { visibility: "visible" },
    paint: {
      "circle-color": ["case", ["boolean", ["feature-state", "selected"], false], colors.green, colors.raised],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.35, 8, 2.1, 11, 3.8],
      "circle-opacity": 0,
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.98, 0],
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, ["case", ["boolean", ["feature-state", "selected"], false], 2, 0.65], 10, ["case", ["boolean", ["feature-state", "selected"], false], 2, 1]],
    },
  });
  map.addLayer({
    id: "points-hit",
    type: "circle",
    source: "legends",
    layout: { visibility: pointStyle === "bubbles" ? "visible" : "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 10, 6],
      "circle-opacity": 0.001,
    },
  });
  map.addLayer({
    id: "point-place-center-halo",
    type: "circle",
    source: "point-places",
    layout: { visibility: "visible" },
    paint: {
      "circle-color": colors.green,
      "circle-opacity": 0,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 7.5, 10, 10],
      "circle-blur": 0.55,
    },
  });
  map.addLayer({
    id: "point-place-centers",
    type: "circle",
    source: "point-places",
    layout: { visibility: "visible" },
    paint: {
      "circle-color": colors.raised,
      "circle-opacity": 0,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4.4, 10, 6.2],
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": colors.dark ? 0.76 : 0.82,
      "circle-stroke-width": 1.55,
    },
  });
  map.addLayer({
    id: "point-place-selection-ring",
    type: "circle",
    source: "point-places",
    filter: ["==", ["get", "centerKey"], ""],
    layout: { visibility: "visible" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 8, 10, 11],
      "circle-color": colors.land,
      "circle-opacity": 0.08,
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": 0.88,
      "circle-stroke-width": 1.8,
    },
  });
  map.addLayer({
    id: "point-place-cluster-count",
    type: "symbol",
    source: "point-places",
    layout: {
      visibility: "none",
      "text-field": ["to-string", ["get", "count"]],
      "text-size": ["interpolate", ["linear"], ["get", "count"], 1, 11, 10, 12, 50, 13, 150, 14],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": colors.dark ? "#eef8f5" : "#173b37",
      "text-halo-color": colors.dark ? "rgba(7,13,28,.86)" : "rgba(255,255,255,.9)",
      "text-halo-width": colors.dark ? 1.1 : 1.5,
    },
  });
  map.addLayer({
    id: "point-place-selection-label",
    type: "symbol",
    source: "point-places",
    filter: ["==", ["get", "centerKey"], ""],
    layout: {
      visibility: "visible",
      "text-field": ["get", "placeName"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "bottom",
      "text-offset": [0, -1.55],
      "text-letter-spacing": 0.015,
      "text-padding": 4,
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": colors.dark ? "#e0e6ef" : "#34465b",
      "text-halo-color": colors.dark ? "rgba(7,13,28,.9)" : "rgba(255,255,255,.92)",
      "text-halo-width": 0.7,
      "text-halo-blur": 0.3,
    },
  });
  map.addLayer({
    id: "point-place-hit",
    type: "circle",
    source: "point-places",
    layout: { visibility: "visible" },
    paint: {
      "circle-radius": 10,
      "circle-opacity": 0.001,
    },
  });
  map.addLayer({
    id: "place-labels",
    type: "symbol",
    source: "places",
    minzoom: 8.4,
    layout: {
      visibility: visible("labels"),
      "text-field": ["get", "name"],
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-font": ["Noto Sans Regular"],
      "text-size": 10.5,
      "text-letter-spacing": 0.025,
      "text-max-width": 9,
    },
    paint: {
      "text-color": colors.dark ? "#c9d3e3" : "#46566b",
      "text-halo-color": colors.dark ? "rgba(23,29,43,.65)" : "rgba(252,250,246,.65)",
      "text-halo-width": 0.6,
      "text-halo-blur": 0.3,
    },
  });
  map.addLayer({
    id: "unmapped-aura",
    type: "circle",
    source: "unmapped",
    layout: { visibility: visible("unmapped") },
    paint: {
      "circle-color": colors.green,
      "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 31, ["boolean", ["feature-state", "hovered"], false], 29, 27],
      "circle-opacity": colors.dark ? 0.045 : 0.03,
      "circle-blur": 0.72,
    },
  });
  map.addLayer({
    id: "unmapped",
    type: "circle",
    source: "unmapped",
    layout: { visibility: visible("unmapped") },
    paint: {
      "circle-color": colors.green,
      "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 21, ["boolean", ["feature-state", "hovered"], false], 20, 18],
      "circle-opacity": colors.dark ? 0.08 : 0.055,
      "circle-stroke-color": colors.green,
      "circle-stroke-opacity": colors.dark ? 0.5 : 0.58,
      "circle-stroke-width": ["case", ["any", ["boolean", ["feature-state", "selected"], false], ["boolean", ["feature-state", "hovered"], false]], 2.2, 1.4],
      "circle-blur": 0,
    },
  });
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    map.addLayer({
      id: `unmapped-dot-${index}`,
      type: "circle",
      source: "unmapped",
      layout: { visibility: visible("unmapped") },
      paint: {
        "circle-color": colors.green,
        "circle-radius": ["case", ["any", ["boolean", ["feature-state", "selected"], false], ["boolean", ["feature-state", "hovered"], false]], 1.7, 1.35],
        "circle-opacity": colors.dark ? 0.7 : 0.76,
        "circle-translate": [Math.cos(angle) * 24, Math.sin(angle) * 24],
        "circle-translate-anchor": "viewport",
      },
    });
  }
  map.addLayer({
    id: "unmapped-count",
    type: "symbol",
    source: "unmapped",
    layout: {
      visibility: visible("unmapped"),
      "text-field": ["get", "count"],
      "text-size": 11,
    },
    paint: { "text-color": colors.ink },
  });
  if (!params.has("lng") && !params.has("lat") && !selectedId) resetExtent();
  applyTheme(basemapExplicit);
  setMapMode(mapMode, false);
  applyFilters(false);
  if (selectedId) selectPlace(selectedId);
  updateCount();
  syncControls();
});
map.on("click", "clusters", async (event) => {
  const feature = map.queryRenderedFeatures(event.point, {
      layers: ["clusters"],
    })[0],
    source = map.getSource("legend-clusters") as maplibregl.GeoJSONSource,
    clusterId = Number(feature.properties?.cluster_id),
    zoom = await source.getClusterExpansionZoom(clusterId);
  renderPanel();
  map.easeTo({
    center: (feature.geometry as { coordinates: [number, number] })
      .coordinates,
    zoom,
  });
});
map.on("mousemove", "clusters", (event) => {
  const clusterId = Number(event.features?.[0]?.properties?.cluster_id);
  if (!Number.isFinite(clusterId) || clusterId === hoveredClusterId) return;
  hoveredClusterId = clusterId;
  map.setFilter("cluster-hover", ["all", ["has", "point_count"], ["==", ["get", "cluster_id"], clusterId]]);
});
map.on("mouseleave", "clusters", () => {
  hoveredClusterId = null;
  map.setFilter("cluster-hover", ["all", ["has", "point_count"], ["==", ["get", "cluster_id"], -1]]);
});
map.on("click", "heatmap", (event) => {
  const northwest = map.unproject([event.point.x - 42, event.point.y - 42]), southeast = map.unproject([event.point.x + 42, event.point.y + 42]),
    nearby = filteredFeatures.filter((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return longitude >= northwest.lng && longitude <= southeast.lng && latitude <= northwest.lat && latitude >= southeast.lat;
    });
  if (nearby.length) renderAggregate(tr("map.hotspotSummary"), nearby);
});
map.on("click", "point-links-hit", (event) => {
  if (pointStyle !== "rays" || map.queryRenderedFeatures(event.point, { layers: ["point-place-hit"] }).length) return;
  const id = nearestPointLegend(event), feature = filteredFeatures.find((item) => item.properties.id === id);
  if (feature) renderLegend(feature.properties);
});
map.on("mousemove", "point-links-hit", (event) => {
  if (pointStyle !== "rays" || map.queryRenderedFeatures(event.point, { layers: ["point-place-hit"] }).length) return;
  const id = nearestPointLegend(event);
  setHoveredPointLegendState(id || null);
  if (id && id !== activePointLegend) showPointLegendLink(id);
});
map.on("mouseleave", "point-links-hit", () => {
  if (pointStyle !== "rays") return;
  setHoveredPointLegendState(null);
  selectedPointLegend ? showPointLegendLink(selectedPointLegend, true) : showPointLinks(selectedPointCenter, Boolean(selectedPointCenter));
});
map.on("click", "points-hit", (event) => {
  if (!bubbleInteractionActive() || map.queryRenderedFeatures(event.point, { layers: ["point-place-hit"] }).length) return;
  const properties = event.features?.[0]?.properties as LegendProperties|undefined;
  if (properties) renderLegend(properties);
});
map.on("mousemove", "points-hit", (event) => {
  if (!bubbleInteractionActive() || map.queryRenderedFeatures(event.point, { layers: ["point-place-hit"] }).length) return;
  const id = String(event.features?.[0]?.properties?.id || "");
  setHoveredPointLegendState(id || null);
  if (id && id !== activePointLegend) showPointLegendLink(id);
});
map.on("mouseleave", "points-hit", () => {
  if (!bubbleInteractionActive()) return;
  setHoveredPointLegendState(null);
  selectedPointLegend ? showPointLegendLink(selectedPointLegend, true) : showPointLinks(selectedPointCenter, Boolean(selectedPointCenter));
});
map.on("click", "point-place-hit", (event) => {
  const placeId = String(event.features?.[0]?.properties?.placeId || ""), centerKey = String(event.features?.[0]?.properties?.centerKey || "");
  if (placeId) renderPointPlace(placeId, centerKey || null);
});
map.on("mouseenter", "point-place-hit", (event) => {
  const centerKey = String(event.features?.[0]?.properties?.centerKey || "");
  if (centerKey && mapMode !== "places") showPointLinks(centerKey);
});
map.on("mouseleave", "point-place-hit", () => selectedPointLegend ? showPointLegendLink(selectedPointLegend, true) : showPointLinks(selectedPointCenter, Boolean(selectedPointCenter)));
container.addEventListener("mouseleave", () => {
  setHoveredPointLegendState(null);
  selectedPointLegend ? showPointLegendLink(selectedPointLegend, true) : showPointLinks(selectedPointCenter, Boolean(selectedPointCenter));
});
map.on("click", "unmapped", renderUnmapped);
map.on("mouseenter", "unmapped", () => map.setFeatureState({ source: "unmapped", id: "unmapped" }, { hovered: true }));
map.on("mouseleave", "unmapped", () => map.setFeatureState({ source: "unmapped", id: "unmapped" }, { hovered: false }));
map.on("mouseenter", "network-node-hit", (event) => {
  const properties = event.features?.[0]?.properties as { id?: string } | undefined, node = networkNodes.find((item) => item.id === properties?.id);
  if (!node) return;
  hoveredNetworkNode = node.id;
  scheduleNetworkFocus();
  const related = (adjacentEdges.get(node.id) || []).length;
  const rect=container.getBoundingClientRect();
  showPlatformTooltip([node.name,networkKindLabel(node),tr("map.networkLegendCount", { count: formatter().format(node.count) }),tr("map.networkPlotCount", { count: formatter().format(node.plotCount) }),tr("map.networkRelatedCount", { count: formatter().format(related) })],{left:rect.left+event.point.x,top:rect.top+event.point.y,right:rect.left+event.point.x,bottom:rect.top+event.point.y,width:0,height:0});
});
map.on("mousemove", "network-node-hit", (event) => {
  const rect=container.getBoundingClientRect();
  movePlatformTooltip({left:rect.left+event.point.x,top:rect.top+event.point.y,right:rect.left+event.point.x,bottom:rect.top+event.point.y,width:0,height:0});
});
map.on("mouseleave", "network-node-hit", () => {
  hoveredNetworkNode = null;
  unmappedSelected = false;
  map.setFeatureState({ source: "unmapped", id: "unmapped" }, { selected: false, hovered: false });
  hidePlatformTooltip();
  scheduleNetworkFocus();
});
map.on("click", "network-node-hit", (event) => {
  const id = String(event.features?.[0]?.properties?.id || "");
  if (id) renderNetworkNodePanel(id);
});
map.on("click", "network-selected-label", (event) => {
  const id = String(event.features?.[0]?.properties?.id || "");
  if (id) renderNetworkNodePanel(id);
});
map.on("click", "network", (event) => {
  if (map.queryRenderedFeatures(event.point, { layers: ["network-node-hit"] }).length) return;
  const id = String(event.features?.[0]?.properties?.id || "");
  if (id) renderNetworkEdgePanel(id);
});
const clearMapSelection = () => {
  setHoveredPointLegendState(null);
  selectPointLegend(null);
  selectedId = null;
  selectedPointCenter = null;
  activePointPlace = null;
  activePointLegend = null;
  activeNetworkNode = null;
  hoveredNetworkNode = null;
  updatePointCenterSelection();
  showPointLinks(null);
  applyNetworkFocus(null);
  hidePlatformTooltip();
  renderPanel();
  updateUrl();
};
map.on("click", (event) => {
  const interactiveLayers = ["points-hit", "point-links-hit", "point-place-hit", "clusters", "heatmap", "unmapped", "network-node-hit", "network-selected-label", "network"]
    .filter((layer) => map.getLayer(layer));
  if (interactiveLayers.length && map.queryRenderedFeatures(event.point, { layers: interactiveLayers }).length) return;
  clearMapSelection();
});
for (const layer of ["points-hit", "point-links-hit", "point-place-hit", "clusters", "unmapped", "network-node-hit", "network"]) {
  map.on(
    "mouseenter",
    layer,
    () => (map.getCanvas().style.cursor = "pointer"),
  );
  map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
}
const syncNetworkChoices = () => {
  page.querySelector<HTMLElement>("[data-network-palette]")!.hidden = networkColor.value !== "single";
  page.querySelectorAll<HTMLInputElement>('[name="network-palette"]').forEach(input => input.checked = input.value === networkPalette);
  networkToolbar.querySelectorAll<HTMLDetailsElement>("[data-network-choice]").forEach((choice) => {
    const select = choice.querySelector<HTMLSelectElement>("select")!, selected = choice.querySelector<HTMLButtonElement>(`[data-network-value="${select.value}"]`)!, label = choice.querySelector<HTMLElement>("[data-network-choice-label]")!;
    const translationKey = selected.dataset.i18n!;
    label.dataset.i18n = translationKey;
    label.textContent = tr(translationKey);
    choice.querySelectorAll<HTMLButtonElement>("[data-network-value]").forEach((button) => button.setAttribute("aria-pressed", String(button === selected)));
  });
};
const syncControls = () => {
  const viewHelp = page.querySelector<HTMLAnchorElement>("[data-map-method]")!;
  viewHelp.hidden = mapMode === "network";
  viewHelp.href = `${base}par-projektu/#dati`;
  (window as any).syncSliderProgress?.();
  heatControls.hidden = mapMode !== "heatmap";
  heatKey.hidden = mapMode !== "heatmap";
  networkToolbar.hidden = mapMode !== "network";
  const networkTitle = page.querySelector<HTMLElement>("[data-network-view-title]")!;
  networkTitle.hidden = mapMode !== "network";
  const networkTitleText = networkTitle.querySelector<HTMLElement>("[data-network-title-text]")!;
  networkTitleText.dataset.i18n = networkType.value === "collectors" ? "map.networkTitleCollectors" : "map.networkTitleTypes";
  networkTitleText.textContent = tr(networkTitleText.dataset.i18n);
  syncNetworkChoices();
  page.querySelector<HTMLElement>("[data-visualization-settings]")!.hidden = mapMode === "network";
  const detailActive = clusterDetailActive();
  page.querySelector<HTMLElement>("[data-point-color-by]")!.hidden = !legendMapActive() && !detailActive;
  page.querySelector<HTMLElement>("[data-point-style-choice]")!.hidden = mapMode !== "points";
  pointControls.hidden = !legendMapActive() && !detailActive;
  page.querySelector<HTMLElement>("[data-places-size-control]")!.hidden = mapMode !== "places";
  page.querySelector<HTMLElement>("[data-places-sizing]")!.hidden = mapMode !== "places";
  const unmappedVisible = mapMode !== "network" && page.querySelector<HTMLInputElement>('[data-layer="unmapped"]')!.checked;
  for (const id of ["unmapped-aura", "unmapped", ...Array.from({ length: 12 }, (_, index) => `unmapped-dot-${index}`), "unmapped-count"])
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", unmappedVisible ? "visible" : "none");
};
page.querySelectorAll<HTMLInputElement>("[data-layer]").forEach((input) =>
  input.addEventListener("change", () => {
    const name = input.dataset.layer!,
      visibility = input.checked ? "visible" : "none",
      ids =
        name === "labels"
          ? ["city-dots", "city-labels", "place-labels"]
          : name === "geography"
            ? ["land", "coast", "lakes", "rivers", "territory-boundaries", "carto-streets"]
          : name === "clusters"
            ? ["cluster-aura", "cluster-ring", "clusters", "cluster-hover", "cluster-count"]
          : name === "unmapped"
              ? ["unmapped-aura", "unmapped", ...Array.from({ length: 12 }, (_, index) => `unmapped-dot-${index}`), "unmapped-count"]
              : [name];
    ids.forEach(
      (id) =>
        map.getLayer(id) &&
        map.setLayoutProperty(id, "visibility", visibility),
    );
    if (name === "labels" || name === "geography") applyBasemapStyle();
    syncControls();
    updateCount();
    updateUrl();
  }),
);
page.querySelectorAll<HTMLButtonElement>("[data-map-mode]:not(:disabled)").forEach((button) =>
  button.addEventListener("click", () => setMapMode(button.dataset.mapMode!)),
);
heatInput.addEventListener("input", () => {
  heatOutput.value = `${heatInput.value}%`;
  if (map.getLayer("heatmap"))
    map.setPaintProperty(
      "heatmap",
      "heatmap-intensity",
      heatIntensity() as any,
    );
  updateUrl();
});
networkStrongestOnly.addEventListener("change", () => {
  applyNetworkFocus(activeNetworkNode || hoveredNetworkNode);
  updateUrl();
});
networkSize.addEventListener("change", () => updateUrl());
networkSize.addEventListener("input", () => {
  networkSizeOutput.value = `${networkSize.value}%`;
  scheduleNetworkFocus();
});
networkIntensity.addEventListener("change", () => updateUrl());
networkIntensity.addEventListener("input", () => {
  networkIntensityOutput.value = `${networkIntensity.value}%`;
  scheduleNetworkFocus();
});
page.querySelectorAll<HTMLInputElement>('[name="places-size-by"]').forEach(input => input.addEventListener("change", () => {
  if (!input.checked) return;
  placesSizeBy = input.value;
  updatePointSources();
  updatePointCenterSelection();
  showPointLinks(selectedPointCenter, Boolean(selectedPointCenter));
  updateUrl();
}));
placesSize.addEventListener("input", () => {
  placesSizeOutput.value = `${placesSize.value}%`;
  updatePointSources();
  updatePointCenterSelection();
  showPointLinks(selectedPointCenter, Boolean(selectedPointCenter));
  updateUrl();
});
pointIntensity.addEventListener("input", () => {
  pointIntensityOutput.value = `${pointIntensity.value}%`;
  if (pointStyle === "rays") {
    pointSpreadZoom = -1;
    updatePointSources();
  }
  applyTheme(true);
  updateUrl();
});
heatRadius.addEventListener("input", () => {
  radiusOutput.value = heatRadius.value;
  if (map.getLayer("heatmap"))
    map.setPaintProperty("heatmap", "heatmap-radius", heatRadiusValue() as any);
  updateUrl();
});
networkToolbar.querySelectorAll<HTMLDetailsElement>("[data-network-choice]").forEach((choice) => {
  choice.querySelectorAll<HTMLButtonElement>("[data-network-value]:not(:disabled)").forEach((button) => button.addEventListener("click", () => {
    const select = choice.querySelector<HTMLSelectElement>("select")!;
    select.value = button.dataset.networkValue!;
    select.dispatchEvent(new Event("change"));
    choice.open = false;
    syncNetworkChoices();
  }));
  choice.addEventListener("toggle", () => {
    if (!choice.open) return;
    networkToolbar.querySelectorAll<HTMLDetailsElement>("[data-network-choice][open]").forEach((other) => {
      if (other !== choice) other.open = false;
    });
  });
});
networkToolbar.addEventListener("toggle", () => {
  if (!networkToolbar.open) networkToolbar.querySelectorAll<HTMLDetailsElement>("[data-network-choice]").forEach(choice => choice.open = false);
});
networkType.addEventListener("change", () => {
  activeNetworkNode = null; hoveredNetworkNode = null; panel.hidden = true; hidePlatformTooltip();
  recalculateNetwork();
  syncControls();
  updateUrl();
});
networkOthers.addEventListener("change", () => {
  applyNetworkFocus(activeNetworkNode || hoveredNetworkNode);
  syncNetworkChoices();
  updateUrl();
});
networkSizeBy.addEventListener("change", () => {
  applyNetworkFocus(activeNetworkNode || hoveredNetworkNode);
  syncNetworkChoices();
  updateUrl();
});
networkColor.addEventListener("change", () => { recolorNetwork(); updateUrl(); });
page.querySelectorAll<HTMLInputElement>('[name="network-palette"]').forEach(input => input.addEventListener("change", () => {
  if (!input.checked) return;
  networkPalette = input.value;
  recolorNetwork();
  syncNetworkChoices();
  updateUrl();
}));
page.querySelectorAll<HTMLButtonElement>("[data-basemap-option]").forEach((option) => option.addEventListener("click", () => {
  basemapStyle.value = option.dataset.basemapOption!;
  basemapExplicit = true;

  colors = themeColors(basemapPalette(basemapStyle.value) ?? document.documentElement.dataset.theme === "dark");
  basemapMenu.open = false;
  syncBasemapMenu();
  applyTheme(true);
  updateUrl();
}));
page.querySelectorAll<HTMLInputElement>('[data-map-palette] input[name="map-palette"]').forEach((input) => input.addEventListener("change", () => {
  if (!input.checked) return;
  if (mapMode === "heatmap") densityPalette = input.value;
  else pointPalette = input.value;
  colors = themeColors(basemapPalette(basemapStyle.value) ?? document.documentElement.dataset.theme === "dark");
  applyTheme(true);
  updateUrl();
}));
page.querySelectorAll<HTMLInputElement>('[data-point-color-by] input[name="point-color-by"]').forEach((input) => input.addEventListener("change", () => {
  if (!input.checked) return;
  pointColorBy = input.value;
  applyTheme(true);
  updateUrl();
}));
page.querySelectorAll<HTMLInputElement>('[data-point-style-choice] input[name="point-style"]').forEach((input) => input.addEventListener("change", () => {
  if (!input.checked) return;
  pointStyle = input.value;
  syncPointStyleText();
  pointSpreadZoom = -1;
  updatePointSources();
  syncPointStyleLayers();
  applyTheme(true);
  updateUrl();
}));
filterPanel.querySelectorAll<HTMLInputElement>('[data-map-filter] .multi-options input[type="checkbox"]').forEach((input) => input.addEventListener("change", () => {
  const key = input.closest<HTMLElement>("[data-map-filter]")!.dataset.mapFilter as (typeof filterKeys)[number];
  filterExplicit[key] = true;
  if (key === "narrator" || key === "collector") personFilterExplicit[key] = true;
  selectedFilters[key] = new Set([...input.closest<HTMLElement>(".multi-options")!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map((option) => option.value));
  applyFilters();
}));
const syncYears = () => {
  if (Number(yearFromInput.value) > Number(yearToInput.value)) {
    if (document.activeElement === yearFromInput) yearToInput.value = yearFromInput.value;
    else yearFromInput.value = yearToInput.value;
  }
  applyFilters();
};
yearFromInput.addEventListener("input", syncYears);
yearToInput.addEventListener("input", syncYears);
includeUndated.addEventListener("change", () => applyFilters());
includeUnknownPlace.addEventListener("change", () => applyFilters());
filterPanel.querySelectorAll<HTMLButtonElement>("[data-map-select-all], [data-map-clear-all]").forEach((button) => button.addEventListener("click", () => {
  const filter = button.closest<HTMLElement>("[data-map-filter]")!;
  const key = filter.dataset.mapFilter as (typeof filterKeys)[number];
  const selectAll = button.hasAttribute("data-map-select-all");
  filterExplicit[key] = !selectAll;
  if (key === "narrator" || key === "collector") personFilterExplicit[key] = !selectAll;
  selectedFilters[key].clear();
  filter.querySelectorAll<HTMLInputElement>('.multi-options input[type="checkbox"]').forEach((option) => option.checked = selectAll);
  applyFilters();
}));
filterClear.addEventListener("click", () => {
  for (const key of filterKeys) selectedFilters[key].clear();
  filterKeys.forEach((key) => filterExplicit[key] = false);
  personFilterKeys.forEach((key) => personFilterExplicit[key] = false);
  filterPanel.querySelectorAll<HTMLInputElement>('[data-map-filter] .multi-options input[type="checkbox"]').forEach((input) => input.checked = true);
  yearFromInput.value = yearFromInput.min;
  yearToInput.value = yearToInput.max;
  includeUndated.checked = true;
  includeUnknownPlace.checked = true;
  applyFilters();
});
filterPanel.querySelectorAll<HTMLInputElement>("[data-map-filter-search]").forEach((input) => input.addEventListener("input", () => {
  const query = input.value.toLocaleLowerCase("no").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  input.closest<HTMLElement>("[data-map-filter]")!.querySelectorAll<HTMLElement>(".multi-options label").forEach((label) => {
    const value = (label.textContent || "").toLocaleLowerCase("no").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    label.hidden = !value.includes(query);
  });
}));
mobileFilterToggle.addEventListener("click", () => {
  const open = !filterPanel.classList.contains("filters-open");
  filterPanel.classList.toggle("filters-open", open);
  mobileFilterToggle.setAttribute("aria-expanded", String(open));
});
const syncFilterCollapseLabel = () => {
  const collapsed = mapWorkspace.classList.contains("filters-collapsed");
  const label = tr(collapsed ? "map.expandFilters" : "map.collapseFilters");
  filterCollapse.setAttribute("aria-label", label);
  filterCollapse.dataset.tooltip = label;
  filterCollapse.setAttribute("aria-expanded", String(!collapsed));
};
filterCollapse.addEventListener("click", () => {
  mapWorkspace.classList.toggle("filters-collapsed");
  syncFilterCollapseLabel();
  requestAnimationFrame(() => map.resize());
  window.setTimeout(() => map.resize(), 220);
});
filterCollapse.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  filterCollapse.click();
});
const filterLayoutQuery = matchMedia("(min-width: 851px)");
filterLayoutQuery.addEventListener("change", () => {
  if (!filterLayoutQuery.matches) mapWorkspace.classList.remove("filters-collapsed");
  syncFilterCollapseLabel();
  requestAnimationFrame(() => map.resize());
});
syncFilterCollapseLabel();
const exportSelection = (format: "csv" | "geojson" | "graphml") => {
  const rows = [...filteredFeatures.map((feature) => feature.properties), ...filteredUnmappedLegends];
  const csv = ["id,place,record_or_source_year,chapter,narrator,collector,volume,translation", ...rows.map((row) => [row.id, row.placeName, row.year || "", row.themeLv, row.narrator, row.collector, row.volume, row.translation].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
  const xml = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const relationshipField = networkType.value === "collectors" ? "collectors" : "themes";
  const graphml = `<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="relationship" for="graph" attr.name="relationship_type" attr.type="string"/><key id="shared_ids" for="edge" attr.name="shared_metadata_ids" attr.type="string"/><key id="connections" for="node" attr.name="connection_count" attr.type="int"/><key id="name" for="node" attr.name="name" attr.type="string"/><key id="latitude" for="node" attr.name="latitude" attr.type="double"/><key id="longitude" for="node" attr.name="longitude" attr.type="double"/><key id="records" for="node" attr.name="record_count" attr.type="int"/><key id="theme" for="node" attr.name="dominant_theme" attr.type="string"/><key id="themes" for="node" attr.name="theme_count" attr.type="int"/><key id="kind" for="node" attr.name="entity_type" attr.type="string"/><key id="weight" for="edge" attr.name="record_count" attr.type="int"/><key id="ids" for="all" attr.name="legend_ids" attr.type="string"/><key id="shared" for="edge" attr.name="shared_${relationshipField}" attr.type="int"/><key id="strongest" for="edge" attr.name="strongest_shared_${relationshipField}" attr.type="string"/><graph id="teikas" edgedefault="undirected"><data key="relationship">${xml(networkType.value)}</data>${networkNodes.map((node) => `<node id="${xml(node.id)}"><data key="name">${xml(node.name)}</data><data key="latitude">${node.coordinates[1]}</data><data key="longitude">${node.coordinates[0]}</data><data key="records">${node.count}</data><data key="connections">${node.connectionCount}</data><data key="theme">${xml(node.dominantTheme)}</data><data key="themes">${node.plotCount}</data><data key="kind">${xml(node.kind || "place")}</data><data key="ids">${xml(node.legendIds.join(","))}</data></node>`).join("")}${networkEdges.map((edge) => `<edge id="${xml(edge.id)}" source="${xml(edge.fromId)}" target="${xml(edge.toId)}"><data key="weight">${edge.count || 0}</data><data key="ids">${xml((edge.legendIds || []).join(","))}</data><data key="shared">${edge.sharedCount}</data><data key="shared_ids">${xml(edge.strongest.map(item => item.key || item.plot).join(","))}</data><data key="strongest">${xml(edge.strongest.map((item) => item.plot).join(" · "))}</data></edge>`).join("")}</graph></graphml>`;
  const content = format === "csv" ? csv : format === "graphml" ? graphml : JSON.stringify(mapMode === "network" ? { relationshipType: networkType.value, nodes: graphCollections().nodes, edges: graphCollections().edges } : { type: "FeatureCollection", features: [...filteredFeatures, ...filteredUnmappedLegends.map(properties => ({ type: "Feature", geometry: null, properties }))] }, null, 2),
    blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : format === "graphml" ? "application/graphml+xml;charset=utf-8" : "application/geo+json" }),
    link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `teikas-selection.${format}`;
  link.click();
  URL.revokeObjectURL(link.href);
};
page.querySelectorAll<HTMLButtonElement>("[data-map-export]").forEach((button) => button.addEventListener("click", () => exportSelection(button.dataset.mapExport as "csv" | "geojson" | "graphml")));
page.querySelector<HTMLButtonElement>("[data-map-empty-clear]")!.addEventListener("click", () => filterClear.click());
map.on("moveend", () => {
  window.clearTimeout(moveTimer);
  moveTimer = window.setTimeout(() => {
    const pointDetailVisible = legendMapActive() || clusterDetailActive();
    if (pointDetailVisible && Math.abs(map.getZoom() - pointSpreadZoom) >= 0.2) updatePointSources();
    if (clusterDetailRendered !== clusterDetailActive()) {
      clusterDetailRendered = clusterDetailActive();
      applyTheme(true);
    }
    syncPointStyleLayers();
    syncControls();
    updateCount();
    updateUrl();
  }, 120);
});
document.addEventListener("click", (event) => {
  if (layerMenu.open && !layerMenu.contains(event.target as Node))
    layerMenu.open = false;
  if (basemapMenu.open && !basemapMenu.contains(event.target as Node))
    basemapMenu.open = false;
  filterPanel.querySelectorAll<HTMLDetailsElement>("[data-map-filter][open]").forEach((details) => {
    if (!details.contains(event.target as Node)) details.open = false;
  });
  networkToolbar.querySelectorAll<HTMLDetailsElement>("[data-network-choice][open]").forEach((details) => {
    if (!details.contains(event.target as Node)) details.open = false;
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    layerMenu.open = false;
    basemapMenu.open = false;
    filterPanel.querySelectorAll<HTMLDetailsElement>("[data-map-filter][open]").forEach((details) => details.open = false);
    networkToolbar.querySelectorAll<HTMLDetailsElement>("[data-network-choice][open]").forEach((details) => details.open = false);
  }
});
filterPanel.querySelectorAll<HTMLDetailsElement>("[data-map-filter]").forEach((details) => details.addEventListener("toggle", () => {
  if (!details.open) return;
  filterPanel.querySelectorAll<HTMLDetailsElement>("[data-map-filter][open]").forEach((other) => {
    if (other !== details) other.open = false;
  });
}));
new MutationObserver((records) => {
  if (records.some((record) => record.attributeName === "data-theme")) {
    if (!basemapExplicit) {
      basemapStyle.value = document.documentElement.dataset.theme === "dark" ? "dark" : "positron";
      syncBasemapMenu();
    }
    applyTheme(basemapExplicit);
  }
}).observe(document.documentElement, { attributes: true });
const translate = () => {
  syncFullscreen();
  const centerMapLabel = tr("map.resetExtent");
  centerMapButton.setAttribute("aria-label", centerMapLabel);
  centerMapButton.dataset.tooltip = centerMapLabel;
  syncFilterCollapseLabel();
  filterPanel.querySelectorAll<HTMLElement>("[data-unknown-person-type]").forEach((label) => {
    const key = label.dataset.unknownPersonType as keyof typeof unknownPersonKey;
    label.textContent = tr(unknownPersonKey[key]);
  });
  page.querySelector<HTMLElement>("[data-map-undated-note]")!.textContent = tr("map.undatedNote", { count: page.dataset.undatedCount || "0", percent: page.dataset.undatedPercent || "0" });
  filterPanel.querySelectorAll<HTMLElement>('[data-map-filter="translation"] .multi-options label').forEach(label => { const value = label.querySelector<HTMLInputElement>("input")!.value; label.querySelector("span")!.textContent = tr(`map.translation.${value}`); });
  syncPointStyleText();
  updateCount();
  syncControls();
  syncFilterInterface();
  requestAnimationFrame(syncBasemapMenu);
  const language = document.documentElement.dataset.uiLang;
  filterPanel.querySelectorAll<HTMLElement>("[data-theme-lv]").forEach((option) => option.textContent = language === "de" ? option.dataset.themeDe! : option.dataset.themeLv!);
  if (activeNetworkNode && mapMode === "network") renderNetworkNodePanel(activeNetworkNode);
  else if (selectedId) {
    if ((legendMapActive() || clusterDetailActive()) && selectedPointCenter) renderPointPlace(selectedId, selectedPointCenter);
    else {
      const feature = dataset.places.features.find(
        (item) => item.properties.id === selectedId,
      );
      renderPanel(feature?.properties);
    }
  } else if (unmappedSelected) renderUnmapped();
};
window.addEventListener("ui-language-change", translate);
window.addEventListener("resize", updateCount);
heatOutput.value = `${heatInput.value}%`;
radiusOutput.value = heatRadius.value;

requestAnimationFrame(translate);

const locationUncertainty = new Map(dataset.places.features.map(place => [place.properties.id, place.properties.geography?.mapUncertainty?.kind || 'none']));
const renderUncertainty = installUncertaintyStrokes(map, () => uncertaintyToggle.checked && mapMode !== "heatmap", feature => {
 if (feature.properties.cluster) return Number(feature.properties.uncertainCount || 0) > 0;
 const id = feature.properties.placeId || String(feature.properties.id || '').replace(/^place:/, '');
 if (feature.properties.locationUncertain != null) return Boolean(feature.properties.locationUncertain);
 return ['area', 'ambiguous'].includes(locationUncertainty.get(id) || 'none');
});
uncertaintyToggle.addEventListener('change', () => {
 page.querySelector<HTMLElement>('[data-uncertainty-key]')!.hidden = !uncertaintyToggle.checked || mapMode === 'heatmap';
 renderUncertainty();syncUncertaintyButton();updateUrl();
});
page.querySelector<HTMLElement>('[data-uncertainty-key]')!.hidden = !uncertaintyToggle.checked || mapMode === 'heatmap';
