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

  // ── Elevation profile helpers ─────────────────────────────────────────────

  // Haversine distance in miles between two {lat, lng} points
  function haversine(a, b) {
    var R = 3958.8;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLng = (b.lng - a.lng) * Math.PI / 180;
    var la = a.lat * Math.PI / 180;
    var lb = b.lat * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  // Nice round tick interval for a given data range and target tick count
  function niceTick(range, targetCount) {
    if (range <= 0) return 1;
    var rough = range / targetCount;
    var pow = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10));
    var norm = rough / pow;
    var nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    return nice * pow;
  }

  // ── GPX parser → profile array ────────────────────────────────────────────

  // Returns [{lng, lat, ele (metres, may be null), dist (miles cumulative)}]
  function parseGpx(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    var pts = doc.querySelectorAll('trkpt');
    if (!pts.length) pts = doc.querySelectorAll('rtept');

    var result = [];
    Array.from(pts).forEach(function (pt) {
      var lng = parseFloat(pt.getAttribute('lon'));
      var lat = parseFloat(pt.getAttribute('lat'));
      if (isNaN(lng) || isNaN(lat)) return;
      var eleEl = pt.querySelector('ele');
      var ele = eleEl ? parseFloat(eleEl.textContent) : null;
      if (ele !== null && isNaN(ele)) ele = null;
      result.push({ lng: lng, lat: lat, ele: ele });
    });

    // Cumulative distance in miles
    for (var i = 0; i < result.length; i++) {
      result[i].dist = i === 0 ? 0 : result[i - 1].dist + haversine(result[i - 1], result[i]);
    }

    return result;
  }

  // ── Elevation profile widget ──────────────────────────────────────────────

  function buildElevationProfile(profile, map) {
    var container = document.getElementById('elevation-profile');
    if (!container) return;

    var hasEle = profile.some(function (p) { return p.ele !== null; });
    if (!hasEle) { container.style.display = 'none'; return; }

    // Convert to feet
    var pts = profile.map(function (p) {
      return {
        lng: p.lng,
        lat: p.lat,
        ele: p.ele !== null ? p.ele * 3.28084 : null,
        dist: p.dist
      };
    });

    var totalDist = pts[pts.length - 1].dist;
    var elevPts = pts.filter(function (p) { return p.ele !== null; });
    var eles = elevPts.map(function (p) { return p.ele; });
    var minEle = Math.min.apply(null, eles);
    var maxEle = Math.max.apply(null, eles);
    var elePad = Math.max((maxEle - minEle) * 0.1, 80);
    var yMin = Math.floor((minEle - elePad) / 100) * 100;
    var yMax = Math.ceil((maxEle + elePad) / 100) * 100;

    // SVG coordinate system
    var VW = 1000, VH = 220;
    var PL = 80, PR = 24, PT = 20, PB = 52;
    var CW = VW - PL - PR;
    var CH = VH - PT - PB;

    function xOf(dist) { return PL + (dist / totalDist) * CW; }
    function yOf(ele)  { return PT + CH - ((ele - yMin) / (yMax - yMin)) * CH; }

    // Build SVG paths
    var lineCoords = elevPts.map(function (p) {
      return xOf(p.dist).toFixed(2) + ',' + yOf(p.ele).toFixed(2);
    });
    var linePath = 'M' + lineCoords.join('L');
    var areaPath = 'M' + xOf(elevPts[0].dist).toFixed(2) + ',' + (PT + CH) +
                   'L' + lineCoords.join('L') +
                   'L' + xOf(elevPts[elevPts.length - 1].dist).toFixed(2) + ',' + (PT + CH) + 'Z';

    // SVG element factory
    var NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs, textContent) {
      var e = document.createElementNS(NS, tag);
      if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (textContent != null) e.textContent = textContent;
      return e;
    }

    var svg = el('svg', {
      viewBox: '0 0 ' + VW + ' ' + VH,
      role: 'img',
      'aria-label': 'Elevation profile chart',
      style: 'display:block;width:100%;height:auto'
    });

    // ── Defs ──
    var defs = el('defs', {});

    var grad = el('linearGradient', { id: 'ele-area-fill', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(el('stop', { offset: '0%',   'stop-color': '#2D5A20', 'stop-opacity': '0.35' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#2D5A20', 'stop-opacity': '0.03' }));
    defs.appendChild(grad);

    var clip = el('clipPath', { id: 'ele-chart-clip' });
    clip.appendChild(el('rect', { x: PL, y: PT, width: CW, height: CH }));
    defs.appendChild(clip);

    svg.appendChild(defs);

    // ── Grid + Y-axis labels ──
    var tickStep = niceTick(yMax - yMin, 4);
    var firstTick = Math.ceil(yMin / tickStep) * tickStep;
    for (var t = firstTick; t <= yMax + 1; t += tickStep) {
      var ty = yOf(t);
      if (ty < PT - 4 || ty > PT + CH + 4) continue;
      svg.appendChild(el('line', {
        x1: PL, y1: ty.toFixed(1), x2: PL + CW, y2: ty.toFixed(1),
        stroke: '#e8e0d4', 'stroke-width': '1'
      }));
      svg.appendChild(el('text', {
        x: PL - 10, y: (ty + 7).toFixed(1),
        'text-anchor': 'end', 'font-size': '22', 'font-family': 'system-ui,sans-serif', fill: '#a89070'
      }, Math.round(t).toLocaleString()));
    }

    // Y-axis unit label
    svg.appendChild(el('text', {
      x: '16', y: (PT + CH / 2).toFixed(1),
      'text-anchor': 'middle', 'font-size': '20', 'font-family': 'system-ui,sans-serif', fill: '#a89070',
      transform: 'rotate(-90,16,' + (PT + CH / 2).toFixed(1) + ')'
    }, 'ft'));

    // ── X-axis labels ──
    var distStep = niceTick(totalDist, 5);
    for (var d = 0; d <= totalDist + distStep * 0.01; d += distStep) {
      var dv = Math.min(d, totalDist);
      var dx = xOf(dv).toFixed(1);
      svg.appendChild(el('text', {
        x: dx, y: VH - 10,
        'text-anchor': 'middle', 'font-size': '22', 'font-family': 'system-ui,sans-serif', fill: '#a89070'
      }, dv.toFixed(1) + ' mi'));
    }

    // ── Chart area fill + line ──
    svg.appendChild(el('path', { d: areaPath, fill: 'url(#ele-area-fill)', 'clip-path': 'url(#ele-chart-clip)' }));
    svg.appendChild(el('path', {
      d: linePath, fill: 'none',
      stroke: '#2D5A20', 'stroke-width': '2.5',
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      'clip-path': 'url(#ele-chart-clip)'
    }));

    // ── Crosshair ──
    var crossLine = el('line', {
      x1: 0, y1: PT, x2: 0, y2: PT + CH,
      stroke: '#2D5A20', 'stroke-width': '1.5', 'stroke-dasharray': '5 3',
      opacity: 0, 'pointer-events': 'none'
    });
    var crossDot = el('circle', {
      cx: 0, cy: 0, r: '5.5',
      fill: '#fff', stroke: '#2D5A20', 'stroke-width': '2.5',
      opacity: 0, 'pointer-events': 'none'
    });
    svg.appendChild(crossLine);
    svg.appendChild(crossDot);

    // Transparent overlay to capture mouse events across chart area
    var overlay = el('rect', {
      x: PL, y: PT, width: CW, height: CH,
      fill: 'transparent', style: 'cursor:crosshair'
    });
    svg.appendChild(overlay);

    container.innerHTML = '';
    container.appendChild(svg);

    // Tooltip
    var tip = document.createElement('div');
    tip.className = 'elevation-tooltip';
    container.appendChild(tip);

    // ── Shared state ──
    var fromMap = false; // prevent feedback loop between map→profile and profile→map

    // ── Find nearest profile point by cumulative distance ──
    function nearestByDist(targetDist) {
      var best = 0, bestDiff = Infinity;
      for (var i = 0; i < pts.length; i++) {
        var diff = Math.abs(pts[i].dist - targetDist);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      }
      return best;
    }

    // ── Find nearest profile point by lat/lng (squared distance) ──
    function nearestByLatLng(lat, lng) {
      var best = 0, bestD = Infinity;
      for (var i = 0; i < pts.length; i++) {
        var dlat = pts[i].lat - lat;
        var dlng = pts[i].lng - lng;
        var d = dlat * dlat + dlng * dlng;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    // ── Profile crosshair ──
    function showCrosshair(idx) {
      var pt = pts[idx];
      if (!pt || pt.ele === null) return;
      var cx = xOf(pt.dist).toFixed(2);
      var cy = yOf(pt.ele).toFixed(2);
      crossLine.setAttribute('x1', cx); crossLine.setAttribute('x2', cx);
      crossLine.setAttribute('opacity', '1');
      crossDot.setAttribute('cx', cx); crossDot.setAttribute('cy', cy);
      crossDot.setAttribute('opacity', '1');
    }

    function hideCrosshair() {
      crossLine.setAttribute('opacity', '0');
      crossDot.setAttribute('opacity', '0');
    }

    // ── Map hover dot ──
    function showMapDot(idx) {
      var pt = pts[idx];
      if (!pt) return;
      var src = map.getSource('hover-point');
      if (!src) return;
      src.setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
        properties: {}
      });
      map.setPaintProperty('hover-dot', 'circle-opacity', 1);
      map.setPaintProperty('hover-dot', 'circle-stroke-opacity', 1);
    }

    function hideMapDot() {
      map.setPaintProperty('hover-dot', 'circle-opacity', 0);
      map.setPaintProperty('hover-dot', 'circle-stroke-opacity', 0);
    }

    // ── Show tooltip ──
    function showTip(idx, clientX, containerLeft) {
      var pt = pts[idx];
      if (!pt || pt.ele === null) { tip.style.display = 'none'; return; }
      var gain = pt.ele - pts[0].ele;
      var gainStr = gain >= 0
        ? ' · +' + Math.round(gain) + ' ft'
        : ' · −' + Math.round(-gain) + ' ft';
      tip.textContent = Math.round(pt.ele).toLocaleString() + ' ft  ·  ' + pt.dist.toFixed(2) + ' mi' + gainStr;
      var left = Math.min(clientX - containerLeft + 12, container.offsetWidth - tip.offsetWidth - 8);
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.display = 'block';
    }

    // ── Profile mouse events (profile → map) ──
    var svgRect = null;

    overlay.addEventListener('mouseenter', function () {
      svgRect = svg.getBoundingClientRect();
    });

    overlay.addEventListener('mousemove', function (e) {
      if (!svgRect) svgRect = svg.getBoundingClientRect();
      var scaleX = VW / svgRect.width;
      var svgX = (e.clientX - svgRect.left) * scaleX;
      var frac = (svgX - PL) / CW;
      if (frac < 0 || frac > 1) return;
      var idx = nearestByDist(frac * totalDist);
      showCrosshair(idx);
      fromMap = false;
      showMapDot(idx);
      showTip(idx, e.clientX, svgRect.left);
    });

    overlay.addEventListener('mouseleave', function () {
      hideCrosshair();
      hideMapDot();
      tip.style.display = 'none';
    });

    // ── Map mouse events (map → profile) ──
    map.on('mousemove', function (e) {
      if (fromMap) return;
      var idx = nearestByLatLng(e.lngLat.lat, e.lngLat.lng);
      var projected = map.project([pts[idx].lng, pts[idx].lat]);
      var pixDist = Math.sqrt(
        Math.pow(projected.x - e.point.x, 2) + Math.pow(projected.y - e.point.y, 2)
      );
      if (pixDist < 32) {
        showCrosshair(idx);
        tip.style.display = 'none'; // tooltip stays on profile side only
      } else {
        hideCrosshair();
      }
    });

    map.getCanvas().addEventListener('mouseleave', function () {
      hideCrosshair();
    });
  }

  // ── Map initialisation ────────────────────────────────────────────────────

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
          var profile = parseGpx(text);
          var coords  = profile.map(function (p) { return [p.lng, p.lat]; });
          if (coords.length < 2) return;

          // ── Track line ──
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

          // ── Hover dot (for profile → map sync) ──
          map.addSource('hover-point', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: {} }
          });
          map.addLayer({
            id: 'hover-dot',
            type: 'circle',
            source: 'hover-point',
            paint: {
              'circle-radius': 7,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#2D5A20',
              'circle-stroke-width': 2.5,
              'circle-opacity': 0,
              'circle-stroke-opacity': 0
            }
          });

          // ── Fit bounds ──
          var bounds = coords.reduce(function (b, c) {
            return b.extend(c);
          }, new maplibregl.LngLatBounds(coords[0], coords[0]));
          map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });

          // ── Build elevation profile ──
          buildElevationProfile(profile, map);
        })
        .catch(function () {
          // GPX unavailable — map still shows trailhead marker
        });
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
