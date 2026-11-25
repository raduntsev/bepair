'use client';

import { useEffect, useRef } from 'react';
import type { Circle, Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { isStale, TILE_ATTRIBUTION_HTML, TILE_ATTRIBUTION_TEXT, TILE_MAX_ZOOM, TILE_URL, type Point } from '@/lib/location';
import { tr } from '@/lib/i18n';

/*
  Two dots on a quiet map: you in the accent, your partner in theirs. Leaflet
  touches `window` when it loads, so it is imported inside the effect, on the
  client only. The map is drawn once; new points move the dots, and the view
  follows only until the person pans it themselves.

  `preview` is the profile's card, drawn like the «Карта» widget: a still
  picture inside a link — no gestures, no button, the attribution as plain text
  in the top corner (a link inside a link is not allowed), and room left at the
  bottom for the caption laid over it.
*/

interface Who {
  point: Point | null;
  initial: string;
  label: string;
}

function darkTheme() {
  const set = document.documentElement.dataset.theme;
  if (set === 'dark') return true;
  if (set === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function pinHtml(initial: string, who: 'me' | 'partner', stale: boolean) {
  const safe = initial.replace(/[<>&"']/g, '');
  return `<span class="pair-pin pair-pin--${who}${stale ? ' pair-pin--stale' : ''}">${safe}</span>`;
}

export function PairMap({ me, partner, className = '', preview = false }: { me: Who; partner: Who; className?: string; preview?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const layers = useRef<{ me?: Marker; partner?: Marker; ring?: Circle }>({});
  /* Once the person moves the map, new points stop pulling the view back. */
  const touched = useRef(false);

  const fit = (animate: boolean) => {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    const points = [me.point, partner.point].filter(Boolean) as Point[];
    if (points.length === 0) return;
    /* In the preview a lone dot sits a little above the middle, clear of the caption. */
    if (points.length === 1) {
      m.setView([points[0].lat, points[0].lng], 15, { animate: animate && !preview });
      if (preview) m.panBy([0, 36], { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (preview) m.fitBounds(bounds, { paddingTopLeft: [40, 40], paddingBottomRight: [40, 88], maxZoom: 16, animate });
    else m.fitBounds(bounds, { padding: [56, 56], maxZoom: 16, animate });
  };

  const draw = () => {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    const place = (key: 'me' | 'partner', who: Who) => {
      const existing = layers.current[key];
      if (!who.point) {
        existing?.remove();
        delete layers.current[key];
        return;
      }
      const icon = L.divIcon({
        html: pinHtml(who.initial, key, key === 'partner' && isStale(who.point.recorded_at)),
        className: 'pair-pin-wrap',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const at: [number, number] = [who.point.lat, who.point.lng];
      if (existing) existing.setLatLng(at).setIcon(icon);
      else layers.current[key] = L.marker(at, { icon, title: who.label, keyboard: false, zIndexOffset: key === 'partner' ? 10 : 0 }).addTo(m);
    };
    place('me', me);
    place('partner', partner);

    /* How sure the partner's phone is, when it is not sure: a soft ring, not a pin. */
    layers.current.ring?.remove();
    delete layers.current.ring;
    const accuracy = partner.point?.accuracy ?? 0;
    if (partner.point && accuracy > 60) {
      layers.current.ring = L.circle([partner.point.lat, partner.point.lng], {
        radius: accuracy,
        stroke: false,
        className: 'pair-ring',
        interactive: false,
      }).addTo(m);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !box.current || map.current) return;
      leaflet.current = L;
      const still = preview
        ? { dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false }
        : {};
      const m = L.map(box.current, { zoomControl: false, attributionControl: true, worldCopyJump: true, ...still });
      m.attributionControl.setPrefix(false);
      if (preview) m.attributionControl.setPosition('topright');
      L.tileLayer(TILE_URL, {
        maxZoom: TILE_MAX_ZOOM,
        attribution: preview ? TILE_ATTRIBUTION_TEXT : TILE_ATTRIBUTION_HTML,
        className: darkTheme() ? 'pair-tiles pair-tiles--dark' : 'pair-tiles',
      }).addTo(m);
      /* Only the person's own gestures count, not fitBounds. */
      const touch = () => {
        touched.current = true;
      };
      m.on('dragstart', touch);
      box.current.addEventListener('wheel', touch, { passive: true });
      box.current.addEventListener('touchstart', (event) => event.touches.length > 1 && touch(), { passive: true });
      map.current = m;
      draw();
      fit(false);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layers.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    draw();
    if (!touched.current) fit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.point?.lat, me.point?.lng, partner.point?.lat, partner.point?.lng, partner.point?.recorded_at, me.initial, partner.initial]);

  if (preview) {
    return (
      <div className={`isolate overflow-hidden bg-sunken ${className || 'relative'}`}>
        <div ref={box} className="pair-map pointer-events-none absolute inset-0" aria-hidden />
      </div>
    );
  }

  return (
    <div className={`relative isolate overflow-hidden rounded-2xl bg-sunken shadow-card ${className}`}>
      <div ref={box} className="pair-map absolute inset-0" role="img" aria-label={tr('Карта: вы и партнёр', 'Map: you and your partner')} />
      <button
        type="button"
        onClick={() => {
          touched.current = false;
          fit(true);
        }}
        aria-label={tr('Показать обоих', 'Show you both')}
        className="tap absolute top-3 right-3 z-[500] flex size-11 items-center justify-center rounded-xl bg-surface text-ink shadow-card transition-colors hover:bg-sunken"
      >
        <LocateFixed className="size-5" aria-hidden />
      </button>
    </div>
  );
}
