import maplibregl from "maplibre-gl";
import type { LegendProperties, MapDataset, PlaceProperties, SimilarityEdge, SimilarityNode } from "../lib/map/types";
const page = document.querySelector<HTMLElement>("[data-map-page]")!,
  mapStage = page.querySelector<HTMLElement>(".map-stage")!,
  container = page.querySelector<HTMLElement>("[data-map]")!,
  panel = page.querySelector<HTMLElement>("[data-map-panel]")!,
  layerMenu = page.querySelector<HTMLDetailsElement>("[data-layer-menu]")!,
  countLabel = page.querySelector<HTMLAnchorElement>("[data-map-count]")!,
  countText = countLabel.querySelector<HTMLElement>("[data-map-count-text]")!,
  heatKey = page.querySelector<HTMLElement>("[data-heat-key]")!,
  networkKey = page.querySelector<HTMLElement>("[data-network-key]")!,
  heatControls = page.querySelector<HTMLElement>("[data-heat-controls]")!,
  pointControls = page.querySelector<HTMLElement>("[data-point-controls]")!,
  networkToolbar = page.querySelector<HTMLElement>("[data-network-toolbar]")!,
  networkContext = page.querySelector<HTMLElement>("[data-network-context]")!,
  networkTooltip = page.querySelector<HTMLElement>("[data-network-tooltip]")!,
  heatInput = page.querySelector<HTMLInputElement>(
    "[data-heat-intensity]",
  )!,
  heatOutput = page.querySelector<HTMLOutputElement>("[data-heat-output]")!,
  pointIntensity = page.querySelector<HTMLInputElement>("[data-point-intensity]")!,
  pointIntensityOutput = page.querySelector<HTMLOutputElement>("[data-point-intensity-output]")!,
  heatRadius = page.querySelector<HTMLInputElement>("[data-heat-radius]")!,
  radiusOutput = page.querySelector<HTMLOutputElement>(
    "[data-radius-output]",
  )!,
  networkType = page.querySelector<HTMLSelectElement>(
    "[data-network-type]",
  )!,
  networkDensity = page.querySelector<HTMLInputElement>("[data-network-density]")!,
  networkColor = page.querySelector<HTMLSelectElement>("[data-network-color]")!,
  networkFocus = page.querySelector<HTMLSelectElement>("[data-network-focus]")!,
  networkCompare = page.querySelector<HTMLButtonElement>("[data-network-compare]")!,
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
  statusCount = page.querySelector<HTMLElement>("[data-map-total-count]")!,
  filterSummary = page.querySelector<HTMLElement>("[data-map-filter-summary]")!,
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
const requestedLayers = new Set(
    (params.get("layers") || "geography,labels").split(","),
  ),
  initialCenter: [number, number] = [
    Number(params.get("lng")) || 24.6359,
    Number(params.get("lat")) || 56.8962,
  ],
  initialZoom = Number(params.get("z")) || 6.26;
let mapMode = ["points", "clusters"].includes(params.get("mode") || "") ? params.get("mode")! : "points";
const filterKeys = ["theme", "narrator", "collector", "place", "volume"] as const,
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
const propertyForFilter = { theme: "themeLv", narrator: "narrator", collector: "collector", place: "placeName", volume: "volume" } as const;
const allLegendProperties = [...dataset.legends.features.map((feature) => feature.properties), ...(dataset.unmappedLegends || [])];
for (const key of filterKeys) {
  const values = [...new Set(allLegendProperties.map((properties) => properties[propertyForFilter[key]]).filter(Boolean))].sort((first, second) => String(first).localeCompare(String(second), "lv", { numeric: true })).map(String);
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
    } else text.textContent = key === "volume" ? `${value}. sējums` : String(value);
    if (key === "theme") {
      const properties = dataset.legends.features.find((feature) => feature.properties.themeLv === value)!.properties;
      text.dataset.themeLv = properties.themeLv;
      text.dataset.themeDe = properties.themeDe || properties.themeLv;
    }
    label.append(input, text);
    options.append(label);
  }
}
heatInput.value = String(Number(params.get("heat")) || 70);
pointIntensity.value = String(Math.min(200, Math.max(40, Number(params.get("pointIntensity")) || 100)));
pointIntensityOutput.value = `${pointIntensity.value}%`;
heatRadius.value = String(Number(params.get("radius")) || 26);
networkType.value = "similarity";
networkDensity.value = params.get("networkDensity") || "45";
networkColor.value = params.get("networkColor") || "theme";
networkFocus.value = params.get("networkFocus") || "all";
const requestedBasemap = params.get("basemap"), allowedBasemaps = ["light", "dark", "streets", "minimal"];
let basemapExplicit = Boolean(requestedBasemap && allowedBasemaps.includes(requestedBasemap));
basemapStyle.value = basemapExplicit ? requestedBasemap! : document.documentElement.dataset.theme === "dark" ? "dark" : "light";
let pointPalette = ["green", "blue", "yellow"].includes(params.get("palette") || "") ? params.get("palette")! : "green";
page.querySelector<HTMLInputElement>(`[data-map-palette] input[value="${pointPalette}"]`)!.checked = true;
let pointColorBy = ["single", "theme", "narrator", "collector"].includes(params.get("colorBy") || "") ? params.get("colorBy")! : "single";
page.querySelector<HTMLInputElement>(`[data-point-color-by] input[value="${pointColorBy}"]`)!.checked = true;
let pointStyle = params.get("pointStyle") === "bubbles" ? "bubbles" : "rays";
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
  return {
    dark,
    raised: css("--raised"),
    ink: css("--ink"),
    muted: css("--muted"),
    blue: css("--blue"),
    accent: css("--accent"),
    navy: css("--navy"),
    heatLow: css("--map-heat-low"),
    heatMid: css("--map-heat-mid"),
    heatHigh: css("--map-heat-high"),
    heatHot: css("--map-heat-hot"),
    heatPeak: css("--map-heat-peak"),
    green: css(`--map-data-${pointPalette}-${dark ? "dark" : "light"}`),
    category: Array.from({ length: 7 }, (_, index) => css(`--map-category-${index + 1}-${dark ? "dark" : "light"}`)),
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
const basemapPalette = (style: string) => style === "dark" ? true : style === "streets" || style === "light" ? false : null;
let colors = themeColors(basemapExplicit ? basemapPalette(basemapStyle.value) ?? document.documentElement.dataset.theme === "dark" : document.documentElement.dataset.theme === "dark"),
  selectedId = params.get("selectedPlace") || (params.get("place")?.startsWith("place-") ? params.get("place") : null),
  selectedPointCenter = params.get("selectedCenter"),
  moveTimer = 0;
let pointLinkOpacity: unknown = 0.28,
  pointBubbleOpacity: unknown = 0.4,
  pointBubbleStrokeOpacity: unknown = 0.76;
mapStage.dataset.mapTheme = colors.dark ? "dark" : "light";
const map = new maplibregl.Map({
  container,
  center: initialCenter,
  zoom: initialZoom,
  minZoom: 3,
  maxZoom: 15,
  maxBounds: [
    [-26, 46],
    [51, 73],
  ],
  attributionControl: false,
  style: {
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
centerMapButton.title = tr("map.resetExtent");
centerMapButton.innerHTML = '<span class="map-center-icon" aria-hidden="true"></span>';
centerMapButton.addEventListener("click", () => map.easeTo({ center: [24.6359, 56.8962], zoom: 6.26, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450 }));
navigationGroup?.append(centerMapButton);
requestAnimationFrame(() => {
  const label = tr("map.resetExtent");
  centerMapButton.setAttribute("aria-label", label);
  centerMapButton.title = label;
});
map.addControl(
  new maplibregl.AttributionControl({
    compact: true,
    customAttribution: "Korpuss: Teikas · Ģeogrāfija: Natural Earth",
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
  url.searchParams.set("networkDensity", networkDensity.value);
  url.searchParams.set("networkColor", networkColor.value);
  url.searchParams.set("networkFocus", networkFocus.value);
  url.searchParams.set("palette", pointPalette);
  url.searchParams.set("colorBy", pointColorBy);
  url.searchParams.set("pointStyle", pointStyle);
  url.searchParams.set("pointIntensity", pointIntensity.value);
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
  let value = visibleFeatures.length;
  if (
    page.querySelector<HTMLInputElement>('[data-layer="unmapped"]')!
      .checked &&
    bounds.contains([23.45, 57.15])
  )
    value += filteredUnmappedLegends.length;
  countText.textContent = tr("map.resultsInView", {
    count: formatter().format(value),
  });
  const visibleIds = visibleFeatures.map((feature) => feature.properties.id);
  if (page.querySelector<HTMLInputElement>('[data-layer="unmapped"]')!.checked && bounds.contains([23.45, 57.15])) visibleIds.push(...filteredUnmappedLegends.map((legend) => legend.id));
  if (visibleIds.length) countLabel.href = `${base}teksti/?selection=${encodeURIComponent(visibleIds.join(","))}`;
  else countLabel.removeAttribute("href");
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
  filterClear.hidden = !active;
  yearFromOutput.value = yearFromInput.value;
  yearToOutput.value = yearToInput.value;
  yearFromOutput.classList.toggle("is-changed", yearFromInput.value !== yearFromInput.min);
  yearToOutput.classList.toggle("is-changed", yearToInput.value !== yearToInput.max);
  const minimum = Number(yearFromInput.min), maximum = Number(yearFromInput.max), left = ((Number(yearFromInput.value) - minimum) / (maximum - minimum)) * 100, right = 100 - ((Number(yearToInput.value) - minimum) / (maximum - minimum)) * 100;
  filterPanel.querySelector<HTMLElement>(".range-track")!.style.cssText = `--range-left:${left}%;--range-right:${right}%`;
  filterPanel.querySelector<HTMLElement>(".timeline")!.classList.toggle("is-active", yearFromInput.value !== yearFromInput.min || yearToInput.value !== yearToInput.max);
  statusCount.textContent = mapMode === "network" ? tr("map.networkStatus", { legends: formatter().format(filteredFeatures.length), places: formatter().format(similarityNodes.length), edges: formatter().format(similarityEdges.length) }) : mapMode === "points" ? tr("map.pointStatus", { mapped: formatter().format(filteredFeatures.length), unmapped: formatter().format(filteredUnmappedLegends.length) }) : tr("map.selectionCount", { count: formatter().format(filteredFeatures.length) });
  const filterLabels: string[] = [];
  const labelKeys = { theme: "browser.themeTag", narrator: "browser.narratorTag", collector: "browser.collectorTag", place: "browser.placeTag", volume: "browser.volumeTag" } as const;
  for (const key of filterKeys) {
    if (!filterExplicit[key]) continue;
    if ((key === "narrator" || key === "collector") && !selectedFilters[key].size) {
      filterLabels.push(tr(key === "narrator" ? "map.noNarrators" : "map.noCollectors"));
      continue;
    }
    for (const value of selectedFilters[key]) filterLabels.push(tr(labelKeys[key], { value: value === unknownPersonValue && (key === "narrator" || key === "collector") ? tr(unknownPersonKey[key]) : value }));
  }
  if (yearFromInput.value !== yearFromInput.min || yearToInput.value !== yearToInput.max) filterLabels.push(`${yearFromInput.value}–${yearToInput.value}`);
  if (!includeUndated.checked) filterLabels.push(tr("browser.withoutUndated"));
  filterSummary.replaceChildren(...filterLabels.map((label) => { const tag = document.createElement("span"); tag.textContent = label; return tag; }));
  filterSummary.hidden = filterLabels.length === 0;
  const downloadable = (active || mapMode === "network") && filteredFeatures.length > 0;
  downloadMenu.dataset.disabled = String(!downloadable);
  downloadMenu.querySelector("summary")!.setAttribute("aria-disabled", String(!downloadable));
  downloadMenu.querySelectorAll<HTMLButtonElement>("button").forEach((button) => button.disabled = !downloadable);
  downloadHint.hidden = downloadable;
  emptyState.hidden = !active || filteredFeatures.length > 0;
};
let pointSpreadZoom = -1, activePointPlace: string | null = null, activePointLegend: string | null = null, selectedPointLegend: string | null = null;
let hoveredPointLegendState: string | null = null;
let hoveredClusterId: number | null = null;
const clusterDetailZoom = 11.5;
const clusterDetailActive = () => mapMode === "clusters" && map.getZoom() >= clusterDetailZoom;
const bubbleInteractionActive = () => mapMode === "points" ? pointStyle === "bubbles" : clusterDetailActive();
const effectivePointStyle = () => clusterDetailActive() ? "bubbles" : pointStyle;
let clusterDetailRendered = false;
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
    distance = Math.hypot(dx, dy), offset = effectivePointStyle() === "rays" ? 4.5 : 5.5,
    ratio = distance ? Math.min(0.42, offset / distance) : 0;
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
const categoryColor = (properties: LegendProperties) => {
  if (pointColorBy === "single") return colors.green;
  const value = String(pointColorBy === "theme" ? properties.themeLv : pointColorBy === "narrator" ? properties.narrator : properties.collector).trim();
  if (!value) return colors.categoryNeutral;
  const hash = [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
  return colors.category[Math.abs(hash) % colors.category.length];
};
const canonicalPointCoordinates = new Map(dataset.places.features.map((feature) => [feature.properties.id, feature.geometry.coordinates]));
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
    const [longitude, latitude] = pointGroupCoordinates(feature), key = `${feature.properties.placeId}|${longitude.toFixed(6)}|${latitude.toFixed(6)}`;
    const group = groups.get(key) || [];
    group.push(feature);
    groups.set(key, group);
  });
  const features: any[] = [], centers: any[] = [], goldenAngle = Math.PI * (3 - Math.sqrt(5));
  pointAnchors.clear();
  pointDisplayFeatures.clear();
  groups.forEach((group, key) => {
    group.sort((first, second) => String(first.properties.id).localeCompare(String(second.properties.id)));
    const [longitude, latitude] = pointGroupCoordinates(group[0]), latitudeRadians = latitude * Math.PI / 180,
      metersPerPixel = 156543.03392 * Math.cos(latitudeRadians) / 2 ** zoom;
    group.forEach((feature, index) => {
      const radiusPixels = ((displayStyle === "rays" ? 8.5 : 9.5) + spacing * Math.sqrt(index + 1)) * rayLength, radiusMeters = radiusPixels * metersPerPixel, angle = index * goldenAngle,
        latitudeOffset = Math.sin(angle) * radiusMeters / 111320,
        longitudeOffset = Math.cos(angle) * radiusMeters / Math.max(111320 * Math.cos(latitudeRadians), 1);
      const displayFeature = { ...feature, geometry: { type: "Point", coordinates: [longitude + longitudeOffset, latitude + latitudeOffset] }, properties: { ...feature.properties, visuallyDispersed: true, placeCount: group.length, centerKey: key, categoryColor: categoryColor(feature.properties) } };
      features.push(displayFeature);
      pointAnchors.set(feature.properties.id, [longitude, latitude]);
      pointDisplayFeatures.set(feature.properties.id, displayFeature);
    });
    centers.push({ type: "Feature", id: `${group[0].properties.placeId}-${longitude}-${latitude}`, geometry: { type: "Point", coordinates: [longitude, latitude] }, properties: { placeId: group[0].properties.placeId, centerKey: key, placeName: group[0].properties.placeName, count: group.length, radius: 11 + spacing * Math.sqrt(group.length) } });
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
  const visibleCenters = new Set([selectedPointCenter, centerKey].filter(Boolean));
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
const updatePointCenterSelection = () => {
  if (!map.getLayer("point-place-centers")) return;
  const selected = selectedPointCenter || "", displayStyle = effectivePointStyle(), detailActive = clusterDetailActive();
  const focusedOpacity = (base: unknown, dimmed: number) => selectedPointCenter ? ["case", ["any", ["boolean", ["feature-state", "hovered"], false], ["boolean", ["feature-state", "selected"], false]], base, ["==", ["get", "centerKey"], selected], base, ["*", base, dimmed]] : base;
  map.setPaintProperty("point-links", "line-opacity", focusedOpacity(pointLinkOpacity, displayStyle === "rays" ? 0.24 : 0.3) as never);
  map.setPaintProperty("point-end-bubbles", "circle-opacity", focusedOpacity(pointBubbleOpacity, 0.3) as never);
  map.setPaintProperty("point-end-bubbles", "circle-stroke-opacity", focusedOpacity(pointBubbleStrokeOpacity, 0.34) as never);
  map.setPaintProperty("point-place-containers", "circle-opacity", selectedPointCenter ? ["case", ["==", ["get", "centerKey"], selected], displayStyle === "rays" ? 0 : colors.dark ? 0.018 : 0.008, displayStyle === "rays" ? 0 : colors.dark ? 0.006 : 0.003] : displayStyle === "rays" ? 0 : colors.dark ? 0.018 : 0.008);
  map.setPaintProperty("point-place-containers", "circle-stroke-opacity", selectedPointCenter ? ["case", ["==", ["get", "centerKey"], selected], displayStyle === "rays" ? 0 : colors.dark ? 0.16 : 0.12, displayStyle === "rays" ? 0 : colors.dark ? 0.05 : 0.04] : displayStyle === "rays" ? 0 : colors.dark ? 0.16 : 0.12);
  map.setPaintProperty("point-place-centers", "circle-color", ["case", ["==", ["get", "centerKey"], selected], colors.green, detailActive ? colors.green : colors.land]);
  map.setPaintProperty("point-place-centers", "circle-opacity", detailActive
    ? ["case", ["==", ["get", "centerKey"], selected], colors.dark ? 0.42 : 0.34, selectedPointCenter ? colors.dark ? 0.16 : 0.12 : colors.dark ? 0.22 : 0.16]
    : ["case", ["==", ["get", "centerKey"], selected], colors.dark ? 0.56 : 0.48, displayStyle === "rays" ? selectedPointCenter ? colors.dark ? 0.14 : 0.12 : colors.dark ? 0.42 : 0.34 : 0]);
  map.setPaintProperty("point-place-centers", "circle-stroke-opacity", detailActive
    ? ["case", ["==", ["get", "centerKey"], selected], 1, selectedPointCenter ? 0.46 : 0.84]
    : ["case", ["==", ["get", "centerKey"], selected], 0.95, selectedPointCenter ? colors.dark ? 0.24 : 0.28 : colors.dark ? 0.76 : 0.82]);
  map.setPaintProperty("point-place-center-halo", "circle-opacity", ["case", ["==", ["get", "centerKey"], selected], colors.dark ? 0.13 : 0.1, 0]);
  map.setPaintProperty("point-place-centers", "circle-radius", detailActive
    ? ["interpolate", ["linear"], ["get", "count"], 1, 11, 10, 12.5, 50, 14.5, 150, 17]
    : displayStyle === "rays" ? ["interpolate", ["linear"], ["zoom"], 5, 3.2, 10, 4.6] : ["interpolate", ["linear"], ["zoom"], 5, 4.4, 10, 6.2]);
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
      (!filterExplicit.volume || selectedFilters.volume.has(properties.volume));
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
  if (mapMode === "points" && (selectedLegendRemoved || selectedCenterRemoved)) renderPanel();
  (map.getSource("legend-clusters") as maplibregl.GeoJSONSource)?.setData(collection);
  (map.getSource("unmapped") as maplibregl.GeoJSONSource)?.setData({
    type: "Feature",
    geometry: { type: "Point", coordinates: [23.45, 57.15] },
    properties: { id: "unmapped", count: filteredUnmappedLegends.length },
  } as any);
  if (map.getSource("network")) recalculateNetwork();
  syncFilterInterface();
  updateCount();
  if (mapMode === "clusters") renderPanel();
  if (save) updateUrl();
};
const renderPanel = (properties?: PlaceProperties) => {
  if (!properties) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.hidden = false;
  const years = properties.yearFrom
    ? properties.yearFrom === properties.yearTo
      ? String(properties.yearFrom)
      : `${properties.yearFrom}–${properties.yearTo}`
    : tr("map.noYear");
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><h2>${properties.name}</h2><dl><div><dt>${tr("map.legendCount")}</dt><dd>${formatter().format(properties.count)}</dd></div><div><dt>${tr("map.yearSpan")}</dt><dd>${years}</dd></div><div><dt>${tr("map.collectors")}</dt><dd>${formatter().format(properties.collectorCount)}</dd></div><div><dt>${tr("map.narrators")}</dt><dd>${formatter().format(properties.narratorCount)}</dd></div></dl><a class="button" href="${base}teksti/?place=${encodeURIComponent(properties.id)}"><span>${tr("map.openTexts")}</span><i data-lucide="arrow-right"></i></a>`;
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
  const german = document.documentElement.dataset.uiLang === "de",
    title =
      (german ? properties.titleDe : properties.titleLv) ||
      properties.titleLv ||
      properties.id,
    theme =
      (german ? properties.themeDe : properties.themeLv) ||
      properties.themeLv;
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.legendRecord")} ${properties.id}</p><h2>${title}</h2><dl><div><dt>${tr("meta.place")}</dt><dd>${properties.placeName}</dd></div>${theme ? `<div><dt>${tr("meta.theme")}</dt><dd>${theme}</dd></div>` : ""}${properties.narrator ? `<div><dt>${tr("meta.narrator")}</dt><dd>${properties.narrator}</dd></div>` : ""}${properties.collector ? `<div><dt>${tr("meta.collector")}</dt><dd>${properties.collector}</dd></div>` : ""}<div><dt>${tr("meta.year")}</dt><dd>${properties.year || tr("map.noYear")}</dd></div></dl><a class="button" href="${base}teksti/${properties.id}/"><span>${tr("map.openLegend")}</span><i data-lucide="arrow-right"></i></a><button class="button button-secondary" type="button" data-open-point-place="${properties.placeId}">${tr("map.openPlaceLegends")}</button>`;
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
  const records = filteredFeatures.filter((feature) => feature.properties.placeId === placeId), placeName = records[0]?.properties.placeName;
  if (!records.length || !placeName) return;
  selectedId = placeId;
  selectedPointCenter = centerKey || [...pointDisplayFeatures.values()].find((feature) => feature.properties.placeId === placeId)?.properties.centerKey || null;
  updatePointCenterSelection();
  showPointLinks(selectedPointCenter, true);
  const german = document.documentElement.dataset.uiLang === "de",
    themes = new Set(records.map(({ properties }) => properties.themeLv).filter(Boolean)),
    narrators = new Set(records.map(({ properties }) => properties.narrator).filter(Boolean)),
    collectors = new Set(records.map(({ properties }) => properties.collector).filter(Boolean)),
    themeCounts = new Map<string, { label: string; count: number }>();
  for (const { properties } of records) {
    if (!properties.themeLv) continue;
    const entry = themeCounts.get(properties.themeLv) ?? { label: german ? properties.themeDe || properties.themeLv : properties.themeLv, count: 0 };
    entry.count += 1;
    themeCounts.set(properties.themeLv, entry);
  }
  const topThemes = [...themeCounts.values()].sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, german ? "de" : "lv")).slice(0, 5),
    largestThemeCount = topThemes[0]?.count || 1,
    themeChart = topThemes.length
      ? `<section class="place-theme-chart"><h3>${tr("map.placeTopThemes")}</h3><ol>${topThemes.map((theme) => `<li><div><span>${theme.label}</span><strong>${formatter().format(theme.count)}</strong></div><i><b style="--theme-share:${(theme.count / largestThemeCount) * 100}%"></b></i></li>`).join("")}</ol></section>`
      : "",
    href = `${base}teksti/?place=${encodeURIComponent(placeId)}`;
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.pointPlaceCollection")}</p><h2>${placeName}</h2><dl class="place-summary"><div><dt>${tr("map.legendCount")}</dt><dd>${formatter().format(records.length)}</dd></div><div><dt>${tr("map.placeThemeCount")}</dt><dd>${formatter().format(themes.size)}</dd></div><div><dt>${tr("map.narrators")}</dt><dd>${formatter().format(narrators.size)}</dd></div><div><dt>${tr("map.collectors")}</dt><dd>${formatter().format(collectors.size)}</dd></div></dl>${themeChart}<a class="button place-browser-button" href="${href}"><span>${tr("map.openLegendBrowser")}</span><i data-lucide="arrow-right"></i></a>`;
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
  const german = document.documentElement.dataset.uiLang === "de",
    themes = new Set(filteredUnmappedLegends.map((properties) => properties.themeLv).filter(Boolean)),
    narrators = new Set(filteredUnmappedLegends.map((properties) => properties.narrator).filter(Boolean)),
    collectors = new Set(filteredUnmappedLegends.map((properties) => properties.collector).filter(Boolean)),
    themeCounts = new Map<string, { label: string; count: number }>();
  for (const properties of filteredUnmappedLegends) {
    if (!properties.themeLv) continue;
    const entry = themeCounts.get(properties.themeLv) ?? { label: german ? properties.themeDe || properties.themeLv : properties.themeLv, count: 0 };
    entry.count += 1;
    themeCounts.set(properties.themeLv, entry);
  }
  const topThemes = [...themeCounts.values()].sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, german ? "de" : "lv")).slice(0, 5),
    largestThemeCount = topThemes[0]?.count || 1,
    themeChart = topThemes.length
      ? `<section class="place-theme-chart"><h3>${tr("map.placeTopThemes")}</h3><ol>${topThemes.map((theme) => `<li><div><span>${theme.label}</span><strong>${formatter().format(theme.count)}</strong></div><i><b style="--theme-share:${(theme.count / largestThemeCount) * 100}%"></b></i></li>`).join("")}</ol></section>`
      : "",
    ids = filteredUnmappedLegends.map((properties) => properties.id).filter(Boolean),
    href = ids.length && ids.join(",").length < 6500 ? `${base}teksti/?selection=${encodeURIComponent(ids.join(","))}` : `${base}teksti/`;
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.pointPlaceCollection")}</p><h2>${tr("map.unmappedTitle")}</h2><p class="map-panel-note unmapped-panel-note">${tr("map.unmappedExplanation")}</p><dl class="place-summary"><div><dt>${tr("map.legendCount")}</dt><dd>${formatter().format(filteredUnmappedLegends.length)}</dd></div><div><dt>${tr("map.placeThemeCount")}</dt><dd>${formatter().format(themes.size)}</dd></div><div><dt>${tr("map.narrators")}</dt><dd>${formatter().format(narrators.size)}</dd></div><div><dt>${tr("map.collectors")}</dt><dd>${formatter().format(collectors.size)}</dd></div></dl>${themeChart}<a class="button place-browser-button" href="${href}"><span>${tr("map.openLegendBrowser")}</span><i data-lucide="arrow-right"></i></a>`;
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
    href = ids.length && ids.join(",").length < 6500 ? `${base}teksti/?selection=${encodeURIComponent(ids.join(","))}` : `${base}teksti/`;
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
      if ((mapMode === "points" || clusterDetailActive()) && selectedPointCenter) renderPointPlace(id, selectedPointCenter);
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
let similarityNodes: SimilarityNode[] = [],
  similarityEdges: SimilarityEdge[] = [],
  activeNetworkNode: string | null = null,
  hoveredNetworkNode: string | null = null;
const placeFeatures = new Map(dataset.places.features.map((feature) => [feature.properties.id, feature]));
const curve = (start: [number, number], end: [number, number], key: string) => {
  const latitude = (start[1] + end[1]) / 2,
    longitudeScale = Math.cos((latitude * Math.PI) / 180),
    dx = (end[0] - start[0]) * longitudeScale,
    dy = end[1] - start[1],
    distance = Math.hypot(dx, dy),
    direction = [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % 2 ? 1 : -1,
    offset = Math.min(0.3, Math.max(0.02, distance * 0.09)) * direction,
    control: [number, number] = [
      (start[0] + end[0]) / 2 - (dy / Math.max(distance, 0.001)) * offset / longitudeScale,
      (start[1] + end[1]) / 2 + (dx / Math.max(distance, 0.001)) * offset,
    ];
  return Array.from({ length: 15 }, (_, index) => {
    const time = index / 14, inverse = 1 - time;
    return [inverse * inverse * start[0] + 2 * inverse * time * control[0] + time * time * end[0], inverse * inverse * start[1] + 2 * inverse * time * control[1] + time * time * end[1]];
  });
};
const networkColorFor = (node: SimilarityNode, maximum: number) => {
  if (networkColor.value === "single") return colors.green;
  if (networkColor.value === "count") {
    const ratio = Math.sqrt(node.count / Math.max(maximum, 1));
    return ratio > 0.72 ? colors.accent : ratio > 0.42 ? colors.blue : colors.green;
  }
  const palette = [colors.green, colors.blue, colors.accent, colors.pin];
  const index = [...node.dominantTheme].reduce((total, character) => total + character.charCodeAt(0), 0) % palette.length;
  return palette[index];
};
const graphCollections = () => ({
  nodes: {
    type: "FeatureCollection",
    features: similarityNodes.map((node) => ({
      type: "Feature",
      id: node.id,
      geometry: { type: "Point", coordinates: node.coordinates },
      properties: { id: node.id, name: node.name, count: node.count, plotCount: node.plotCount, dominantTheme: node.dominantTheme, color: node.color },
    })),
  },
  edges: {
    type: "FeatureCollection",
    features: similarityEdges.map((edge) => ({
      type: "Feature",
      id: edge.id,
      geometry: { type: "LineString", coordinates: edge.coordinates },
      properties: { id: edge.id, fromId: edge.fromId, toId: edge.toId, similarity: edge.similarity, sharedCount: edge.sharedCount, strongest: JSON.stringify(edge.strongest) },
    })),
  },
});
const recalculateNetwork = () => {
  const profiles = new Map<string, { plots: Map<string, number>; themes: Map<string, number>; ids: string[] }>();
  filteredFeatures.forEach((feature) => {
    const properties = feature.properties as LegendProperties,
      plot = properties.themeLv.trim();
    if (!plot || !properties.placeId) return;
    const profile = profiles.get(properties.placeId) || { plots: new Map<string, number>(), themes: new Map<string, number>(), ids: [] as string[] };
    profile.plots.set(plot, (profile.plots.get(plot) || 0) + 1);
    if (properties.themeLv) profile.themes.set(properties.themeLv, (profile.themes.get(properties.themeLv) || 0) + 1);
    profile.ids.push(properties.id);
    profiles.set(properties.placeId, profile);
  });
  const eligible = [...profiles].filter(([, profile]) => profile.ids.length >= 5),
    documentFrequency = new Map<string, number>();
  eligible.forEach(([, profile]) => profile.plots.forEach((_, plot) => documentFrequency.set(plot, (documentFrequency.get(plot) || 0) + 1)));
  const vectors = new Map<string, Map<string, number>>(), norms = new Map<string, number>();
  eligible.forEach(([placeId, profile]) => {
    const vector = new Map<string, number>();
    profile.plots.forEach((frequency, plot) => {
      const inverseFrequency = Math.log((eligible.length + 1) / ((documentFrequency.get(plot) || 0) + 1)) + 1;
      vector.set(plot, (1 + Math.log(frequency)) * inverseFrequency);
    });
    vectors.set(placeId, vector);
    norms.set(placeId, Math.sqrt([...vector.values()].reduce((total, value) => total + value * value, 0)));
  });
  const candidates: SimilarityEdge[] = [];
  for (let first = 0; first < eligible.length; first += 1) {
    const [fromId, fromProfile] = eligible[first], fromVector = vectors.get(fromId)!;
    for (let second = first + 1; second < eligible.length; second += 1) {
      const [toId, toProfile] = eligible[second], toVector = vectors.get(toId)!, shared = [...fromVector.keys()].filter((plot) => toVector.has(plot));
      if (shared.length < 2) continue;
      const similarity = shared.reduce((total, plot) => total + fromVector.get(plot)! * toVector.get(plot)!, 0) / Math.max((norms.get(fromId) || 1) * (norms.get(toId) || 1), 0.0001),
        threshold = 0.82 - Number(networkDensity.value) * 0.0032;
      if (similarity < threshold) continue;
      const fromPlace = placeFeatures.get(fromId), toPlace = placeFeatures.get(toId);
      if (!fromPlace || !toPlace) continue;
      const strongest = shared.map((plot) => ({ plot, from: fromProfile.plots.get(plot)!, to: toProfile.plots.get(plot)!, weight: fromVector.get(plot)! * toVector.get(plot)! })).sort((a, b) => b.weight - a.weight).slice(0, 12);
      candidates.push({ id: `${fromId}|${toId}`, fromId, toId, similarity, sharedCount: shared.length, strongest, coordinates: curve(fromPlace.geometry.coordinates, toPlace.geometry.coordinates, `${fromId}|${toId}`) });
    }
  }
  candidates.sort((first, second) => second.similarity - first.similarity);
  const maximumDegree = 2 + Math.round(Number(networkDensity.value) / 40), degree = new Map<string, number>();
  similarityEdges = candidates.filter((edge) => {
    if ((degree.get(edge.fromId) || 0) >= maximumDegree || (degree.get(edge.toId) || 0) >= maximumDegree) return false;
    degree.set(edge.fromId, (degree.get(edge.fromId) || 0) + 1);
    degree.set(edge.toId, (degree.get(edge.toId) || 0) + 1);
    return true;
  });
  const maximumCount = Math.max(1, ...eligible.map(([, profile]) => profile.ids.length));
  similarityNodes = eligible.map(([id, profile]) => {
    const place = placeFeatures.get(id)!, themes = [...profile.themes].sort((a, b) => b[1] - a[1]), plots = [...profile.plots].sort((a, b) => b[1] - a[1]);
    const node: SimilarityNode = { id, name: place.properties.name, coordinates: place.geometry.coordinates, count: profile.ids.length, plotCount: profile.plots.size, dominantTheme: themes[0]?.[0] || tr("map.notAvailable"), themes, plots, legendIds: profile.ids, color: colors.green };
    node.color = networkColorFor(node, maximumCount);
    return node;
  });
  const collections = graphCollections();
  (map.getSource("network") as maplibregl.GeoJSONSource)?.setData(collections.edges as any);
  (map.getSource("network-nodes") as maplibregl.GeoJSONSource)?.setData(collections.nodes as any);
  networkContext.textContent = tr("map.networkBuiltFrom", { count: formatter().format(filteredFeatures.length) });
  if (mapMode === "network") statusCount.textContent = tr("map.networkStatus", { legends: formatter().format(filteredFeatures.length), places: formatter().format(similarityNodes.length), edges: formatter().format(similarityEdges.length) });
  applyNetworkFocus(activeNetworkNode || hoveredNetworkNode);
};
const relatedNodeIds = (id: string) => {
  const ids = new Set([id]);
  similarityEdges.forEach((edge) => {
    if (edge.fromId === id) ids.add(edge.toId);
    if (edge.toId === id) ids.add(edge.fromId);
  });
  return [...ids];
};
const applyNetworkFocus = (id: string | null) => {
  if (!map.getLayer("network") || !map.getLayer("network-nodes")) return;
  const focused = id && (hoveredNetworkNode || networkFocus.value === "related" || activeNetworkNode), related = focused ? relatedNodeIds(id!) : [];
  map.setPaintProperty("network-nodes", "circle-opacity", focused ? ["case", ["in", ["get", "id"], ["literal", related]], 0.92, 0.1] : 0.82);
  map.setPaintProperty("network-nodes", "circle-stroke-color", activeNetworkNode ? ["case", ["==", ["get", "id"], activeNetworkNode], colors.pin, colors.halo] : colors.halo);
  map.setPaintProperty("network-nodes", "circle-stroke-width", activeNetworkNode ? ["case", ["==", ["get", "id"], activeNetworkNode], 2.2, 0.8] : 0.8);
  const edgeOpacity = focused ? ["case", ["any", ["==", ["get", "fromId"], id], ["==", ["get", "toId"], id]], ["interpolate", ["linear"], ["get", "similarity"], 0.1, 0.42, 0.75, 0.9], 0.025] : ["interpolate", ["linear"], ["get", "similarity"], 0.1, 0.12, 0.75, 0.52];
  map.setPaintProperty("network", "line-opacity", edgeOpacity as any);
  map.setPaintProperty("network-halo", "line-opacity", focused ? ["case", ["any", ["==", ["get", "fromId"], id], ["==", ["get", "toId"], id]], 0.14, 0.01] : ["interpolate", ["linear"], ["get", "similarity"], 0.1, 0.025, 0.75, 0.11]);
};
const recordHref = (ids: string[]) => ids.join(",").length < 6500 ? `${base}teksti/?selection=${encodeURIComponent(ids.join(","))}` : `${base}teksti/`;
const renderNetworkNodePanel = (id: string) => {
  const node = similarityNodes.find((item) => item.id === id);
  if (!node) return;
  activeNetworkNode = id;
  const related = similarityEdges.filter((edge) => edge.fromId === id || edge.toId === id).sort((a, b) => b.similarity - a.similarity),
    relatedList = related.slice(0, 5).map((edge) => {
      const other = similarityNodes.find((item) => item.id === (edge.fromId === id ? edge.toId : edge.fromId));
      return `<li><span>${other?.name || ""}</span><strong>${Math.round(edge.similarity * 100)}%</strong></li>`;
    }).join(""),
    plots = node.plots.slice(0, 5).map(([plot, count], index) => `<li><span>${index + 1}. ${plot}</span><strong>${count}</strong></li>`).join("");
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.networkPlace")}</p><h2>${node.name}</h2><p class="network-panel-count">${tr("map.networkLegendCount", { count: formatter().format(node.count) })}</p><h3>${tr("map.dominantThemes")}</h3><p>${node.themes.slice(0, 3).map(([theme]) => theme).join(" · ")}</p><h3>${tr("map.networkTopPlots")}</h3><ol class="network-ranked">${plots}</ol><h3>${tr("map.networkMostSimilar")}</h3><ul class="network-ranked">${relatedList}</ul><a class="button" href="${recordHref(node.legendIds)}"><span>${tr("map.openPlaceLegends")}</span><i data-lucide="arrow-right"></i></a><button class="button button-secondary" type="button" data-compare-from="${id}">${tr("map.compareWithPlace")}</button>`;
  panel.querySelector(".map-panel-close")?.addEventListener("click", () => { activeNetworkNode = null; panel.hidden = true; applyNetworkFocus(null); });
  panel.querySelector<HTMLButtonElement>("[data-compare-from]")?.addEventListener("click", () => renderComparison(id));
  (window as any).renderLucideIcons?.();
  applyNetworkFocus(id);
};
const renderNetworkEdgePanel = (id: string) => {
  const edge = similarityEdges.find((item) => item.id === id);
  if (!edge) return;
  const from = similarityNodes.find((node) => node.id === edge.fromId)!, to = similarityNodes.find((node) => node.id === edge.toId)!, rows = edge.strongest.slice(0, 7).map((item) => `<li><span>${item.plot}</span><strong>${item.from} ↔ ${item.to}</strong></li>`).join("");
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.plotSimilarity")}</p><h2>${from.name} ↔ ${to.name}</h2><dl><div><dt>${tr("map.similarity")}</dt><dd>${Math.round(edge.similarity * 100)}%</dd></div><div><dt>${tr("map.sharedPlots")}</dt><dd>${edge.sharedCount}</dd></div></dl><h3>${tr("map.strongestMatches")}</h3><ul class="network-ranked">${rows}</ul><button class="button" type="button" data-edge-compare>${tr("map.compareBothPlaces")}</button>`;
  panel.querySelector(".map-panel-close")?.addEventListener("click", () => { panel.hidden = true; });
  panel.querySelector("[data-edge-compare]")?.addEventListener("click", () => renderComparison(from.id, to.id));
  (window as any).renderLucideIcons?.();
};
const renderComparison = (firstId = activeNetworkNode || "", secondId = "") => {
  const options = similarityNodes.slice().sort((a, b) => a.name.localeCompare(b.name, "lv")).map((node) => `<option value="${node.id}">${node.name}</option>`).join("");
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><p class="map-panel-eyebrow">${tr("map.networkComparison")}</p><h2>${tr("map.comparePlaces")}</h2><label class="compare-select"><span>${tr("map.firstPlace")}</span><select data-compare-first>${options}</select></label><label class="compare-select"><span>${tr("map.secondPlace")}</span><select data-compare-second><option value="">—</option>${options}</select></label><div data-comparison-results></div>`;
  const first = panel.querySelector<HTMLSelectElement>("[data-compare-first]")!, second = panel.querySelector<HTMLSelectElement>("[data-compare-second]")!, results = panel.querySelector<HTMLElement>("[data-comparison-results]")!;
  first.value = firstId || similarityNodes[0]?.id || "";
  second.value = secondId;
  const update = () => {
    const left = similarityNodes.find((node) => node.id === first.value), right = similarityNodes.find((node) => node.id === second.value);
    if (!left || !right) { results.innerHTML = `<p class="map-panel-note">${tr("map.chooseSecondPlace")}</p>`; return; }
    const leftPlots = new Map(left.plots), rightPlots = new Map(right.plots), shared = [...leftPlots.keys()].filter((plot) => rightPlots.has(plot)), onlyLeft = [...leftPlots.keys()].filter((plot) => !rightPlots.has(plot)), onlyRight = [...rightPlots.keys()].filter((plot) => !leftPlots.has(plot)), rows = shared.sort((a, b) => (leftPlots.get(b)! + rightPlots.get(b)!) - (leftPlots.get(a)! + rightPlots.get(a)!)).slice(0, 12).map((plot) => `<li><span>${plot}</span><strong>${leftPlots.get(plot)} ↔ ${rightPlots.get(plot)}</strong></li>`).join("");
    results.innerHTML = `<dl><div><dt>${tr("map.sharedPlots")}</dt><dd>${shared.length}</dd></div><div><dt>${tr("map.onlyIn", { place: left.name })}</dt><dd>${onlyLeft.length}</dd></div><div><dt>${tr("map.onlyIn", { place: right.name })}</dt><dd>${onlyRight.length}</dd></div></dl><h3>${tr("map.shared")}</h3><ul class="network-ranked">${rows}</ul><a class="button" href="${recordHref([...left.legendIds, ...right.legendIds])}"><span>${tr("map.openComparisonLegends")}</span><i data-lucide="arrow-right"></i></a>`;
    (window as any).renderLucideIcons?.();
  };
  first.addEventListener("change", update); second.addEventListener("change", update); update();
  panel.querySelector(".map-panel-close")?.addEventListener("click", () => { panel.hidden = true; });
  (window as any).renderLucideIcons?.();
};
const syncPointStyleLayers = () => {
  page.querySelectorAll<HTMLInputElement>('[data-point-style-choice] input[name="point-style"]').forEach((input) => { input.checked = input.value === pointStyle; });
  page.dataset.pointStyle = pointStyle;
  const pointModeActive = mapMode === "points", detailActive = clusterDetailActive(), pointLayersVisible = pointModeActive || detailActive;
  for (const id of ["points", "point-place-containers", "point-links", "point-focus-links", "point-place-center-halo", "point-place-centers", "point-place-selection-ring", "point-place-selection-label", "point-place-hit"])
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", pointLayersVisible ? "visible" : "none");
  if (map.getLayer("point-place-cluster-count")) map.setLayoutProperty("point-place-cluster-count", "visibility", detailActive ? "visible" : "none");
  if (map.getLayer("point-links-hit")) map.setLayoutProperty("point-links-hit", "visibility", pointModeActive && pointStyle === "rays" ? "visible" : "none");
  for (const id of ["point-end-bubbles", "points-hit"])
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", pointModeActive && pointStyle === "bubbles" || detailActive ? "visible" : "none");
  if (map.getLayer("point-place-centers")) updatePointCenterSelection();
  if (!selectedPointLegend) showPointLinks(selectedPointCenter, Boolean(selectedPointCenter));
};
const setMapMode = (mode: string, save = true) => {
  if (!['points', 'clusters'].includes(mode)) mode = 'points';
  mapMode = mode;
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
  if (map.getLayer("point-links")) applyTheme(true);
  clusterDetailRendered = clusterDetailActive();
  for (const id of ["network-halo", "network", "network-nodes"])
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", mode === "network" ? "visible" : "none");
  heatControls.hidden = mode !== "heatmap";
  pointControls.hidden = mode !== "points";
  page.querySelectorAll<HTMLElement>("[data-point-layer-control]").forEach((control) => control.hidden = mode !== "points");
  heatKey.hidden = mode !== "heatmap";
  networkToolbar.hidden = mode !== "network";
  page.querySelector<HTMLElement>("[data-map-legend]")!.dataset.mode = mode;
  if ((mode === "points" || clusterDetailActive()) && Math.abs(map.getZoom() - pointSpreadZoom) >= 0.2) updatePointSources();
  if (mode === "network") statusCount.textContent = tr("map.networkStatus", { legends: formatter().format(filteredFeatures.length), places: formatter().format(similarityNodes.length), edges: formatter().format(similarityEdges.length) });
  else if (mode === "points") statusCount.textContent = tr("map.pointStatus", { mapped: formatter().format(filteredFeatures.length), unmapped: formatter().format(filteredUnmappedLegends.length) });
  else statusCount.textContent = tr("map.selectionCount", { count: formatter().format(filteredFeatures.length) });
  syncControls();
  if (mode === "clusters") renderPanel();
  if (save) updateUrl();
};
const applyTheme = (preserveMapPalette = false) => {
  if (!preserveMapPalette) colors = themeColors();
  mapStage.dataset.mapTheme = colors.dark ? "dark" : "light";
  page.style.setProperty("--map-palette-color", colors.green);
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
  paint("place-labels", "text-color", colors.muted);
  paint("place-labels", "text-halo-color", colors.halo);
  const corpusPointColor = ["coalesce", ["get", "categoryColor"], colors.green];
  const corpusLinkColor = ["coalesce", ["get", "categoryColor"], colors.green];
  paint("cluster-aura", "circle-color", colors.green);
  paint("cluster-aura", "circle-opacity", colors.dark ? 0.17 : 0.14);
  paint("cluster-ring", "circle-color", colors.green);
  paint("cluster-ring", "circle-opacity", colors.dark ? 0.035 : 0.025);
  paint("cluster-ring", "circle-stroke-color", colors.green);
  paint("cluster-ring", "circle-stroke-opacity", colors.dark ? 0.1 : 0.08);
  paint("clusters", "circle-color", colors.green);
  paint("clusters", "circle-opacity", colors.dark ? 0.2 : 0.16);
  paint("clusters", "circle-stroke-color", colors.green);
  paint("clusters", "circle-stroke-opacity", colors.dark ? 0.82 : 0.76);
  paint("cluster-hover", "circle-color", colors.green);
  paint("cluster-hover", "circle-opacity", colors.dark ? 0.2 : 0.16);
  paint("cluster-hover", "circle-stroke-color", colors.green);
  paint("cluster-hover", "circle-stroke-opacity", colors.dark ? 0.96 : 0.9);
  paint("cluster-count", "text-color", colors.dark ? "#eef3fb" : "#17243a");
  paint("cluster-count", "text-halo-color", colors.dark ? "rgba(7,13,28,.72)" : "rgba(255,255,255,.84)");
  paint("cluster-count", "text-halo-width", colors.dark ? 0.6 : 1.1);
  paint("points", "circle-color", ["case", ["boolean", ["feature-state", "selected"], false], corpusPointColor, colors.raised]);
  paint("points", "circle-opacity", ["case", ["boolean", ["feature-state", "selected"], false], colors.dark ? 0.62 : 0.52, 0]);
  paint("points", "circle-stroke-color", corpusPointColor);
  paint("points", "circle-radius", ["interpolate", ["linear"], ["zoom"], 5, 2.3, 8, 3, 11, 4.3]);
  paint("points", "circle-stroke-opacity", ["case", ["boolean", ["feature-state", "selected"], false], 0.98, 0]);
  paint("points", "circle-stroke-width", ["interpolate", ["linear"], ["zoom"], 5, ["case", ["boolean", ["feature-state", "selected"], false], 2, 0.9], 10, ["case", ["boolean", ["feature-state", "selected"], false], 2, 1.2]]);
  paint("point-end-bubbles", "circle-color", colors.land);
  paint("point-end-bubbles", "circle-radius", ["interpolate", ["linear"], ["zoom"], 5, ["case", ["boolean", ["feature-state", "hovered"], false], 3.8, ["boolean", ["feature-state", "selected"], false], 3.2, 2], 8, ["case", ["boolean", ["feature-state", "hovered"], false], 4.8, ["boolean", ["feature-state", "selected"], false], 4.2, 2.8], 11, ["case", ["boolean", ["feature-state", "hovered"], false], 6.2, ["boolean", ["feature-state", "selected"], false], 5.4, 3.8]]);
  pointBubbleOpacity = ["case", ["boolean", ["feature-state", "hovered"], false], colors.dark ? 0.72 : 0.2, ["boolean", ["feature-state", "selected"], false], colors.dark ? 0.62 : 0.14, colors.dark ? scalePointOpacity(pointColorBy === "single" ? 0.5 : 0.4) : 0];
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
  paint("point-place-selection-label", "text-color", css(colors.dark ? "--map-data-green-dark" : "--map-data-green-light"));
  paint("point-place-selection-label", "text-halo-color", colors.dark ? "rgba(7,13,28,.9)" : "rgba(255,255,255,.92)");
  paint("point-place-selection-label", "text-halo-width", colors.dark ? 3.2 : 3.6);
  paint("point-place-selection-label", "text-halo-blur", colors.dark ? 0.65 : 0.8);
  paint("point-place-cluster-count", "text-color", colors.dark ? "#eef8f5" : "#173b37");
  paint("point-place-cluster-count", "text-halo-color", colors.dark ? "rgba(7,13,28,.86)" : "rgba(255,255,255,.9)");
  paint("point-place-cluster-count", "text-halo-width", colors.dark ? 1.1 : 1.5);
  updatePointCenterSelection();
  paint("network", "line-color", colors.green);
  paint("network-halo", "line-color", colors.green);
  paint("network-nodes", "circle-color", ["get", "color"]);
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
  const heatmapRamp = [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(0,0,0,0)",
    0.08,
    mix(colors.heatLow, 0.14),
    0.3,
    mix(colors.heatLow, 0.68),
    0.58,
    colors.heatMid,
    0.76,
    colors.heatHigh,
    0.91,
    colors.heatHot,
    1,
    colors.heatPeak,
  ];
  paint("heatmap", "heatmap-color", heatmapRamp);
  paint("heatmap", "heatmap-opacity", [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    colors.dark ? 0.82 : 0.72,
    11,
    colors.dark ? 0.7 : 0.62,
  ]);
  if (similarityNodes.length) recalculateNetwork();
  pointSpreadZoom = -1;
  updatePointSources();
  syncPointStyleLayers();
  applyBasemapStyle();
};
const applyBasemapStyle = () => {
  if (!map.getLayer("land") || !map.getLayer("coast")) return;
  const style = basemapStyle.value,
    local = style === "minimal",
    geography = visible("geography") === "visible",
    labels = visible("labels") === "visible";
  for (const id of ["land", "coast", "lakes", "rivers", "territory-boundaries"])
    map.setLayoutProperty(id, "visibility", local && geography ? "visible" : "none");
  for (const id of ["city-dots", "city-labels", "place-labels"])
    map.setLayoutProperty(id, "visibility", local && labels ? "visible" : "none");
  for (const name of ["streets", "light", "dark"]) {
    map.setLayoutProperty(`carto-${name}`, "visibility", style === name && geography ? "visible" : "none");
    map.setLayoutProperty(`carto-${name}-labels`, "visibility", style === name && labels ? "visible" : "none");
  }
  map.setPaintProperty(
    "land",
    "fill-opacity",
    style === "minimal" ? 0.22 : 0.68,
  );
  map.setPaintProperty(
    "coast",
    "line-opacity",
    style === "minimal" ? 0.1 : 0.28,
  );
  map.setPaintProperty(
    "coast",
    "line-width",
    0.55,
  );
  map.setPaintProperty("territory-boundaries", "line-opacity", style === "minimal" ? 0.08 : 0.32);
  map.setPaintProperty("rivers", "line-opacity", style === "minimal" ? 0.08 : 0.3);
  map.setPaintProperty("lakes", "fill-opacity", style === "minimal" ? 0.16 : 0.72);
};
map.on("load", async () => {
  const region = await fetch(`${base}data/map/northern-europe.json`).then(
    (response) => response.json(),
  );
  const cartoAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    addCartoSource = (id: string, path: string) => map.addSource(id, { type: "raster", tiles: [`https://a.basemaps.cartocdn.com/${path}/{z}/{x}/{y}@2x.png`, `https://b.basemaps.cartocdn.com/${path}/{z}/{x}/{y}@2x.png`, `https://c.basemaps.cartocdn.com/${path}/{z}/{x}/{y}@2x.png`], tileSize: 256, attribution: cartoAttribution });
  addCartoSource("carto-streets", "rastertiles/voyager_nolabels");
  addCartoSource("carto-streets-labels", "rastertiles/voyager_only_labels");
  addCartoSource("carto-light", "light_nolabels");
  addCartoSource("carto-light-labels", "light_only_labels");
  addCartoSource("carto-dark", "dark_nolabels");
  addCartoSource("carto-dark-labels", "dark_only_labels");
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
      geometry: { type: "Point", coordinates: [23.45, 57.15] },
      properties: { id: "unmapped", count: filteredUnmappedLegends.length },
    },
  });
  for (const name of ["streets", "light", "dark"])
    map.addLayer({ id: `carto-${name}`, type: "raster", source: `carto-${name}`, layout: { visibility: "none" }, paint: { "raster-opacity": 0.92, "raster-fade-duration": 180 } });
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
  for (const name of ["streets", "light", "dark"])
    map.addLayer({ id: `carto-${name}-labels`, type: "raster", source: `carto-${name}-labels`, layout: { visibility: "none" }, paint: { "raster-opacity": 0.76, "raster-fade-duration": 180 } });
  map.addLayer({
    id: "heatmap",
    type: "heatmap",
    source: "legends",
    maxzoom: 12,
    layout: { visibility: "none" },
    paint: {
      "heatmap-weight": 0.1,
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
      "line-opacity": ["interpolate", ["linear"], ["get", "similarity"], 0.1, 0.025, 0.75, 0.11],
      "line-width": ["interpolate", ["linear"], ["get", "similarity"], 0.1, 2, 0.75, 6],
      "line-blur": 1.2,
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
        ["get", "similarity"],
        0.1,
        0.12,
        0.75,
        0.52,
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["get", "similarity"],
        0.1,
        0.65,
        0.75,
        2.6,
      ],
      "line-blur": 0.12,
    },
  });
  map.addLayer({
    id: "network-nodes",
    type: "circle",
    source: "network-nodes",
    layout: { visibility: visible("network") },
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "count"]], 2, 3, 17, 10],
      "circle-opacity": 0.82,
      "circle-stroke-color": colors.halo,
      "circle-stroke-opacity": 0.5,
      "circle-stroke-width": 0.8,
    },
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
      "circle-opacity": colors.dark ? 0.4 : 0.34,
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
      "circle-opacity": ["case", ["boolean", ["feature-state", "selected"], false], colors.dark ? 0.62 : 0.52, 0],
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
      "text-size": ["interpolate", ["linear"], ["zoom"], 5, 12.5, 9, 13.5, 13, 14.5],
      "text-anchor": "bottom",
      "text-offset": [0, -1.55],
      "text-letter-spacing": 0.015,
      "text-padding": 4,
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": css(colors.dark ? "--map-data-green-dark" : "--map-data-green-light"),
      "text-halo-color": colors.dark ? "rgba(7,13,28,.9)" : "rgba(255,255,255,.92)",
      "text-halo-width": colors.dark ? 3.2 : 3.6,
      "text-halo-blur": colors.dark ? 0.65 : 0.8,
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
      "text-size": 11,
      "text-max-width": 9,
    },
    paint: {
      "text-color": colors.muted,
      "text-halo-color": colors.halo,
      "text-halo-width": 1.2,
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
  if (centerKey) showPointLinks(centerKey);
});
map.on("mouseleave", "point-place-hit", () => selectedPointLegend ? showPointLegendLink(selectedPointLegend, true) : showPointLinks(selectedPointCenter, Boolean(selectedPointCenter)));
container.addEventListener("mouseleave", () => {
  setHoveredPointLegendState(null);
  selectedPointLegend ? showPointLegendLink(selectedPointLegend, true) : showPointLinks(selectedPointCenter, Boolean(selectedPointCenter));
});
map.on("click", "unmapped", renderUnmapped);
map.on("mouseenter", "unmapped", () => map.setFeatureState({ source: "unmapped", id: "unmapped" }, { hovered: true }));
map.on("mouseleave", "unmapped", () => map.setFeatureState({ source: "unmapped", id: "unmapped" }, { hovered: false }));
map.on("mouseenter", "network-nodes", (event) => {
  const properties = event.features?.[0]?.properties as { id?: string } | undefined, node = similarityNodes.find((item) => item.id === properties?.id);
  if (!node) return;
  hoveredNetworkNode = node.id;
  applyNetworkFocus(node.id);
  const related = similarityEdges.filter((edge) => edge.fromId === node.id || edge.toId === node.id).length;
  networkTooltip.hidden = false;
  networkTooltip.innerHTML = `<strong>${node.name}</strong><span>${tr("map.networkLegendCount", { count: formatter().format(node.count) })}</span><span>${tr("map.networkPlotCount", { count: formatter().format(node.plotCount) })}</span><span>${tr("map.networkRelatedCount", { count: formatter().format(related) })}</span>`;
});
map.on("mousemove", "network-nodes", (event) => {
  networkTooltip.style.left = `${event.point.x + 14}px`;
  networkTooltip.style.top = `${event.point.y + 14}px`;
});
map.on("mouseleave", "network-nodes", () => {
  hoveredNetworkNode = null;
  unmappedSelected = false;
  map.setFeatureState({ source: "unmapped", id: "unmapped" }, { selected: false, hovered: false });
  networkTooltip.hidden = true;
  applyNetworkFocus(activeNetworkNode);
});
map.on("click", "network-nodes", (event) => {
  const id = String(event.features?.[0]?.properties?.id || "");
  if (id) renderNetworkNodePanel(id);
});
map.on("click", "network", (event) => {
  if (map.queryRenderedFeatures(event.point, { layers: ["network-nodes"] }).length) return;
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
  networkTooltip.hidden = true;
  renderPanel();
  updateUrl();
};
map.on("click", (event) => {
  const interactiveLayers = ["points-hit", "point-links-hit", "point-place-hit", "clusters", "heatmap", "unmapped", "network-nodes", "network"]
    .filter((layer) => map.getLayer(layer));
  if (interactiveLayers.length && map.queryRenderedFeatures(event.point, { layers: interactiveLayers }).length) return;
  clearMapSelection();
});
for (const layer of ["points-hit", "point-links-hit", "point-place-hit", "clusters", "unmapped", "network-nodes", "network"]) {
  map.on(
    "mouseenter",
    layer,
    () => (map.getCanvas().style.cursor = "pointer"),
  );
  map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
}
const syncNetworkChoices = () => {
  networkToolbar.querySelectorAll<HTMLDetailsElement>("[data-network-choice]").forEach((choice) => {
    const select = choice.querySelector<HTMLSelectElement>("select")!, selected = choice.querySelector<HTMLButtonElement>(`[data-network-value="${select.value}"]`)!, label = choice.querySelector<HTMLElement>("[data-network-choice-label]")!;
    const translationKey = selected.dataset.i18n!;
    label.dataset.i18n = translationKey;
    label.textContent = tr(translationKey);
    choice.querySelectorAll<HTMLButtonElement>("[data-network-value]").forEach((button) => button.setAttribute("aria-pressed", String(button === selected)));
  });
};
const syncControls = () => {
  heatControls.hidden = mapMode !== "heatmap";
  heatKey.hidden = mapMode !== "heatmap";
  networkToolbar.hidden = mapMode !== "network";
  networkKey.hidden = mapMode !== "network";
  syncNetworkChoices();
};
page.querySelectorAll<HTMLInputElement>("[data-layer]").forEach((input) =>
  input.addEventListener("change", () => {
    const name = input.dataset.layer!,
      visibility = input.checked ? "visible" : "none",
      ids =
        name === "labels"
          ? ["city-dots", "city-labels", "place-labels", "carto-streets-labels", "carto-light-labels", "carto-dark-labels"]
          : name === "geography"
            ? ["land", "coast", "lakes", "rivers", "territory-boundaries", "carto-streets", "carto-light", "carto-dark"]
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
networkType.addEventListener("change", () => {
  recalculateNetwork();
  syncControls();
  updateUrl();
});
networkDensity.addEventListener("input", () => { recalculateNetwork(); updateUrl(); });
networkColor.addEventListener("change", () => { recalculateNetwork(); updateUrl(); });
networkFocus.addEventListener("change", () => {
  applyNetworkFocus(activeNetworkNode);
  if (networkFocus.value === "related" && activeNetworkNode) {
    const bounds = new maplibregl.LngLatBounds();
    relatedNodeIds(activeNetworkNode).forEach((id) => {
      const node = similarityNodes.find((item) => item.id === id);
      if (node) bounds.extend(node.coordinates);
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 90, maxZoom: 8, duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500 });
  }
  updateUrl();
});
networkCompare.addEventListener("click", () => renderComparison());
page.querySelector<HTMLButtonElement>("[data-network-method]")!.addEventListener("click", () => {
  panel.hidden = false;
  panel.innerHTML = `<button class="map-panel-close" type="button" aria-label="${tr("map.close")}"><i data-lucide="x"></i></button><h2>${tr("map.networkMethodTitle")}</h2><p class="map-panel-note">${tr("map.networkMethodExplanation")}</p><p class="map-panel-note">${tr("map.networkMethodDetails")}</p>`;
  panel.querySelector("button")?.addEventListener("click", () => { panel.hidden = true; });
  (window as any).renderLucideIcons?.();
});
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
  pointPalette = input.value;
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
  const query = input.value.toLocaleLowerCase("lv").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  input.closest<HTMLElement>("[data-map-filter]")!.querySelectorAll<HTMLElement>(".multi-options label").forEach((label) => {
    const value = (label.textContent || "").toLocaleLowerCase("lv").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
  filterCollapse.title = label;
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
  const rows = filteredFeatures.map((feature) => feature.properties);
  const csv = ["id,place,year,theme,narrator,collector,volume", ...rows.map((row) => [row.id, row.placeName, row.year || "", row.themeLv, row.narrator, row.collector, row.volume].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
  const xml = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const graphml = `<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="name" for="node" attr.name="name" attr.type="string"/><key id="latitude" for="node" attr.name="latitude" attr.type="double"/><key id="longitude" for="node" attr.name="longitude" attr.type="double"/><key id="records" for="node" attr.name="record_count" attr.type="int"/><key id="theme" for="node" attr.name="dominant_theme" attr.type="string"/><key id="themes" for="node" attr.name="theme_count" attr.type="int"/><key id="similarity" for="edge" attr.name="similarity" attr.type="double"/><key id="shared" for="edge" attr.name="shared_themes" attr.type="int"/><key id="strongest" for="edge" attr.name="strongest_shared_themes" attr.type="string"/><graph id="teikas" edgedefault="undirected">${similarityNodes.map((node) => `<node id="${xml(node.id)}"><data key="name">${xml(node.name)}</data><data key="latitude">${node.coordinates[1]}</data><data key="longitude">${node.coordinates[0]}</data><data key="records">${node.count}</data><data key="theme">${xml(node.dominantTheme)}</data><data key="themes">${node.plotCount}</data></node>`).join("")}${similarityEdges.map((edge) => `<edge id="${xml(edge.id)}" source="${xml(edge.fromId)}" target="${xml(edge.toId)}"><data key="similarity">${edge.similarity}</data><data key="shared">${edge.sharedCount}</data><data key="strongest">${xml(edge.strongest.map((item) => item.plot).join(" · "))}</data></edge>`).join("")}</graph></graphml>`;
  const content = format === "csv" ? csv : format === "graphml" ? graphml : JSON.stringify(mapMode === "network" ? { nodes: graphCollections().nodes, edges: graphCollections().edges } : { type: "FeatureCollection", features: filteredFeatures }, null, 2),
    blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : format === "graphml" ? "application/graphml+xml;charset=utf-8" : "application/geo+json" }),
    link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `teikas-atlase.${format}`;
  link.click();
  URL.revokeObjectURL(link.href);
};
page.querySelectorAll<HTMLButtonElement>("[data-map-export]").forEach((button) => button.addEventListener("click", () => exportSelection(button.dataset.mapExport as "csv" | "geojson" | "graphml")));
page.querySelector<HTMLButtonElement>("[data-map-empty-clear]")!.addEventListener("click", () => filterClear.click());
map.on("moveend", () => {
  window.clearTimeout(moveTimer);
  moveTimer = window.setTimeout(() => {
    const pointDetailVisible = mapMode === "points" || clusterDetailActive();
    if (pointDetailVisible && Math.abs(map.getZoom() - pointSpreadZoom) >= 0.2) updatePointSources();
    if (clusterDetailRendered !== clusterDetailActive()) {
      clusterDetailRendered = clusterDetailActive();
      applyTheme(true);
    }
    syncPointStyleLayers();
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
      basemapStyle.value = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      syncBasemapMenu();
    }
    applyTheme(basemapExplicit);
  }
}).observe(document.documentElement, { attributes: true });
const translate = () => {
  const centerMapLabel = tr("map.resetExtent");
  centerMapButton.setAttribute("aria-label", centerMapLabel);
  centerMapButton.title = centerMapLabel;
  syncFilterCollapseLabel();
  filterPanel.querySelectorAll<HTMLElement>("[data-unknown-person-type]").forEach((label) => {
    const key = label.dataset.unknownPersonType as keyof typeof unknownPersonKey;
    label.textContent = tr(unknownPersonKey[key]);
  });
  syncPointStyleText();
  updateCount();
  syncControls();
  syncFilterInterface();
  requestAnimationFrame(syncBasemapMenu);
  const language = document.documentElement.dataset.uiLang;
  filterPanel.querySelectorAll<HTMLElement>("[data-theme-lv]").forEach((option) => option.textContent = language === "de" ? option.dataset.themeDe! : option.dataset.themeLv!);
  if (selectedId) {
    if ((mapMode === "points" || clusterDetailActive()) && selectedPointCenter) renderPointPlace(selectedId, selectedPointCenter);
    else {
      const feature = dataset.places.features.find(
        (item) => item.properties.id === selectedId,
      );
      renderPanel(feature?.properties);
    }
  } else if (unmappedSelected) renderUnmapped();
};
window.addEventListener("ui-language-change", translate);
heatOutput.value = `${heatInput.value}%`;
radiusOutput.value = heatRadius.value;
