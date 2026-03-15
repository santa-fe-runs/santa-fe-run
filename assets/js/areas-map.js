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
      key: 'maptiler-topo',
      label: 'MapTiler',
      tiles: [
        'https://api.maptiler.com/maps/topo-v4/{z}/{x}/{y}.png?key=pOs2tpJTbZMN95OeELuo'
      ],
      tileSize: 256,
      maxzoom: 22,
      attribution: '© <a href="https://www.maptiler.com/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  ];

  function savedStyle() {
    try { return localStorage.getItem(LS_KEY) || 'maptiler-topo'; } catch (e) { return 'maptiler-topo'; }
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
    var layers = map.getStyle().layers;
    var firstOverlay = null;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].id !== 'topo') { firstOverlay = layers[i].id; break; }
    }
    map.addLayer({ id: 'topo', type: 'raster', source: 'topo' }, firstOverlay || undefined);
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
              map.once('idle', function () { swapBasemap(map, style); });
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

  // ── Active area state ─────────────────────────────────────────────────────

  var activeAreaId = null;

  function setMapHighlight(map, areaId) {
    if (!map.getLayer('areas-fill')) return;
    map.setPaintProperty('areas-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'id'], areaId || ''], 0.35,
      0.12
    ]);
    map.setPaintProperty('areas-line', 'line-color', [
      'case',
      ['==', ['get', 'id'], areaId || ''], '#1B3A14',
      '#4a7c3a'
    ]);
    map.setPaintProperty('areas-line', 'line-width', [
      'case',
      ['==', ['get', 'id'], areaId || ''], 3,
      1.5
    ]);
  }

  function selectArea(map, areaId, areas, fromCard) {
    if (activeAreaId === areaId) return;
    activeAreaId = areaId;

    // Highlight card
    document.querySelectorAll('.area-card').forEach(function (card) {
      card.classList.toggle('is-active', card.dataset.areaId === areaId);
    });

    // Scroll card into view (center it in the carousel)
    if (!fromCard) {
      var targetCard = document.querySelector('.area-card[data-area-id="' + areaId + '"]');
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }

    // Update map highlight
    setMapHighlight(map, areaId);

    // Fly to area center
    var area = null;
    for (var i = 0; i < areas.length; i++) {
      if (areas[i].id === areaId) { area = areas[i]; break; }
    }
    if (area && area.center) {
      map.flyTo({
        center: [area.center.lng, area.center.lat],
        zoom: 10,
        duration: 600,
        essential: true
      });
    }
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  function init() {
    var mapEl = document.getElementById('areas-map');
    if (!mapEl || typeof maplibregl === 'undefined') return;

    // Areas data is JSON-encoded in the data attribute
    var areasRaw = mapEl.dataset.areas;
    var areas = [];
    try { areas = JSON.parse(decodeURIComponent(areasRaw)); } catch (e) { return; }

    var initialStyle = styleById(savedStyle());

    var map = new maplibregl.Map({
      container: 'areas-map',
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
      center: [-105.95, 35.75],
      zoom: 9,
      attributionControl: { compact: true }
    });

    map.addControl(createStylePickerControl(map), 'top-left');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    // ── Load all GeoJSON files ──
    map.on('load', function () {
      var fetches = areas.map(function (area) {
        return fetch(area.geojson)
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch ' + area.geojson);
            return res.json();
          })
          .then(function (geojson) {
            // Tag each feature with the area id
            if (geojson.features) {
              geojson.features.forEach(function (f) {
                f.properties = f.properties || {};
                f.properties.id = area.id;
                f.properties.name = area.name;
              });
            }
            return geojson;
          });
      });

      Promise.all(fetches)
        .then(function (geojsons) {
          // Combine into a single FeatureCollection
          var combined = {
            type: 'FeatureCollection',
            features: []
          };
          geojsons.forEach(function (fc) {
            if (fc && fc.features) {
              combined.features = combined.features.concat(fc.features);
            }
          });

          map.addSource('areas', {
            type: 'geojson',
            data: combined
          });

          // Fill layer
          map.addLayer({
            id: 'areas-fill',
            type: 'fill',
            source: 'areas',
            paint: {
              'fill-color': '#2D5A20',
              'fill-opacity': 0.12
            }
          });

          // Outline layer
          map.addLayer({
            id: 'areas-line',
            type: 'line',
            source: 'areas',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#4a7c3a',
              'line-width': 1.5
            }
          });

          // Fit bounds to show all areas
          var bounds = new maplibregl.LngLatBounds();
          combined.features.forEach(function (feature) {
            var coords = feature.geometry.coordinates[0];
            coords.forEach(function (c) { bounds.extend(c); });
          });
          map.fitBounds(bounds, { padding: 48, maxZoom: 10, duration: 0 });

          // ── Map click → select area ──
          map.on('click', 'areas-fill', function (e) {
            var id = e.features && e.features[0] && e.features[0].properties.id;
            if (id) selectArea(map, id, areas, false);
          });

          // Pointer cursor on hover
          map.on('mouseenter', 'areas-fill', function () {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'areas-fill', function () {
            map.getCanvas().style.cursor = '';
          });
        })
        .catch(function (err) {
          // GeoJSON unavailable — map still works without polygons
          console.warn('areas-map: GeoJSON load failed', err);
        });
    });

    // ── Card click → select area ──
    document.querySelectorAll('.area-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.dataset.areaId;
        if (id) selectArea(map, id, areas, true);
      });
    });
  }

  // MapLibre is loaded with defer; wait for it to be available
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
