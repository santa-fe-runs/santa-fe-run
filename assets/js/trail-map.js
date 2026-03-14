(function () {
  'use strict';

  var LS_KEY = 'trail-map-style';

  var STYLES = [
    {
      key: 'opentopomap',
      label: 'Topo',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: '© <a href="https://opentopomap.org/">OpenTopoMap</a> (CC-BY-SA) © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    {
      key: 'usgs',
      label: 'USGS',
      tiles: [
        'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution: '<a href="https://www.usgs.gov/">USGS</a> National Map'
    },
    {
      key: 'esri-topo',
      label: 'Esri',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, HERE, Garmin, FAO, NOAA, USGS'
    },
    {
      key: 'thunderforest-outdoors',
      label: 'Outdoors',
      tiles: [
        'https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=d1c0c4338095437ba3979753df777653'
      ],
      tileSize: 256,
      maxzoom: 22,
      attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    {
      key: 'carto-voyager',
      label: 'Voyager',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  ];

  function savedStyle() {
    try { return localStorage.getItem(LS_KEY) || 'opentopomap'; } catch (e) { return 'opentopomap'; }
  }

  function styleById(key) {
    for (var i = 0; i < STYLES.length; i++) {
      if (STYLES[i].key === key) return STYLES[i];
    }
    return STYLES[0];
  }

  function swapBasemap(map, style) {
    if (map.getLayer('topo')) map.removeLayer('topo');
    if (map.getSource('topo')) map.removeSource('topo');
    map.addSource('topo', {
      type: 'raster',
      tiles: style.tiles,
      tileSize: style.tileSize,
      maxzoom: style.maxzoom,
      attribution: style.attribution
    });
    var before = map.getLayer('track-line') ? 'track-line' : undefined;
    map.addLayer({ id: 'topo', type: 'raster', source: 'topo' }, before);
  }

  function createStylePickerControl(map) {
    var container;
    return {
      onAdd: function () {
        container = document.createElement('div');
        container.className = 'maplibregl-ctrl map-style-picker';
        var active = savedStyle();
        STYLES.forEach(function (style) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'map-style-chip' + (style.key === active ? ' active' : '');
          btn.textContent = style.label;
          btn.setAttribute('aria-pressed', style.key === active ? 'true' : 'false');
          btn.addEventListener('click', function () {
            container.querySelectorAll('.map-style-chip').forEach(function (c) {
              c.classList.remove('active');
              c.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            try { localStorage.setItem(LS_KEY, style.key); } catch (e) {}
            if (map.isStyleLoaded()) {
              swapBasemap(map, style);
            } else {
              map.once('load', function () { swapBasemap(map, style); });
            }
          });
          container.appendChild(btn);
        });
        return container;
      },
      onRemove: function () {
        if (container && container.parentNode) container.parentNode.removeChild(container);
      }
    };
  }

  // Wait for both the DOM and MapLibre to be ready
  function init() {
    var el = document.getElementById('trail-map');
    if (!el || typeof maplibregl === 'undefined') return;

    var gpxUrl = el.dataset.gpx;
    var lat    = parseFloat(el.dataset.lat);
    var lng    = parseFloat(el.dataset.lng);

    var initialStyle = styleById(savedStyle());

    var map = new maplibregl.Map({
      container: 'trail-map',
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          topo: {
            type: 'raster',
            tiles: initialStyle.tiles,
            tileSize: initialStyle.tileSize,
            maxzoom: initialStyle.maxzoom,
            attribution: initialStyle.attribution
          }
        },
        layers: [{ id: 'topo', type: 'raster', source: 'topo' }]
      },
      center: [lng, lat],
      zoom: 13,
      attributionControl: { compact: true }
    });

    map.addControl(createStylePickerControl(map), 'top-left');
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
