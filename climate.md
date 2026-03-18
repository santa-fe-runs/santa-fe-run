---
layout: default
title: "Climate"
description: "Santa Fe cumulative precipitation by water year, from the NRCS Snow Survey."
permalink: /climate/
noindex: true
---

<div class="guide-page">
  <div class="guide-hero">
    <div class="container">
      <h1 class="guide-title">Santa Fe Precipitation</h1>
      <p class="guide-subtitle">Cumulative water-year precipitation &mdash; period of record</p>
    </div>
  </div>

  <div class="guide-body">
    <div class="container">
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
    </div>
  </div>
</div>

<style>
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
