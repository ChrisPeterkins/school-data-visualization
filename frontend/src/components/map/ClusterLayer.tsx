import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { MapPoint } from '../../services/api';

export interface ClusterLayerProps {
  points: MapPoint[];
  /** Value used for cluster averaging and dot color; null means "no result". */
  valueOf: (p: MapPoint) => number | null;
  colorOf: (p: MapPoint) => string;
  /** Color for a cluster given the mean of its members' values. */
  clusterColorOf: (mean: number | null) => string;
  radiusOf: (p: MapPoint) => number;
  selectedId: number | null;
  highlightedId: number | null;
  onSelect: (id: number) => void;
  /** Below this zoom dots are grouped into clusters. */
  disableClusteringAtZoom?: number;
}

/**
 * Imperative Leaflet marker-cluster layer. Markers are canvas circle markers
 * created once per data change; selection and hover highlights only restyle.
 */
export default function ClusterLayer({
  points, valueOf, colorOf, clusterColorOf, radiusOf, selectedId, highlightedId, onSelect, disableClusteringAtZoom = 11,
}: ClusterLayerProps) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<number, L.CircleMarker>>(new Map());
  const stylesRef = useRef<Map<number, L.PathOptions>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // One cluster group for the lifetime of the map.
  useEffect(() => {
    const group = L.markerClusterGroup({
      disableClusteringAtZoom,
      maxClusterRadius: 44,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      iconCreateFunction: (cluster) => {
        const members = cluster.getAllChildMarkers() as unknown as L.CircleMarker[];
        const values = members.map((m) => (m.options as any).schoolValue as number | null).filter((v): v is number => v != null);
        const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
        const count = cluster.getChildCount();
        const size = count >= 500 ? 46 : count >= 100 ? 40 : count >= 20 ? 34 : 28;
        return L.divIcon({
          html: `<div style="background:${clusterColorOf(mean)}" title="${count} schools${mean != null ? `, average ${mean.toFixed(1)}` : ''}">${count}</div>`,
          className: 'school-cluster',
          iconSize: L.point(size, size),
        });
      },
    });
    group.addTo(map);
    groupRef.current = group;
    return () => { group.remove(); groupRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, disableClusteringAtZoom]);

  // Rebuild markers when the data or styling inputs change.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    markersRef.current.clear();
    stylesRef.current.clear();
    const layers: L.CircleMarker[] = [];
    for (const p of points) {
      const value = valueOf(p);
      const style: L.PathOptions = {
        color: value == null ? '#d6d3d1' : '#1b2a4a',
        weight: value == null ? 0.5 : 0.8,
        fillColor: colorOf(p),
        fillOpacity: value == null ? 0.45 : 0.9,
      };
      const marker = L.circleMarker([p.lat, p.lng], { ...style, radius: radiusOf(p), schoolValue: value } as any);
      marker.bindTooltip(p.name, { direction: 'top', offset: L.point(0, -radiusOf(p)) });
      marker.on('click', () => onSelectRef.current(p.id));
      markersRef.current.set(p.id, marker);
      stylesRef.current.set(p.id, style);
      layers.push(marker);
    }
    group.addLayers(layers);
    // Refresh cluster icons so their colors follow the new values.
    group.refreshClusters();
  }, [points, valueOf, colorOf, radiusOf]);

  // Selected and hovered dots get a heavier outline; everything else keeps its base style.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const base = stylesRef.current.get(id)!;
      if (id === selectedId) marker.setStyle({ ...base, color: '#d4aa3c', weight: 3, fillOpacity: 1 });
      else if (id === highlightedId) marker.setStyle({ ...base, color: '#1b2a4a', weight: 2.5, fillOpacity: 1 });
      else marker.setStyle(base);
      if (id === selectedId || id === highlightedId) marker.bringToFront();
    }
  }, [selectedId, highlightedId, points]);

  return null;
}
