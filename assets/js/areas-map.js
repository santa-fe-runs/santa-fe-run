(function () {
  'use strict';

  var LS_KEY = 'trail-map-style';

  // One distinct earthy color per area, in areas.yml order
  var AREA_COLORS = {
    'winsor-corridor':  '#2D5A20',
    'dale-ball':        '#1E6E6E',
    'la-tierra':        '#C46B2A',
    'pecos-wilderness': '#1A5280',
    'nambe-badlands':   '#8B6914',
    'galisteo-basin':   '#7A3580',
    'caja-del-rio':     '#8A3030'
  };

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

  // Build a MapLibre match expression keyed on feature.properties.id
  function colorMatchExpr(ids) {
    var expr = ['match', ['get', 'id']];
    ids.forEach(function (id) {
      expr.push(id, AREA_COLORS[id] || '#2D5A20');
    });
    expr.push('#2D5A20'); // fallback
    return expr;
  }

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

  // ── Carousel helpers ──────────────────────────────────────────────────────

  function scrollCarouselToCard(carousel, cardEl) {
    var carouselRect = carousel.getBoundingClientRect();
    var cardRect = cardEl.getBoundingClientRect();
    var scrollLeft = carousel.scrollLeft + cardRect.left - carouselRect.left - (carousel.clientWidth - cardRect.width) / 2;
    carousel.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  }

  function initCarouselButtons(carousel) {
    var cards = Array.prototype.slice.call(carousel.querySelectorAll('.area-card'));
    var prevBtn = document.querySelector('.carousel-btn--prev');
    var nextBtn = document.querySelector('.carousel-btn--next');
    if (!prevBtn || !nextBtn || cards.length === 0) return;

    function centeredCardIndex() {
      var centerX = carousel.scrollLeft + carousel.clientWidth / 2;
      var closest = 0, minDist = Infinity;
      cards.forEach(function (card, i) {
        var dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - centerX);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      return closest;
    }

    function scrollByCard(dir) {
      var idx = Math.max(0, Math.min(cards.length - 1, centeredCardIndex() + dir));
      scrollCarouselToCard(carousel, cards[idx]);
    }

    prevBtn.addEventListener('click', function () { scrollByCard(-1); });
    nextBtn.addEventListener('click', function () { scrollByCard(1); });
  }

  // ── Active area state ─────────────────────────────────────────────────────

  var activeAreaId = null;

  function setMapHighlight(map, areaId) {
    if (!map.getLayer('areas-fill')) return;
    map.setPaintProperty('areas-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'id'], areaId || ''], 0.4,
      0.12
    ]);
    map.setPaintProperty('areas-line', 'line-width', [
      'case',
      ['==', ['get', 'id'], areaId || ''], 3,
      1.5
    ]);
  }

  function selectArea(map, areaId, areaBounds, carousel) {
    if (activeAreaId === areaId) return;
    activeAreaId = areaId;

    // Highlight card and center in carousel
    var targetCard = null;
    document.querySelectorAll('.area-card').forEach(function (card) {
      var isActive = card.dataset.areaId === areaId;
      card.classList.toggle('is-active', isActive);
      if (isActive) targetCard = card;
    });
    if (targetCard && carousel) scrollCarouselToCard(carousel, targetCard);

    // Update map highlight
    setMapHighlight(map, areaId);

    // Fit map to the selected polygon
    var bounds = areaBounds[areaId];
    if (bounds) {
      map.fitBounds(bounds, { padding: 48, duration: 600, essential: true });
    }
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  function init() {
    var mapEl = document.getElementById('areas-map');
    if (!mapEl || typeof maplibregl === 'undefined') return;

    var areas = [];
    try { areas = JSON.parse(mapEl.dataset.areas); } catch (e) { return; }

    var carousel = document.querySelector('.areas-carousel');
    var areaIds = areas.map(function (a) { return a.id; });
    var colorExpr = colorMatchExpr(areaIds);

    var initialStyle = styleById(savedStyle());

    var map = new maplibregl.Map({
      container: 'areas-map',
      style: {
        version: 8,
        glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=pOs2tpJTbZMN95OeELuo',
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

    // Wire up carousel chevron buttons
    if (carousel) initCarouselButtons(carousel);

    // Shared lookup populated once GeoJSON loads; used by both click handlers
    var areaBounds = {};

    // ── Load all GeoJSON files ──
    map.on('load', function () {
      var fetches = areas.map(function (area) {
        return fetch(area.geojson)
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch ' + area.geojson);
            return res.json();
          })
          .then(function (geojson) {
            // Normalize bare Feature → FeatureCollection
            if (geojson.type === 'Feature') {
              geojson = { type: 'FeatureCollection', features: [geojson] };
            }
            if (geojson.features) {
              geojson.features.forEach(function (f) {
                f.properties = f.properties || {};
                f.properties.id = area.id;
                f.properties.name = area.name;
              });
            }
            return geojson;
          })
          .catch(function (err) {
            console.error('areas-map: failed to load ' + area.id, err);
            return null;
          });
      });

      Promise.all(fetches)
        .then(function (geojsons) {
          var combined = { type: 'FeatureCollection', features: [] };
          geojsons.forEach(function (fc) {
            if (fc && fc.features) combined.features = combined.features.concat(fc.features);
          });

          map.addSource('areas', { type: 'geojson', data: combined });

          // Fill — per-area color, uniform low opacity
          map.addLayer({
            id: 'areas-fill',
            type: 'fill',
            source: 'areas',
            paint: {
              'fill-color': colorExpr,
              'fill-opacity': 0.12
            }
          });

          // Outline — per-area color
          map.addLayer({
            id: 'areas-line',
            type: 'line',
            source: 'areas',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': colorExpr,
              'line-width': 1.5
            }
          });

          // Labels — area name at polygon centroid
          try {
            map.addLayer({
              id: 'areas-label',
              type: 'symbol',
              source: 'areas',
              layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Regular'],
                'text-size': 12,
                'text-anchor': 'center',
                'text-max-width': 8,
                'symbol-placement': 'point'
              },
              paint: {
                'text-color': '#1B3A14',
                'text-halo-color': 'rgba(255,255,255,0.85)',
                'text-halo-width': 2
              }
            });
          } catch (e) {
            console.error('areas-map: label layer failed', e);
          }

          // Build per-area bounds and fit to all areas
          var allBounds = new maplibregl.LngLatBounds();
          combined.features.forEach(function (feature) {
            var id = feature.properties.id;
            var ring = feature.geometry.coordinates[0];
            var ab = new maplibregl.LngLatBounds();
            ring.forEach(function (c) { ab.extend(c); allBounds.extend(c); });
            areaBounds[id] = ab;
          });
          map.fitBounds(allBounds, { padding: 48, maxZoom: 10, duration: 0 });

          // Map click → select area
          map.on('click', 'areas-fill', function (e) {
            var id = e.features && e.features[0] && e.features[0].properties.id;
            if (id) selectArea(map, id, areaBounds, carousel);
          });

          map.on('mouseenter', 'areas-fill', function () { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', 'areas-fill', function () { map.getCanvas().style.cursor = ''; });
        })
        .catch(function (err) {
          console.error('areas-map: GeoJSON load failed', err);
        });
    });

    // Card click → select area
    document.querySelectorAll('.area-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.dataset.areaId;
        if (id) selectArea(map, id, areaBounds, carousel);
      });
    });
  }

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
