/**
 * Run Santa Fe — upcoming races (list / calendar / map)
 *
 * Race data is fetched at build time by scripts/fetch_races.py and embedded
 * in the page as JSON. Everything here is client-side filtering + rendering.
 */
(function () {
  "use strict";

  // Slider positions → miles. Last stop is open-ended ("100+").
  const DISTANCE_STOPS = [
    { mi: 0,    label: "0 mi" },
    { mi: 1,    label: "1 mi" },
    { mi: 3.1,  label: "5K" },
    { mi: 5,    label: "5 mi" },
    { mi: 6.2,  label: "10K" },
    { mi: 10,   label: "10 mi" },
    { mi: 13.1, label: "Half" },
    { mi: 20,   label: "20 mi" },
    { mi: 26.2, label: "Marathon" },
    { mi: 31.1, label: "50K" },
    { mi: 50,   label: "50 mi" },
    { mi: 100,  label: "100+ mi" },
  ];
  const LAST_STOP = DISTANCE_STOPS.length - 1;
  const EPS = 0.06; // so 3.11 mi still counts as "5K"

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const MAP_TILES = {
    tiles: ["https://api.maptiler.com/maps/topo-v4/{z}/{x}/{y}.png?key=pOs2tpJTbZMN95OeELuo"],
    tileSize: 256,
    maxzoom: 22,
    attribution: '© <a href="https://www.maptiler.com/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
  const TYPE_COLORS = { trail: "#2D5A20", road: "#A07B3F" };

  const $ = (id) => document.getElementById(id);

  // ─── Data ──────────────────────────────────────────────────────────────────

  let races = [];
  try {
    races = JSON.parse($("races-data").textContent) || [];
  } catch (e) {
    races = [];
  }

  const todayStr = isoDate(new Date());
  races = races.filter((r) => (r.end_date || r.date) >= todayStr);

  const maxDate = races.reduce((m, r) => (r.date > m ? r.date : m), todayStr);

  // ─── State ─────────────────────────────────────────────────────────────────

  const state = {
    types: new Set(["trail", "road"]),
    distMin: 0,
    distMax: LAST_STOP,
    from: todayStr,
    to: "",
    view: "list",
    calMonth: null, // { y, m } — month shown in calendar
    calDay: null,   // selected "YYYY-MM-DD" in calendar
  };

  const els = {
    typeChips: document.querySelectorAll(".type-chip"),
    distMin: $("distance-min"),
    distMax: $("distance-max"),
    distFill: $("fill-distance"),
    distValMin: $("distance-val-min"),
    distValMax: $("distance-val-max"),
    from: $("filter-date-from"),
    to: $("filter-date-to"),
    clear: $("filters-clear"),
    toggle: $("filters-toggle"),
    panel: $("filters-panel"),
    activeCount: $("filter-active-count"),
    count: $("results-count"),
    noun: $("results-noun"),
    viewBtns: document.querySelectorAll(".view-btn"),
    list: $("races-list"),
    calendar: $("races-calendar"),
    mapWrap: $("races-map-wrap"),
    mapNote: $("races-map-note"),
    noResults: $("no-results"),
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function isoDate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function distanceLabel(d) {
    if (d.timed) return d.label;
    const mi = d.miles;
    const near = (x) => Math.abs(mi - x) < EPS;
    if (near(3.1)) return "5K";
    if (near(6.2)) return "10K";
    if (near(13.1)) return "Half";
    if (near(26.2)) return "Marathon";
    if (/^\d+(\.\d+)?\s*k$/i.test(d.label.trim())) return d.label.trim().toUpperCase();
    if (mi < 0.1) return d.label;
    return (mi % 1 === 0 ? mi : mi.toFixed(1)) + " mi";
  }

  function distanceMatches(d) {
    const lo = DISTANCE_STOPS[state.distMin].mi;
    const hi = state.distMax === LAST_STOP ? Infinity : DISTANCE_STOPS[state.distMax].mi;
    // Timed events (6hr, 24hr…) are ultra-ish: only match when the range is open at the top
    if (d.timed) return hi === Infinity;
    return d.miles >= lo - EPS && d.miles <= hi + EPS;
  }

  function formatRange(r) {
    const start = parseDate(r.date);
    const opts = { weekday: "short", month: "short", day: "numeric" };
    let s = start.toLocaleDateString("en-US", opts);
    if (r.end_date) {
      const end = parseDate(r.end_date);
      s += " – " + end.toLocaleDateString("en-US", end.getMonth() === start.getMonth()
        ? { weekday: "short", day: "numeric" } : opts);
    }
    return s;
  }

  function distanceChips(r) {
    return r.distances.map((d) =>
      '<span class="race-dist' + (distanceMatches(d) ? "" : " is-dim") + '">' + esc(distanceLabel(d)) + "</span>"
    ).join("");
  }

  function typeBadge(r) {
    return '<span class="race-type race-type--' + r.type + '">' + (r.type === "trail" ? "Trail" : "Road") + "</span>";
  }

  // ─── Filtering ─────────────────────────────────────────────────────────────

  function filtered() {
    return races.filter((r) => {
      if (!state.types.has(r.type)) return false;
      if (state.from && (r.end_date || r.date) < state.from) return false;
      if (state.to && r.date > state.to) return false;
      return r.distances.some(distanceMatches);
    });
  }

  function activeFilterCount() {
    let n = 0;
    if (state.types.size < 2) n++;
    if (state.distMin !== 0 || state.distMax !== LAST_STOP) n++;
    if (state.from !== todayStr || state.to) n++;
    return n;
  }

  // ─── List view ─────────────────────────────────────────────────────────────

  function renderList(list) {
    let html = "";
    let month = "";
    list.forEach((r) => {
      const d = parseDate(r.date);
      const key = MONTHS[d.getMonth()] + " " + d.getFullYear();
      if (key !== month) {
        if (month) html += "</div>";
        html += '<h2 class="races-month">' + key + '</h2><div class="races-month-group">';
        month = key;
      }
      html +=
        '<a class="race-row" href="' + esc(r.url) + '" target="_blank" rel="noopener">' +
          '<div class="race-date" aria-hidden="true">' +
            '<span class="race-date-dow">' + WEEKDAYS[d.getDay()] + "</span>" +
            '<span class="race-date-day">' + d.getDate() + "</span>" +
          "</div>" +
          '<div class="race-main">' +
            '<div class="race-name-row"><h3 class="race-name">' + esc(r.name) + "</h3>" + typeBadge(r) + "</div>" +
            '<p class="race-meta">' + esc(formatRange(r)) + " · " + esc(r.city) + ", NM · " + esc(r.source) + "</p>" +
            '<div class="race-dists">' + distanceChips(r) + "</div>" +
          "</div>" +
          '<span class="race-cta" aria-hidden="true">→</span>' +
        "</a>";
    });
    if (month) html += "</div>";
    els.list.innerHTML = html;
  }

  // ─── Calendar view ─────────────────────────────────────────────────────────

  function racesByDay(list) {
    const map = {};
    list.forEach((r) => {
      const start = parseDate(r.date);
      const end = r.end_date ? parseDate(r.end_date) : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const k = isoDate(d);
        (map[k] = map[k] || []).push(r);
      }
    });
    return map;
  }

  function ensureCalMonth(list) {
    if (state.calMonth) return;
    const first = list.length ? parseDate(list[0].date) : parseDate(state.from || todayStr);
    state.calMonth = { y: first.getFullYear(), m: first.getMonth() };
  }

  function renderCalendar(list) {
    ensureCalMonth(list);
    const { y, m } = state.calMonth;
    const byDay = racesByDay(list);
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthCount = list.filter((r) => {
      const d = parseDate(r.date);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;

    let html =
      '<div class="cal-header">' +
        '<button class="cal-nav" type="button" data-cal="-1" aria-label="Previous month">‹</button>' +
        '<h2 class="cal-title">' + MONTHS[m] + " " + y +
          ' <span class="cal-title-count">' + monthCount + " race" + (monthCount === 1 ? "" : "s") + "</span></h2>" +
        '<button class="cal-nav" type="button" data-cal="1" aria-label="Next month">›</button>' +
      "</div>" +
      '<div class="cal-grid" role="grid">' +
      WEEKDAYS.map((w) => '<div class="cal-dow" role="columnheader">' + w + "</div>").join("");

    for (let i = 0; i < first.getDay(); i++) html += '<div class="cal-cell is-empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const k = isoDate(new Date(y, m, day));
      const dayRaces = byDay[k] || [];
      const cls = ["cal-cell"];
      if (k === todayStr) cls.push("is-today");
      if (k < todayStr) cls.push("is-past");
      if (dayRaces.length) cls.push("has-races");
      if (k === state.calDay) cls.push("is-selected");
      html += '<div class="' + cls.join(" ") + '" role="gridcell"' +
        (dayRaces.length ? ' data-day="' + k + '" tabindex="0" aria-label="' + esc(MONTHS[m] + " " + day + ": " + dayRaces.length + " races") + '"' : "") + ">" +
        '<span class="cal-daynum">' + day + "</span>";
      if (dayRaces.length) {
        html += '<span class="cal-dot-count" aria-hidden="true">' + dayRaces.length + "</span>";
        html += '<ul class="cal-races">' + dayRaces.slice(0, 3).map((r) =>
          '<li><a class="cal-race cal-race--' + r.type + '" href="' + esc(r.url) + '" target="_blank" rel="noopener" title="' + esc(r.name) + '">' + esc(r.name) + "</a></li>"
        ).join("") + (dayRaces.length > 3 ? '<li class="cal-more">+' + (dayRaces.length - 3) + " more</li>" : "") + "</ul>";
      }
      html += "</div>";
    }
    html += "</div>";

    // Selected-day detail (primary way to see races on narrow screens)
    if (state.calDay && byDay[state.calDay]) {
      const d = parseDate(state.calDay);
      html += '<div class="cal-detail"><h3 class="cal-detail-title">' +
        d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + "</h3>" +
        byDay[state.calDay].map((r) =>
          '<a class="cal-detail-row" href="' + esc(r.url) + '" target="_blank" rel="noopener">' +
            '<div class="race-name-row"><span class="race-name">' + esc(r.name) + "</span>" + typeBadge(r) + "</div>" +
            '<p class="race-meta">' + esc(r.city) + ", NM · " + esc(r.source) + "</p>" +
            '<div class="race-dists">' + distanceChips(r) + "</div>" +
          "</a>"
        ).join("") + "</div>";
    }

    els.calendar.innerHTML = html;
  }

  els.calendar.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-cal]");
    if (nav) {
      const step = Number(nav.dataset.cal);
      const d = new Date(state.calMonth.y, state.calMonth.m + step, 1);
      state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
      state.calDay = null;
      render();
      return;
    }
    if (e.target.closest("a")) return;
    const cell = e.target.closest("[data-day]");
    if (cell) {
      state.calDay = state.calDay === cell.dataset.day ? null : cell.dataset.day;
      render();
    }
  });

  els.calendar.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-day]")) {
      e.preventDefault();
      e.target.click();
    }
  });

  // ─── Map view ──────────────────────────────────────────────────────────────

  let map = null;
  let mapReady = false;
  let popup = null;

  function toGeoJSON(list) {
    return {
      type: "FeatureCollection",
      features: list.filter((r) => r.lat != null && r.lng != null).map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
        properties: { id: r.id, type: r.type },
      })),
    };
  }

  function popupHTML(ids) {
    const byId = {};
    races.forEach((r) => { byId[r.id] = r; });
    const items = ids.map((id) => byId[id]).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
    return '<div class="race-popup">' + items.map((r) =>
      '<a class="race-popup-row" href="' + esc(r.url) + '" target="_blank" rel="noopener">' +
        '<span class="race-popup-name">' + esc(r.name) + "</span>" +
        '<span class="race-popup-meta">' + esc(formatRange(r)) + " · " + esc(r.city) + "</span>" +
        '<span class="race-popup-meta">' + r.distances.map((d) => esc(distanceLabel(d))).join(", ") + "</span>" +
      "</a>"
    ).join("") + "</div>";
  }

  function showPopup(lngLat, ids) {
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ maxWidth: "300px", offset: 12 })
      .setLngLat(lngLat)
      .setHTML(popupHTML(ids))
      .addTo(map);
  }

  function initMap() {
    if (map || typeof maplibregl === "undefined") return;
    map = new maplibregl.Map({
      container: "races-map",
      style: {
        version: 8,
        glyphs: "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=pOs2tpJTbZMN95OeELuo",
        sources: { topo: Object.assign({ type: "raster" }, MAP_TILES) },
        layers: [{ id: "topo", type: "raster", source: "topo" }],
      },
      // New Mexico
      bounds: [[-109.05, 31.33], [-103.0, 37.0]],
      fitBoundsOptions: { padding: 16 },
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("races", {
        type: "geojson",
        data: toGeoJSON(filtered()),
        cluster: true,
        clusterRadius: 36,
        clusterMaxZoom: 11,
      });
      map.addLayer({
        id: "race-clusters",
        type: "circle",
        source: "races",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1B3A14",
          "circle-opacity": 0.88,
          "circle-stroke-color": "#F7EFE0",
          "circle-stroke-width": 2,
          "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 15, 23],
        },
      });
      map.addLayer({
        id: "race-cluster-count",
        type: "symbol",
        source: "races",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#F7EFE0" },
      });
      map.addLayer({
        id: "race-points",
        type: "circle",
        source: "races",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["match", ["get", "type"], "trail", TYPE_COLORS.trail, TYPE_COLORS.road],
          "circle-radius": 8,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
        },
      });

      map.on("click", "race-clusters", (e) => {
        const f = e.features[0];
        const src = map.getSource("races");
        const clusterId = f.properties.cluster_id;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          // Races in the same city share coordinates and never split — list them instead
          if (zoom > 11 || map.getZoom() >= 10) {
            return src.getClusterLeaves(clusterId, Infinity, 0).then((leaves) => {
              showPopup(f.geometry.coordinates, leaves.map((l) => l.properties.id));
            });
          }
          map.easeTo({ center: f.geometry.coordinates, zoom: zoom });
        });
      });

      map.on("click", "race-points", (e) => {
        // Unclustered points can still overlap exactly (same city geocode)
        const ids = e.features.map((f) => f.properties.id);
        showPopup(e.features[0].geometry.coordinates, ids);
      });

      ["race-clusters", "race-points"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      });

      mapReady = true;
      updateMap(filtered());
    });
  }

  function updateMap(list) {
    const missing = list.filter((r) => r.lat == null || r.lng == null).length;
    els.mapNote.textContent = "Markers are placed at the race's town, not the start line." +
      (missing ? " " + missing + " race" + (missing === 1 ? " has" : "s have") + " no location and " + (missing === 1 ? "isn't" : "aren't") + " shown." : "");
    if (!mapReady) return;
    if (popup) popup.remove();
    map.getSource("races").setData(toGeoJSON(list));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  function render() {
    const list = filtered();

    els.count.textContent = list.length;
    els.noun.textContent = list.length === 1 ? "race" : "races";
    els.noResults.classList.toggle("visible", list.length === 0 && state.view === "list");

    const n = activeFilterCount();
    els.clear.classList.toggle("visible", n > 0);
    els.activeCount.hidden = n === 0;
    els.activeCount.textContent = n;

    els.list.hidden = state.view !== "list";
    els.calendar.hidden = state.view !== "calendar";
    els.mapWrap.hidden = state.view !== "map";

    if (state.view === "list") renderList(list);
    if (state.view === "calendar") renderCalendar(list);
    if (state.view === "map") {
      try {
        initMap();
      } catch (e) {
        // e.g. no WebGL — keep the rest of the page working
        console.error("races: map init failed", e);
      }
      if (map) map.resize();
      updateMap(list);
    }

    // Debounced: Safari throttles replaceState (slider drags fire many inputs)
    clearTimeout(urlTimer);
    urlTimer = setTimeout(writeURL, 200);
  }

  let urlTimer = null;

  // ─── URL state ─────────────────────────────────────────────────────────────
  // ?view=calendar&type=trail&min=13.1&max=31.1&from=2026-11-01&to=2027-03-31&month=2026-12
  // Defaults are omitted so the bare /races/ URL means "everything upcoming".

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function nearestStop(mi) {
    let best = 0;
    DISTANCE_STOPS.forEach((s, i) => {
      if (Math.abs(s.mi - mi) < Math.abs(DISTANCE_STOPS[best].mi - mi)) best = i;
    });
    return best;
  }

  function writeURL() {
    const p = new URLSearchParams();
    if (state.view !== "list") p.set("view", state.view);
    if (state.types.size === 1) p.set("type", [...state.types][0]);
    if (state.types.size === 0) p.set("type", "none");
    if (state.distMin !== 0) p.set("min", DISTANCE_STOPS[state.distMin].mi);
    if (state.distMax !== LAST_STOP) p.set("max", DISTANCE_STOPS[state.distMax].mi);
    if (state.from && state.from !== todayStr) p.set("from", state.from);
    if (state.to) p.set("to", state.to);
    if (state.view === "calendar" && state.calMonth) {
      p.set("month", state.calMonth.y + "-" + String(state.calMonth.m + 1).padStart(2, "0"));
    }
    const qs = p.toString().replace(/%2C/g, ",");
    const url = location.pathname + (qs ? "?" + qs : "");
    if (url !== location.pathname + location.search || location.hash) {
      history.replaceState(null, "", url);
    }
  }

  function readURL() {
    const p = new URLSearchParams(location.search);

    // Legacy #map / #calendar links
    state.view = p.get("view") || location.hash.slice(1) || "list";

    const type = p.get("type");
    if (type === "trail" || type === "road") state.types = new Set([type]);
    else if (type === "none") state.types = new Set();

    const min = parseFloat(p.get("min"));
    const max = parseFloat(p.get("max"));
    if (!isNaN(min)) els.distMin.value = nearestStop(min);
    if (!isNaN(max)) els.distMax.value = nearestStop(max);
    if (Number(els.distMin.value) > Number(els.distMax.value)) {
      [els.distMin.value, els.distMax.value] = [els.distMax.value, els.distMin.value];
    }

    const from = p.get("from");
    const to = p.get("to");
    // Shared links can go stale — never show races before today
    if (from && DATE_RE.test(from)) state.from = from < todayStr ? todayStr : from;
    if (to && DATE_RE.test(to)) state.to = to < state.from ? "" : to;

    const month = /^(\d{4})-(\d{2})$/.exec(p.get("month") || "");
    if (month) state.calMonth = { y: Number(month[1]), m: Number(month[2]) - 1 };
  }

  function syncTypeChips() {
    els.typeChips.forEach((c) => {
      const on = state.types.has(c.dataset.type);
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // ─── Controls ──────────────────────────────────────────────────────────────

  function updateSlider(changed) {
    let lo = Number(els.distMin.value);
    let hi = Number(els.distMax.value);
    if (lo > hi) {
      if (changed === els.distMin) { lo = hi; els.distMin.value = lo; }
      else { hi = lo; els.distMax.value = hi; }
    }
    state.distMin = lo;
    state.distMax = hi;
    els.distFill.style.left = (lo / LAST_STOP) * 100 + "%";
    els.distFill.style.width = ((hi - lo) / LAST_STOP) * 100 + "%";
    els.distValMin.textContent = DISTANCE_STOPS[lo].label;
    els.distValMax.textContent = DISTANCE_STOPS[hi].label;
  }

  [els.distMin, els.distMax].forEach((input) => {
    input.addEventListener("input", () => { updateSlider(input); render(); });
  });

  els.typeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const t = chip.dataset.type;
      if (state.types.has(t)) state.types.delete(t); else state.types.add(t);
      syncTypeChips();
      render();
    });
  });

  function syncDateInputs() {
    els.from.value = state.from;
    els.to.value = state.to;
    els.from.min = todayStr;
    els.from.max = state.to || maxDate;
    els.to.min = state.from || todayStr;
    els.to.max = maxDate;
  }

  els.from.addEventListener("change", () => {
    state.from = els.from.value || todayStr;
    state.calMonth = null;
    state.calDay = null;
    syncDateInputs();
    render();
  });
  els.to.addEventListener("change", () => {
    state.to = els.to.value;
    syncDateInputs();
    render();
  });

  els.clear.addEventListener("click", () => {
    state.types = new Set(["trail", "road"]);
    syncTypeChips();
    els.distMin.value = 0;
    els.distMax.value = LAST_STOP;
    updateSlider();
    state.from = todayStr;
    state.to = "";
    state.calMonth = null;
    state.calDay = null;
    syncDateInputs();
    render();
  });

  if (els.toggle && els.panel) {
    els.toggle.addEventListener("click", () => {
      const open = els.panel.classList.toggle("open");
      els.toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function setView(view) {
    if (!["list", "calendar", "map"].includes(view)) view = "list";
    state.view = view;
    els.viewBtns.forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    render();
  }

  els.viewBtns.forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  // ─── Subscribe menu ────────────────────────────────────────────────────────

  const subscribe = $("subscribe");
  if (subscribe) {
    document.addEventListener("click", (e) => {
      if (subscribe.open && !subscribe.contains(e.target)) subscribe.open = false;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && subscribe.open) {
        subscribe.open = false;
        subscribe.querySelector("summary").focus();
      }
    });
    subscribe.querySelectorAll(".subscribe-copy").forEach((btn) => {
      btn.addEventListener("click", () => {
        const done = (msg) => {
          btn.textContent = msg;
          setTimeout(() => { btn.textContent = "Copy link"; }, 1600);
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(btn.dataset.copy).then(() => done("Copied!"), () => window.prompt("Calendar URL:", btn.dataset.copy));
        } else {
          window.prompt("Calendar URL:", btn.dataset.copy);
        }
      });
    });
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  readURL();
  syncTypeChips();
  updateSlider();
  syncDateInputs();

  function start() { setView(state.view); }

  // maplibre loads with `defer` before this script, but guard for slow loads on the map view
  if (state.view === "map" && typeof maplibregl === "undefined") {
    window.addEventListener("load", start);
  } else {
    start();
  }
})();
