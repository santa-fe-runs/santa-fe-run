/**
 * Run Santa Fe — client-side search & filter
 *
 * Works entirely on pre-rendered run cards via data attributes.
 * No fetch required — all data is embedded by Jekyll at build time.
 */
(function () {
  "use strict";

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    keyword: "",
    distanceMin: 0,
    distanceMax: 30,
    elevationMin: 0,
    elevationMax: 6000,
    altitudeMin: 5000,
    altitudeMax: 14000,
    difficulties: new Set(["green", "blue", "black", "double-black", "extreme"]),
    selectedDate: "",
  };

  // ─── DOM refs ─────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const els = {
    heroSearch:      $("hero-search"),
    filterKeyword:   $("filter-keyword"),
    filterDate:      $("filter-date"),
    dateClear:       $("date-clear"),
    filtersClear:    $("filters-clear"),
    filtersToggle:   $("filters-toggle"),
    filtersPanel:    $("filters-panel"),
    runGrid:         $("run-grid"),
    resultsCount:    $("results-count"),
    noResults:       $("no-results"),
    activeCount:     $("filter-active-count"),
    diffChips:       document.querySelectorAll(".diff-chip"),
  };

  // ─── Range slider helpers ─────────────────────────────────────────────────────

  function formatVal(val, unit) {
    const n = parseFloat(val);
    if (unit === "mi") return n % 1 === 0 ? n + " mi" : n.toFixed(1) + " mi";
    if (unit === "ft") return n.toLocaleString() + " ft";
    return String(n);
  }

  function updateSliderUI(slider) {
    const minInput = slider.querySelector("input:first-of-type");
    const maxInput = slider.querySelector("input:last-of-type");
    const fill      = slider.querySelector(".range-fill");
    const minLabel  = slider.querySelector(".range-val:first-of-type");
    const maxLabel  = slider.querySelector(".range-val:last-of-type");

    const absMin = parseFloat(slider.dataset.min);
    const absMax = parseFloat(slider.dataset.max);
    const unit   = slider.dataset.unit;

    let minVal = parseFloat(minInput.value);
    let maxVal = parseFloat(maxInput.value);

    // Prevent crossing
    if (minVal > maxVal) {
      if (document.activeElement === minInput) {
        minInput.value = maxVal;
        minVal = maxVal;
      } else {
        maxInput.value = minVal;
        maxVal = minVal;
      }
    }

    const range = absMax - absMin;
    const leftPct  = ((minVal - absMin) / range) * 100;
    const rightPct = ((maxVal - absMin) / range) * 100;

    fill.style.left  = leftPct + "%";
    fill.style.width = (rightPct - leftPct) + "%";

    if (minLabel) minLabel.textContent = formatVal(minVal, unit);
    if (maxLabel) maxLabel.textContent = formatVal(maxVal, unit);
  }

  function initSliders() {
    document.querySelectorAll(".range-slider").forEach((slider) => {
      const inputs = slider.querySelectorAll("input[type='range']");
      updateSliderUI(slider);

      inputs.forEach((input) => {
        input.addEventListener("input", () => {
          updateSliderUI(slider);
          readSliders();
          applyFilters();
        });
      });
    });
  }

  function readSliders() {
    const ds = $("slider-distance");
    const es = $("slider-elevation");
    const as = $("slider-altitude");

    if (ds) {
      const [mn, mx] = ds.querySelectorAll("input");
      state.distanceMin = parseFloat(mn.value);
      state.distanceMax = parseFloat(mx.value);
    }
    if (es) {
      const [mn, mx] = es.querySelectorAll("input");
      state.elevationMin = parseFloat(mn.value);
      state.elevationMax = parseFloat(mx.value);
    }
    if (as) {
      const [mn, mx] = as.querySelectorAll("input");
      state.altitudeMin = parseFloat(mn.value);
      state.altitudeMax = parseFloat(mx.value);
    }
  }

  // ─── Date helpers ─────────────────────────────────────────────────────────────

  /**
   * Returns true if the given date string (YYYY-MM-DD) falls within
   * any of the run's best_dates ranges (MM-DD, year-agnostic).
   * Handles year-wrapping ranges (e.g. Nov–Feb).
   */
  function dateInSeason(dateStr, bestDates) {
    if (!dateStr || !bestDates || bestDates.length === 0) return true;

    const parts = dateStr.split("-");
    const month = parseInt(parts[1], 10);
    const day   = parseInt(parts[2], 10);
    const mmdd  = month * 100 + day; // e.g. 415 = April 15

    return bestDates.some(function (range) {
      const s = range.start.split("-");
      const e = range.end.split("-");
      const startMMDD = parseInt(s[0], 10) * 100 + parseInt(s[1], 10);
      const endMMDD   = parseInt(e[0], 10) * 100 + parseInt(e[1], 10);

      if (startMMDD <= endMMDD) {
        return mmdd >= startMMDD && mmdd <= endMMDD;
      } else {
        // Wraps year boundary (e.g. Nov–Mar)
        return mmdd >= startMMDD || mmdd <= endMMDD;
      }
    });
  }

  // ─── Card filtering ───────────────────────────────────────────────────────────

  function cardMatches(card) {
    const d = card.dataset;

    // Keyword
    if (state.keyword) {
      const text = (d.searchText || "").toLowerCase();
      if (!text.includes(state.keyword)) return false;
    }

    // Distance
    const dist = parseFloat(d.distance || 0);
    if (dist < state.distanceMin || dist > state.distanceMax) return false;

    // Elevation
    const elev = parseFloat(d.elevation || 0);
    if (elev < state.elevationMin || elev > state.elevationMax) return false;

    // Altitude — card's range must overlap the filter's range
    const altMin = parseFloat(d.altitudeMin || 0);
    const altMax = parseFloat(d.altitudeMax || 0);
    if (altMax < state.altitudeMin || altMin > state.altitudeMax) return false;

    // Difficulty
    if (!state.difficulties.has(d.difficulty)) return false;

    // Date
    if (state.selectedDate) {
      let bestDates = [];
      try {
        bestDates = JSON.parse(decodeURIComponent(d.bestDates || "%5B%5D"));
      } catch (_) { /* ignore malformed */ }
      if (!dateInSeason(state.selectedDate, bestDates)) return false;
    }

    return true;
  }

  function applyFilters() {
    const cards = els.runGrid
      ? els.runGrid.querySelectorAll(".run-card")
      : [];

    let visible = 0;

    cards.forEach(function (card, i) {
      const show = cardMatches(card);
      card.hidden = !show;
      if (show) {
        card.style.setProperty("--anim-delay", (visible * 0.035) + "s");
        // Re-trigger animation by force-reflow
        void card.offsetWidth;
        visible++;
      }
    });

    if (els.resultsCount) {
      els.resultsCount.textContent = visible;
    }

    if (els.noResults) {
      els.noResults.classList.toggle("visible", visible === 0);
    }

    updateClearButton();
  }

  // ─── "Filters active" state ───────────────────────────────────────────────────

  function isDefaultState() {
    return (
      state.keyword === "" &&
      state.distanceMin === 0 &&
      state.distanceMax === 30 &&
      state.elevationMin === 0 &&
      state.elevationMax === 6000 &&
      state.altitudeMin === 5000 &&
      state.altitudeMax === 14000 &&
      state.difficulties.size === 4 &&
      state.selectedDate === ""
    );
  }

  function countActiveFilters() {
    let n = 0;
    if (state.keyword !== "")      n++;
    if (state.distanceMin !== 0 || state.distanceMax !== 30)      n++;
    if (state.elevationMin !== 0 || state.elevationMax !== 6000)  n++;
    if (state.altitudeMin !== 5000 || state.altitudeMax !== 14000) n++;
    if (state.difficulties.size !== 4) n++;
    if (state.selectedDate !== "")  n++;
    return n;
  }

  function updateClearButton() {
    const count = countActiveFilters();
    if (els.filtersClear) {
      els.filtersClear.classList.toggle("visible", count > 0);
    }
    if (els.activeCount) {
      const show = count > 0;
      els.activeCount.hidden = !show;
      els.activeCount.textContent = show ? count : "";
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  function resetAll() {
    state.keyword       = "";
    state.distanceMin   = 0;
    state.distanceMax   = 30;
    state.elevationMin  = 0;
    state.elevationMax  = 6000;
    state.altitudeMin   = 5000;
    state.altitudeMax   = 14000;
    state.selectedDate  = "";
    state.difficulties  = new Set(["green", "blue", "black", "double-black", "extreme"]);

    // Reset inputs
    if (els.heroSearch)    els.heroSearch.value    = "";
    if (els.filterKeyword) els.filterKeyword.value = "";
    if (els.filterDate)    els.filterDate.value    = "";
    if (els.dateClear)     els.dateClear.classList.remove("visible");

    // Reset sliders
    const resetSlider = function (id, minVal, maxVal) {
      const slider = $(id);
      if (!slider) return;
      const [mn, mx] = slider.querySelectorAll("input");
      mn.value = minVal;
      mx.value = maxVal;
      updateSliderUI(slider);
    };
    resetSlider("slider-distance",  0,    30);
    resetSlider("slider-elevation", 0,    6000);
    resetSlider("slider-altitude",  5000, 14000);

    // Reset difficulty chips
    els.diffChips.forEach(function (chip) {
      chip.classList.add("active");
      chip.setAttribute("aria-pressed", "true");
    });

    applyFilters();
  }

  // ─── Event bindings ───────────────────────────────────────────────────────────

  function bind() {
    // Hero search ↔ sidebar keyword (keep in sync)
    function syncKeyword(val) {
      state.keyword = val.trim().toLowerCase();
      if (els.heroSearch    && els.heroSearch.value    !== val) els.heroSearch.value    = val;
      if (els.filterKeyword && els.filterKeyword.value !== val) els.filterKeyword.value = val;
      applyFilters();
    }

    if (els.heroSearch) {
      els.heroSearch.addEventListener("input", function () {
        syncKeyword(this.value);
      });
    }
    if (els.filterKeyword) {
      els.filterKeyword.addEventListener("input", function () {
        syncKeyword(this.value);
      });
    }

    // Difficulty chips
    els.diffChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        const diff = this.dataset.diff;
        const active = this.classList.toggle("active");
        this.setAttribute("aria-pressed", String(active));

        if (active) {
          state.difficulties.add(diff);
        } else {
          state.difficulties.delete(diff);
        }
        applyFilters();
      });
    });

    // Date filter
    if (els.filterDate) {
      els.filterDate.addEventListener("change", function () {
        state.selectedDate = this.value;
        if (els.dateClear) {
          els.dateClear.classList.toggle("visible", !!this.value);
        }
        applyFilters();
      });
    }
    if (els.dateClear) {
      els.dateClear.addEventListener("click", function () {
        state.selectedDate = "";
        if (els.filterDate) els.filterDate.value = "";
        this.classList.remove("visible");
        applyFilters();
      });
    }

    // Clear all
    if (els.filtersClear) {
      els.filtersClear.addEventListener("click", resetAll);
    }

    // Mobile filter toggle
    if (els.filtersToggle && els.filtersPanel) {
      els.filtersToggle.addEventListener("click", function () {
        const open = els.filtersPanel.classList.toggle("open");
        this.setAttribute("aria-expanded", String(open));
      });
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    initSliders();
    bind();
    applyFilters(); // Set initial count / animations
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
