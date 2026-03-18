---
layout: default
title: "Climate"
description: "How snowy? How wet?"
permalink: /climate/
noindex: true
---

<div class="guide-page">
  <div class="guide-hero">
    <div class="container">
      <h1 class="guide-title">Climate</h1>
      <p class="guide-subtitle">How Snowy? How Wet? How Hot?</p>
    </div>
  </div>

  <div class="guide-body">
    <div class="container">
      <h2 class="climate-section-title">Period of Record</h2>
      <div class="climate-toggle" role="group" aria-label="Select dataset">
        <button class="climate-btn active" data-key="prec">Total Precipitation</button>
        <button class="climate-btn" data-key="wteq">Snow Water Equivalent</button>
      </div>
      <div class="climate-chart-wrap">
        <canvas id="prec-chart" aria-label="Santa Fe climate chart" role="img"></canvas>
        <p class="climate-loading" id="prec-status">Loading&hellip;</p>
      </div>
      <p class="climate-source">
        Data: <a href="https://www.nrcs.usda.gov/wps/portal/wcc/home/" target="_blank" rel="noopener">NRCS AWDB</a> &mdash; Santa Fe SNOTEL station &mdash; fetched live on page load.
      </p>

      <h2 class="climate-section-title">Seasonal Outlook</h2>
      <div class="climate-outlook-header">
        <label class="climate-outlook-label" for="outlook-select">Period</label>
        <select id="outlook-select" class="climate-outlook-select"></select>
      </div>
      <div class="climate-outlooks">
        <figure class="climate-outlook-item">
          <figcaption class="climate-outlook-title">Temperature</figcaption>
          <img id="outlook-temp" alt="NOAA CPC 3-month temperature outlook map" class="climate-outlook-img">
        </figure>
        <figure class="climate-outlook-item">
          <figcaption class="climate-outlook-title">Precipitation</figcaption>
          <img id="outlook-prcp" alt="NOAA CPC 3-month precipitation outlook map" class="climate-outlook-img">
        </figure>
      </div>
      <p class="climate-source">
        Outlooks: <a href="https://www.cpc.ncep.noaa.gov/" target="_blank" rel="noopener">NOAA Climate Prediction Center</a>
      </p>
    </div>
  </div>
</div>

<style>
.climate-section-title {
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 2.5vw, 1.6rem);
  font-weight: 500;
  color: var(--earth);
  margin-bottom: var(--sp-4);
  padding-bottom: var(--sp-3);
  border-bottom: 1px solid var(--tan-light);
}
.climate-section-title + * {
  margin-top: 0;
}
.climate-chart-wrap {
  position: relative;
  background: var(--sand-light);
  border: 1px solid var(--tan-light);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  margin-bottom: var(--sp-4);
}
.climate-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body);
  color: var(--earth-light);
  font-size: 0.9rem;
  pointer-events: none;
}
.climate-source {
  font-size: 0.8rem;
  color: var(--earth-light);
  text-align: right;
  margin-top: var(--sp-2);
}
.climate-source a {
  color: var(--earth-mid);
}
.climate-toggle {
  display: flex;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}
.climate-btn {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  padding: var(--sp-2) var(--sp-5);
  border-radius: var(--radius-full);
  border: 1.5px solid var(--tan-light);
  background: transparent;
  color: var(--earth-mid);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}
.climate-btn:hover {
  border-color: var(--forest-mid);
  color: var(--forest-mid);
}
.climate-btn.active {
  background: var(--forest);
  border-color: var(--forest);
  color: #fff;
}
.climate-outlook-header {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-bottom: var(--sp-4);
}
h2.climate-section-title + .climate-outlook-header {
  margin-top: 0;
}
.climate-section-title:not(:first-child) {
  margin-top: var(--sp-12);
}
.climate-outlook-label {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--earth-mid);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.climate-outlook-select {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--earth);
  background: var(--sand-light);
  border: 1.5px solid var(--tan-light);
  border-radius: var(--radius-full);
  padding: var(--sp-2) var(--sp-5);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235C4B2E' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--sp-4) center;
  padding-right: var(--sp-10);
  transition: border-color var(--transition-fast);
}
.climate-outlook-select:hover,
.climate-outlook-select:focus {
  border-color: var(--forest-mid);
  outline: none;
}
.climate-outlooks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-6);
}
@media (max-width: 600px) {
  .climate-outlooks {
    grid-template-columns: 1fr;
  }
}
.climate-outlook-item {
  margin: 0;
}
.climate-outlook-title {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--earth-mid);
  margin-bottom: var(--sp-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.climate-outlook-img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: var(--radius-md);
  border: 1px solid var(--tan-light);
}
</style>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js" integrity="sha384-NrKB+u6Ts6AtkIhwPixiKTzgSKNblyhlk0Sohlgar9UHUBzai/sgnNNWWd291xqt" crossorigin="anonymous"></script>
<script>
(function () {
  const DATASETS = {
    prec: {
      url:    'https://nwcc-apps.sc.egov.usda.gov/awdb/site-plots/POR/PREC/NM/Santa%20Fe.json',
      yLabel: 'Cumulative precipitation (inches)',
    },
    wteq: {
      url:    'https://nwcc-apps.sc.egov.usda.gov/awdb/site-plots/POR/WTEQ/NM/Santa%20Fe.json',
      yLabel: 'Snow water equivalent (inches)',
    },
  };

  const COLORS = {
    band10_90:  'rgba(100, 180, 255, 0.18)',
    band30_70:  'rgba(60,  140, 230, 0.30)',
    historical: 'rgba(158, 132, 104, 0.25)',
    medianPor:  '#1B3A14',
    median9120: '#C07A00',
    current:    '#D93025',
    minmax:     'rgba(90, 70, 40, 0.50)',
  };

  const MONTH_NAMES  = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'];
  const MONTH_STARTS = ['10-01','11-01','12-01','01-01','02-01','03-01','04-01','05-01','06-01','07-01','08-01','09-01'];

  const cache = {};
  let chart = null;
  let activeKey = 'prec';

  function series(data, key, trimTrailing) {
    const vals = data.map(r => r[key] ?? null);
    if (!trimTrailing) return vals;
    let last = -1;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] !== null && vals[i] > 0) last = i;
      if (vals[i] === 0 && i < 10) last = i;
    }
    return vals.map((v, i) => (i <= last ? v : null));
  }

  function buildDatasets(data, currentYear, historicalYears) {
    const ds = [];

    // 10–90% band (filled between two anchor lines)
    ds.push({ label: '10th percentile', data: series(data, '10%'), borderWidth: 0, pointRadius: 0, fill: false, backgroundColor: 'transparent', borderColor: 'transparent', order: 10 });
    ds.push({ label: '10%–90% band',    data: series(data, '90%'), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: COLORS.band10_90, borderColor: 'transparent', order: 10 });

    // 30–70% band
    ds.push({ label: '30th percentile', data: series(data, '30%'), borderWidth: 0, pointRadius: 0, fill: false, backgroundColor: 'transparent', borderColor: 'transparent', order: 9 });
    ds.push({ label: '30%–70% band',    data: series(data, '70%'), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: COLORS.band30_70, borderColor: 'transparent', order: 9 });

    // Historical year lines
    for (const yr of historicalYears) {
      ds.push({ label: yr, data: series(data, yr), borderColor: COLORS.historical, borderWidth: 1, pointRadius: 0, fill: false, tension: 0.2, order: 8 });
    }

    // Min / Max
    ds.push({ label: 'Max', data: series(data, 'Max'), borderColor: COLORS.minmax, borderWidth: 1, borderDash: [3, 4], pointRadius: 0, fill: false, order: 7 });
    ds.push({ label: 'Min', data: series(data, 'Min'), borderColor: COLORS.minmax, borderWidth: 1, borderDash: [3, 4], pointRadius: 0, fill: false, order: 7 });

    // Medians
    ds.push({ label: 'Median (POR)',     data: series(data, 'Median (POR)'),      borderColor: COLORS.medianPor,  borderWidth: 2.5, borderDash: [8, 5], pointRadius: 0, fill: false, tension: 0.2, order: 6 });
    ds.push({ label: "Median ('91–'20)", data: series(data, "Median ('91-'20)"),  borderColor: COLORS.median9120, borderWidth: 2.5, borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0.2, order: 5 });

    // Current year
    ds.push({ label: `${currentYear} (current)`, data: series(data, currentYear, true), borderColor: COLORS.current, borderWidth: 3, pointRadius: 0, fill: false, tension: 0.2, order: 1 });

    return ds;
  }

  async function loadAndRender(key) {
    const statusEl = document.getElementById('prec-status');
    const canvas   = document.getElementById('prec-chart');
    const cfg      = DATASETS[key];

    if (!cache[key]) {
      statusEl.style.display = 'flex';
      statusEl.textContent = 'Loading\u2026';
      try {
        const res = await fetch(cfg.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cache[key] = await res.json();
      } catch (e) {
        statusEl.textContent = 'Unable to load data.';
        return;
      }
    }
    statusEl.style.display = 'none';

    const data = cache[key];
    const labels = data.map(r => r.date);
    const yearKeys = Object.keys(data[0]).filter(k => /^\d{4}$/.test(k)).sort();
    const currentYear    = yearKeys[yearKeys.length - 1];
    const historicalYears = yearKeys.slice(0, -1);
    const legendItems = ['10%–90% band', '30%–70% band', 'Median (POR)', "Median ('91–'20)", `${currentYear} (current)`, 'Max', 'Min'];

    const datasets = buildDatasets(data, currentYear, historicalYears);

    if (chart) {
      chart.data.labels   = labels;
      chart.data.datasets = datasets;
      chart.options.plugins.legend.labels.filter = item => legendItems.includes(item.text);
      chart.options.scales.y.title.text = cfg.yLabel;
      chart.update('none');
    } else {
      chart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              labels: {
                filter: item => legendItems.includes(item.text),
                boxWidth: 24,
                boxHeight: 2,
                font: { family: "'DM Sans', system-ui, sans-serif", size: 11 },
                color: '#5C4B2E',
              },
            },
            tooltip: {
              filter: item => item.dataset.label !== '10th percentile' && item.dataset.label !== '30th percentile',
              callbacks: {
                title: ctx => {
                  const [mm, dd] = ctx[0].label.split('-');
                  const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  return `${months[parseInt(mm)]} ${parseInt(dd)}`;
                },
                label: ctx => {
                  const v = ctx.parsed.y;
                  if (v === null || v === undefined) return null;
                  return `${ctx.dataset.label}: ${v.toFixed(1)}"`;
                },
              },
              bodyFont:  { family: "'DM Sans', system-ui, sans-serif", size: 12 },
              titleFont: { family: "'DM Sans', system-ui, sans-serif", size: 12, weight: '600' },
              backgroundColor: 'rgba(245, 239, 230, 0.97)',
              titleColor: '#2C2416',
              bodyColor:  '#5C4B2E',
              borderColor: '#D9C08F',
              borderWidth: 1,
            },
          },
          scales: {
            x: {
              ticks: {
                maxRotation: 0,
                autoSkip: false,
                callback: function(val) {
                  const i = MONTH_STARTS.indexOf(this.getLabelForValue(val));
                  return i >= 0 ? MONTH_NAMES[i] : '';
                },
                font: { family: "'DM Sans', system-ui, sans-serif", size: 11 },
                color: '#7A6347',
              },
              grid: { color: 'rgba(217, 192, 143, 0.25)' },
            },
            y: {
              title: {
                display: true,
                text: cfg.yLabel,
                font: { family: "'DM Sans', system-ui, sans-serif", size: 11 },
                color: '#7A6347',
              },
              ticks: {
                font: { family: "'DM Sans', system-ui, sans-serif", size: 11 },
                color: '#7A6347',
                callback: v => `${v}"`,
              },
              grid: { color: 'rgba(217, 192, 143, 0.25)' },
            },
          },
        },
      });
    }
  }

  function initOutlookSelect() {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const currentMonth = new Date().getMonth(); // 0-indexed
    const sel = document.getElementById('outlook-select');

    for (let lead = 1; lead <= 13; lead++) {
      const m0 = (currentMonth + lead - 1) % 12;
      const m2 = (currentMonth + lead + 1) % 12;
      const n  = String(lead).padStart(2, '0');
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = `${MONTHS[m0]} – ${MONTHS[m2]}`;
      sel.appendChild(opt);
    }

    function updateOutlookImages(n) {
      const base = `https://www.cpc.ncep.noaa.gov/products/predictions/long_range/lead${n}`;
      document.getElementById('outlook-temp').src = `${base}/off${n}_temp.gif`;
      document.getElementById('outlook-prcp').src = `${base}/off${n}_prcp.gif`;
    }

    updateOutlookImages('01');
    sel.addEventListener('change', () => updateOutlookImages(sel.value));
  }

  function init() {
    document.querySelectorAll('.climate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === activeKey) return;
        activeKey = key;
        document.querySelectorAll('.climate-btn').forEach(b => b.classList.toggle('active', b.dataset.key === key));
        loadAndRender(key);
      });
    });
    loadAndRender('prec');
    initOutlookSelect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
