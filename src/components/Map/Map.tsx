import { effect } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, LineString } from 'geojson';
import { COLORS, TILE_STYLE } from '../../constants.ts';
import {
  currentPosition,
  historic2021AtElapsed,
  historic2022AtElapsed,
  route,
} from '../../state/projection.ts';
import { historic } from '../../state/signals.ts';
import {
  flyRequestId,
  flyTarget,
  readViewport,
  writeViewport,
} from '../../state/viewport.ts';
import type { YearTrack } from '../../types.ts';
import styles from './Map.module.css';

function yearLineString(year: YearTrack): Feature<LineString> {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: year.points.map((p) => [p.lon, p.lat]),
    },
    properties: { kind: 'historic', year: year.year },
  };
}

function routeBounds(): LngLatBoundsLike {
  const lineFeature = route.geojson.features.find((f) => f.geometry.type === 'LineString');
  if (!lineFeature || lineFeature.geometry.type !== 'LineString') {
    return [
      [route.midLon - 0.3, route.midLat - 0.3],
      [route.midLon + 0.3, route.midLat + 0.3],
    ];
  }
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of lineFeature.geometry.coordinates) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

function makeDot(className: string, color: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  if (color) el.style.background = color;
  return el;
}

export function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const stored = readViewport();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: stored ? [stored.lon, stored.lat] : [route.midLon, route.midLat],
      zoom: stored ? stored.zoom : 9,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      rollEnabled: false,
      touchZoomRotate: true,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();

    const onMoveEnd = () => {
      const c = map.getCenter();
      writeViewport({ lat: c.lat, lon: c.lng, zoom: map.getZoom() });
    };
    map.on('moveend', onMoveEnd);

    const userMarker = new maplibregl.Marker({ element: makeDot(styles.userMarker, '') });
    const marker21 = new maplibregl.Marker({
      element: makeDot(styles.historicMarker, COLORS.y2021),
    });
    const marker22 = new maplibregl.Marker({
      element: makeDot(styles.historicMarker, COLORS.y2022),
    });

    const disposers: Array<() => void> = [];

    map.on('load', () => {
      map.addSource('historic-2021', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'historic-2021-line',
        type: 'line',
        source: 'historic-2021',
        paint: { 'line-color': COLORS.y2021, 'line-width': 3, 'line-opacity': 0.85 },
      });

      map.addSource('historic-2022', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'historic-2022-line',
        type: 'line',
        source: 'historic-2022',
        paint: { 'line-color': COLORS.y2022, 'line-width': 3, 'line-opacity': 0.85 },
      });

      map.addSource('route-2026', { type: 'geojson', data: route.geojson });
      map.addLayer({
        id: 'route-2026-line',
        type: 'line',
        source: 'route-2026',
        filter: ['==', ['get', 'kind'], 'route'],
        paint: {
          'line-color': COLORS.y2026,
          'line-width': 5,
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'route-2026-waypoint-dot',
        type: 'circle',
        source: 'route-2026',
        filter: ['==', ['get', 'kind'], 'waypoint'],
        paint: {
          'circle-radius': 7,
          'circle-color': '#ffffff',
          'circle-stroke-color': COLORS.y2026,
          'circle-stroke-width': 2,
        },
      });

      const waypointPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: true,
        offset: 12,
      });

      map.on('click', 'route-2026-waypoint-dot', (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') return;
        const [lon, lat] = feature.geometry.coordinates as [number, number];
        const name = (feature.properties?.name as string | undefined) ?? '';
        waypointPopup
          .setLngLat([lon, lat])
          .setText(name)
          .addTo(map);
      });
      map.on('mouseenter', 'route-2026-waypoint-dot', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'route-2026-waypoint-dot', () => {
        map.getCanvas().style.cursor = '';
      });
      disposers.push(() => waypointPopup.remove());

      if (!stored) {
        const overlayEl = document.querySelector<HTMLElement>('[data-overlay]');
        const bottomPad = overlayEl ? Math.ceil(overlayEl.getBoundingClientRect().height) + 20 : 40;
        map.fitBounds(routeBounds(), {
          padding: { top: 40, right: 40, bottom: bottomPad, left: 40 },
          duration: 0,
        });
      }

      disposers.push(
        effect(() => {
          const data = historic.value;
          const src21 = map.getSource('historic-2021') as maplibregl.GeoJSONSource | undefined;
          const src22 = map.getSource('historic-2022') as maplibregl.GeoJSONSource | undefined;
          if (!data || !src21 || !src22) return;
          src21.setData({ type: 'FeatureCollection', features: [yearLineString(data.y21)] });
          src22.setData({ type: 'FeatureCollection', features: [yearLineString(data.y22)] });
        }),
        effect(() => {
          const p = currentPosition.value;
          if (!p) {
            userMarker.remove();
            return;
          }
          userMarker.setLngLat([p.lon, p.lat]).addTo(map);
        }),
        effect(() => {
          const h = historic2021AtElapsed.value;
          if (!h) {
            marker21.remove();
            return;
          }
          marker21.setLngLat([h.lon, h.lat]).addTo(map);
        }),
        effect(() => {
          const h = historic2022AtElapsed.value;
          if (!h) {
            marker22.remove();
            return;
          }
          marker22.setLngLat([h.lon, h.lat]).addTo(map);
        }),
        effect(() => {
          // Subscribe to the bump so each request re-fires even with the same target.
          flyRequestId.value;
          const t = flyTarget.peek();
          if (!t) return;
          map.flyTo({
            center: [t.lon, t.lat],
            zoom: t.zoom ?? Math.max(map.getZoom(), 14),
            duration: 800,
            essential: true,
          });
        }),
      );
    });

    return () => {
      for (const dispose of disposers) dispose();
      map.off('moveend', onMoveEnd);
      userMarker.remove();
      marker21.remove();
      marker22.remove();
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className={`${styles.container} ${styles.maplibre}`} />;
}
