(function () {
  'use strict';

  var LS_KEY = 'trail-map-style';

  // styleUrl → vector style JSON (uses map.setStyle); tiles → raster XYZ (uses source swap)
  var STYLES = [
    {
      key: 'maptiler-topo',
      label: 'MapTiler',
      styleUrl: 'https://api.maptiler.com/maps/topo-v4/style.json?key=pOs2tpJTbZMN95OeELuo'
    },
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

  // Build a minimal MapLibre style object for a raster tile source
  function rasterStyleObject(style) {
    return {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        topo: {
          type: 'raster',
          tiles: style.tiles,
          tileSize: style.tileSize,
          maxzoom: style.maxzoom,
          attribution: style.attribution
        }
      },
      layers: [{ id: 'topo', type: 'raster', source: 'topo' }]
    };
  }

  // ── Track overlay (persists across style changes) ─────────────────────────
  // Stored after GPX loads so it can be re-applied after setStyle() wipes layers.
  var trackData = null; // { coords: [[lng, lat], …], profile: […] }

  function addTrackLayers(map) {
    if (!trackData) return;
    var coords = trackData.coords;

    // Remove stale layers/sources left over from a previous style
    ['hover-dot', 'track-line'].forEach(function (id) {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    ['hover-point', 'track'].forEach(function (id) {
      if (map.getSource(id)) map.removeSource(id);
    });

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
  }

  // ── Basemap switching ─────────────────────────────────────────────────────
  // Three cases:
  //   1. → vector (MapTiler):  setStyle(url)          + re-add track overlay
  //   2. vector → raster:      setStyle(styleObject)  + re-add track overlay
  //   3. raster → raster:      swap source in-place   (track layers survive)
  function swapBasemap(map, style) {
    if (style.styleUrl) {
      // Case 1: switching to a vector style
      map.setStyle(style.styleUrl);
      map.once('style.load', function () { addTrackLayers(map); });
    } else if (!map.getSource('topo')) {
      // Case 2: switching from vector to raster (no 'topo' source = currently in vector mode)
      map.setStyle(rasterStyleObject(style));
      map.once('style.load', function () { addTrackLayers(map); });
    } else {
      // Case 3: raster ↔ raster — smooth in-place swap, track layers survive
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

  function niceTick(range, targetCount) {
    if (range <= 0) return 1;
    var rough = range / targetCount;
    var pow = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10));
    var norm = rough / pow;
    var nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    return nice * pow;
  }

  // ── GPX parser ────────────────────────────────────────────────────────────

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

    var pts = profile.map(function (p) {
      return {
        lng: p.lng,
        lat: p.lat,
        ele: p.ele !== null ? p.ele * 3.28084 : null,
        dist: p.dist
      };
    });

    // Precompute cumulative gain, loss, and local grade per point
    var cumGain  = new Array(pts.length);
    var cumLoss  = new Array(pts.length);
    var localGrade = new Array(pts.length);
    cumGain[0] = 0; cumLoss[0] = 0;
    for (var i = 1; i < pts.length; i++) {
      var dEle = (pts[i].ele !== null && pts[i - 1].ele !== null) ? pts[i].ele - pts[i - 1].ele : 0;
      cumGain[i] = cumGain[i - 1] + Math.max(0, dEle);
      cumLoss[i] = cumLoss[i - 1] + Math.max(0, -dEle);
    }
    var WIN = 0.05;
    for (var i = 0; i < pts.length; i++) {
      var lo = i, hi = i;
      while (lo > 0 && pts[i].dist - pts[lo - 1].dist < WIN) lo--;
      while (hi < pts.length - 1 && pts[hi + 1].dist - pts[i].dist < WIN) hi++;
      var wDist = (pts[hi].dist - pts[lo].dist) * 5280;
      var wEle  = (pts[hi].ele !== null && pts[lo].ele !== null) ? pts[hi].ele - pts[lo].ele : null;
      localGrade[i] = (wDist > 0 && wEle !== null) ? (wEle / wDist) * 100 : 0;
    }

    var totalDist = pts[pts.length - 1].dist;
    var elevPts = pts.filter(function (p) { return p.ele !== null; });
    var eles = elevPts.map(function (p) { return p.ele; });
    var minEle = Math.min.apply(null, eles);
    var maxEle = Math.max.apply(null, eles);
    var elePad = Math.max((maxEle - minEle) * 0.1, 80);
    var yMin = Math.floor((minEle - elePad) / 100) * 100;
    var yMax = Math.ceil((maxEle + elePad) / 100) * 100;

    var VW = 1000, VH = 220;
    var PL = 80, PR = 24, PT = 20, PB = 52;
    var CW = VW - PL - PR;
    var CH = VH - PT - PB;

    function xOf(dist) { return PL + (dist / totalDist) * CW; }
    function yOf(ele)  { return PT + CH - ((ele - yMin) / (yMax - yMin)) * CH; }

    var lineCoords = elevPts.map(function (p) {
      return xOf(p.dist).toFixed(2) + ',' + yOf(p.ele).toFixed(2);
    });
    var linePath = 'M' + lineCoords.join('L');
    var areaPath = 'M' + xOf(elevPts[0].dist).toFixed(2) + ',' + (PT + CH) +
                   'L' + lineCoords.join('L') +
                   'L' + xOf(elevPts[elevPts.length - 1].dist).toFixed(2) + ',' + (PT + CH) + 'Z';

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

    var defs = el('defs', {});
    var grad = el('linearGradient', { id: 'ele-area-fill', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(el('stop', { offset: '0%',   'stop-color': '#2D5A20', 'stop-opacity': '0.35' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#2D5A20', 'stop-opacity': '0.03' }));
    defs.appendChild(grad);
    var clip = el('clipPath', { id: 'ele-chart-clip' });
    clip.appendChild(el('rect', { x: PL, y: PT, width: CW, height: CH }));
    defs.appendChild(clip);
    svg.appendChild(defs);

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

    svg.appendChild(el('text', {
      x: '16', y: (PT + CH / 2).toFixed(1),
      'text-anchor': 'middle', 'font-size': '20', 'font-family': 'system-ui,sans-serif', fill: '#a89070',
      transform: 'rotate(-90,16,' + (PT + CH / 2).toFixed(1) + ')'
    }, 'ft'));

    var distStep = niceTick(totalDist, 5);
    for (var d = 0; d <= totalDist + distStep * 0.01; d += distStep) {
      var dv = Math.min(d, totalDist);
      svg.appendChild(el('text', {
        x: xOf(dv).toFixed(1), y: VH - 10,
        'text-anchor': 'middle', 'font-size': '22', 'font-family': 'system-ui,sans-serif', fill: '#a89070'
      }, dv.toFixed(1) + ' mi'));
    }

    svg.appendChild(el('path', { d: areaPath, fill: 'url(#ele-area-fill)', 'clip-path': 'url(#ele-chart-clip)' }));
    svg.appendChild(el('path', {
      d: linePath, fill: 'none',
      stroke: '#2D5A20', 'stroke-width': '2.5',
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      'clip-path': 'url(#ele-chart-clip)'
    }));

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

    var overlay = el('rect', {
      x: PL, y: PT, width: CW, height: CH,
      fill: 'transparent', style: 'cursor:crosshair'
    });
    svg.appendChild(overlay);

    container.innerHTML = '';
    container.appendChild(svg);

    var tip = document.createElement('div');
    tip.className = 'elevation-tooltip';
    container.appendChild(tip);

    var fromMap = false;

    function nearestByDist(targetDist) {
      var best = 0, bestDiff = Infinity;
      for (var i = 0; i < pts.length; i++) {
        var diff = Math.abs(pts[i].dist - targetDist);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      }
      return best;
    }

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

    function showTip(idx, clientX, containerLeft) {
      var pt = pts[idx];
      if (!pt || pt.ele === null) { tip.style.display = 'none'; return; }
      var grade = localGrade[idx];
      var gradeSign = grade >= 0 ? '+' : '−';
      tip.textContent =
        Math.round(pt.ele).toLocaleString() + ' ft' +
        '  ·  ' + pt.dist.toFixed(2) + ' mi' +
        '  ·  ↑' + Math.round(cumGain[idx]) + ' ft  ↓' + Math.round(cumLoss[idx]) + ' ft' +
        '  ·  ' + gradeSign + Math.abs(grade).toFixed(1) + '% grade';
      var left = Math.min(clientX - containerLeft + 12, container.offsetWidth - tip.offsetWidth - 8);
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.display = 'block';
    }

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

    map.on('mousemove', function (e) {
      if (fromMap) return;
      var idx = nearestByLatLng(e.lngLat.lat, e.lngLat.lng);
      var projected = map.project([pts[idx].lng, pts[idx].lat]);
      var pixDist = Math.sqrt(
        Math.pow(projected.x - e.point.x, 2) + Math.pow(projected.y - e.point.y, 2)
      );
      if (pixDist < 32) {
        showCrosshair(idx);
        tip.style.display = 'none';
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

    // Initial map style: vector URL or raster style object
    var mapStyle = initialStyle.styleUrl || rasterStyleObject(initialStyle);

    var map = new maplibregl.Map({
      container: 'trail-map',
      style: mapStyle,
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

          // Store at module scope so addTrackLayers() can re-apply after style changes
          trackData = { coords: coords, profile: profile };

          addTrackLayers(map);

          // Fit map to track bounds
          var bounds = coords.reduce(function (b, c) {
            return b.extend(c);
          }, new maplibregl.LngLatBounds(coords[0], coords[0]));
          map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });

          buildElevationProfile(profile, map);
        })
        .catch(function () {
          // GPX unavailable — map still shows trailhead marker
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
