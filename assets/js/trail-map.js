(function () {
  'use strict';

  // Wait for both the DOM and MapLibre to be ready
  function init() {
    var el = document.getElementById('trail-map');
    if (!el || typeof maplibregl === 'undefined') return;

    var gpxUrl = el.dataset.gpx;
    var lat    = parseFloat(el.dataset.lat);
    var lng    = parseFloat(el.dataset.lng);

    var map = new maplibregl.Map({
      container: 'trail-map',
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          topo: {
            type: 'raster',
            tiles: [
              'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 16,
            attribution: 'USGS National Map'
          }
        },
        layers: [{ id: 'topo', type: 'raster', source: 'topo' }]
      },
      center: [lng, lat],
      zoom: 13,
      attributionControl: { compact: true }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    // Trailhead marker — shown immediately, before GPX loads
    new maplibregl.Marker({ color: '#2D5A20' })
      .setLngLat([lng, lat])
      .addTo(map);

    if (!gpxUrl) return;

    map.on('load', function () {
      fetch(gpxUrl)
        .then(function (res) {
          if (!res.ok) throw new Error('GPX fetch failed');
          return res.text();
        })
        .then(function (text) {
          var coords = parseGpx(text);
          if (coords.length < 2) return;

          map.addSource('track', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: coords },
              properties: {}
            }
          });

          // Subtle casing for contrast on topo tiles
          map.addLayer({
            id: 'track-casing',
            type: 'line',
            source: 'track',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.6 }
          });

          map.addLayer({
            id: 'track-line',
            type: 'line',
            source: 'track',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#2D5A20', 'line-width': 3.5, 'line-opacity': 0.95 }
          });

          // Fit map to track bounds
          var bounds = coords.reduce(function (b, c) {
            return b.extend(c);
          }, new maplibregl.LngLatBounds(coords[0], coords[0]));

          map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
        })
        .catch(function () {
          // GPX unavailable — map still shows trailhead marker
        });
    });
  }

  // Minimal GPX → [[lng, lat], …] parser
  function parseGpx(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    var pts = doc.querySelectorAll('trkpt');
    if (!pts.length) pts = doc.querySelectorAll('rtept'); // route points fallback
    return Array.from(pts).map(function (pt) {
      return [parseFloat(pt.getAttribute('lon')), parseFloat(pt.getAttribute('lat'))];
    }).filter(function (c) {
      return !isNaN(c[0]) && !isNaN(c[1]);
    });
  }

  // MapLibre is loaded with defer; poll until it's available
  if (typeof maplibregl !== 'undefined') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      var attempts = 0;
      var interval = setInterval(function () {
        if (typeof maplibregl !== 'undefined') {
          clearInterval(interval);
          init();
        } else if (++attempts > 20) {
          clearInterval(interval);
        }
      }, 100);
    });
  }
}());
