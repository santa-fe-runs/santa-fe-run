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
      <div class="climate-chart-wrap">
        <canvas id="prec-chart" aria-label="Santa Fe cumulative precipitation chart" role="img"></canvas>
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
</style>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js" integrity="sha384-NrKB+u6Ts6AtkIhwPixiKTzgSKNblyhlk0Sohlgar9UHUBzai/sgnNNWWd291xqt" crossorigin="anonymous"></script>
<script>
(function () {
  const DATA_URL = 'https://nwcc-apps.sc.egov.usda.gov/awdb/site-plots/POR/PREC/NM/Santa%20Fe.json';

  const COLORS = {
    band10_90: 'rgba(78, 138, 52, 0.12)',
    band30_70: 'rgba(78, 138, 52, 0.22)',
    historical: 'rgba(158, 132, 104, 0.18)',
    medianPor:  '#2D5A20',
    median9120: '#B99050',
    current:    '#4E8A34',
    minmax:     'rgba(158, 132, 104, 0.45)',
  };

  async function buildChart() {
    const statusEl = document.getElementById('prec-status');
    const canvas   = document.getElementById('prec-chart');
    let data;
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      statusEl.textContent = 'Unable to load precipitation data.';
      return;
    }
    statusEl.style.display = 'none';

    // --- Parse ---
    const labels = data.map(r => r.date); // "MM-DD"
    const yearKeys = Object.keys(data[0]).filter(k => /^\d{4}$/.test(k)).sort();
    // Current water year: last year key that has any non-zero data
    let currentYear = yearKeys[yearKeys.length - 1];
    // Historical = all years except current
    const historicalYears = yearKeys.slice(0, -1);

    function series(key, nullAfterZeroRun) {
      // For current year: stop at last observed value (null out trailing zeros)
      const vals = data.map(r => r[key] ?? null);
      if (!nullAfterZeroRun) return vals;
      let lastNonNull = -1;
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] !== null && vals[i] > 0) lastNonNull = i;
        // also keep zero if it's early in the year (first 10 days)
        if (vals[i] === 0 && i < 10) lastNonNull = i;
      }
      return vals.map((v, i) => (i <= lastNonNull ? v : null));
    }

    // --- Datasets ---
    const datasets = [];

    // 10-90% band
    datasets.push({
      label: '10th percentile',
      data: series('10%'),
      borderWidth: 0,
      pointRadius: 0,
      fill: false,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      order: 10,
    });
    datasets.push({
      label: '10%–90% band',
      data: series('90%'),
      borderWidth: 0,
      pointRadius: 0,
      fill: '-1',
      backgroundColor: COLORS.band10_90,
      borderColor: 'transparent',
      order: 10,
    });

    // 30-70% band
    datasets.push({
      label: '30th percentile',
      data: series('30%'),
      borderWidth: 0,
      pointRadius: 0,
      fill: false,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      order: 9,
    });
    datasets.push({
      label: '30%–70% band',
      data: series('70%'),
      borderWidth: 0,
      pointRadius: 0,
      fill: '-1',
      backgroundColor: COLORS.band30_70,
      borderColor: 'transparent',
      order: 9,
    });

    // Historical year lines
    for (const yr of historicalYears) {
      datasets.push({
        label: yr,
        data: series(yr),
        borderColor: COLORS.historical,
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        tension: 0.2,
        order: 8,
      });
    }

    // Min / Max
    datasets.push({
      label: 'Max',
      data: series('Max'),
      borderColor: COLORS.minmax,
      borderWidth: 1,
      borderDash: [3, 4],
      pointRadius: 0,
      fill: false,
      order: 7,
    });
    datasets.push({
      label: 'Min',
      data: series('Min'),
      borderColor: COLORS.minmax,
      borderWidth: 1,
      borderDash: [3, 4],
      pointRadius: 0,
      fill: false,
      order: 7,
    });

    // Median (POR)
    datasets.push({
      label: 'Median (POR)',
      data: series('Median (POR)'),
      borderColor: COLORS.medianPor,
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
      tension: 0.2,
      order: 6,
    });

    // Median ('91-'20)
    datasets.push({
      label: "Median ('91–'20)",
      data: series("Median ('91-'20)"),
      borderColor: COLORS.median9120,
      borderWidth: 2,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      tension: 0.2,
      order: 5,
    });

    // Current year
    datasets.push({
      label: `${currentYear} (current)`,
      data: series(currentYear, true),
      borderColor: COLORS.current,
      borderWidth: 2.5,
      pointRadius: 0,
      fill: false,
      tension: 0.2,
      order: 1,
    });

    // --- X-axis labels: month names at the 1st of each month ---
    const MONTH_NAMES = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'];
    const MONTH_STARTS = ['10-01','11-01','12-01','01-01','02-01','03-01','04-01','05-01','06-01','07-01','08-01','09-01'];

    new Chart(canvas, {
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
              filter: item => ['10%–90% band','30%–70% band','Median (POR)',"Median ('91–'20)",`${currentYear} (current)`,'Max','Min'].includes(item.text),
              boxWidth: 24,
              boxHeight: 2,
              font: { family: "'DM Sans', system-ui, sans-serif", size: 11 },
              color: '#5C4B2E',
              usePointStyle: false,
            },
          },
          tooltip: {
            filter: item => item.dataset.label !== '10th percentile' && item.dataset.label !== '30th percentile',
            callbacks: {
              title: ctx => {
                const date = ctx[0].label; // MM-DD
                const [mm, dd] = date.split('-');
                const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return `${months[parseInt(mm)]} ${parseInt(dd)}`;
              },
              label: ctx => {
                const v = ctx.parsed.y;
                if (v === null || v === undefined) return null;
                return `${ctx.dataset.label}: ${v.toFixed(1)}"`;
              },
            },
            bodyFont: { family: "'DM Sans', system-ui, sans-serif", size: 12 },
            titleFont: { family: "'DM Sans', system-ui, sans-serif", size: 12, weight: '600' },
            backgroundColor: 'rgba(245, 239, 230, 0.97)',
            titleColor: '#2C2416',
            bodyColor: '#5C4B2E',
            borderColor: '#D9C08F',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              autoSkip: false,
              callback: function(val, idx) {
                const label = this.getLabelForValue(val);
                const i = MONTH_STARTS.indexOf(label);
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
              text: 'Cumulative precipitation (inches)',
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildChart);
  } else {
    buildChart();
  }
})();
</script>
