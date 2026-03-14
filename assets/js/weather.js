(function () {
  'use strict';

  var card = document.getElementById('weather-forecast');
  if (!card) return;

  var lat = Number(card.dataset.lat).toFixed(4);
  var lng = Number(card.dataset.lng).toFixed(4);
  var nwsLink = 'https://forecast.weather.gov/MapClick.php?lat=' + lat + '&lon=' + lng;

  var GRID_KEY     = 'nws-grid:' + lat + ',' + lng;
  var FORECAST_KEY = 'nws-forecast:' + lat + ',' + lng;
  var FORECAST_TTL = 60 * 60 * 1000; // 1 hour

  // sessionStorage may throw in some private browsing modes; fall through to always fetch if so
  function storageGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }
  function storageSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (_) {}
  }

  // Escape HTML special characters to prevent XSS when building innerHTML strings
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function run() {
    getGridForecastUrl()
      .then(function (forecastUrl) { return getForecastPeriods(forecastUrl); })
      .then(function (periods) { render(pairPeriods(periods)); })
      .catch(function () { renderError(); });
  }

  function getGridForecastUrl() {
    var cached = storageGet(GRID_KEY);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.forecastUrl) return Promise.resolve(parsed.forecastUrl);
      } catch (_) {}
    }
    return fetch('https://api.weather.gov/points/' + lat + ',' + lng, {
      headers: { Accept: 'application/geo+json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('points ' + res.status);
      return res.json();
    }).then(function (data) {
      var forecastUrl = data && data.properties && data.properties.forecast;
      if (!forecastUrl) throw new Error('no forecast url');
      storageSet(GRID_KEY, JSON.stringify({ forecastUrl: forecastUrl }));
      return forecastUrl;
    });
  }

  function getForecastPeriods(forecastUrl) {
    var cached = storageGet(FORECAST_KEY);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.periods && Date.now() - parsed.ts < FORECAST_TTL) {
          return Promise.resolve(parsed.periods);
        }
      } catch (_) {}
    }
    return fetch(forecastUrl, {
      headers: { Accept: 'application/geo+json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('forecast ' + res.status);
      return res.json();
    }).then(function (data) {
      var periods = data && data.properties && data.properties.periods;
      if (!Array.isArray(periods)) throw new Error('no periods');
      storageSet(FORECAST_KEY, JSON.stringify({ periods: periods, ts: Date.now() }));
      return periods;
    });
  }

  // Pair daytime periods with their following nighttime period for low temps
  function pairPeriods(periods) {
    var pairs = [];
    var i = 0;
    while (i < periods.length && pairs.length < 7) {
      if (periods[i].isDaytime) {
        var hasNight = (i + 1 < periods.length && !periods[i + 1].isDaytime);
        pairs.push({ day: periods[i], night: hasNight ? periods[i + 1] : null });
        i += hasNight ? 2 : 1;
      } else {
        i++; // skip leading night period (e.g. page loaded after sunset)
      }
    }
    return pairs;
  }

  function shortDayName(name) {
    if (name === 'Today' || name === 'This Afternoon') return 'Today';
    var word = name.split(' ')[0];
    var map = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
    return map[word] || word;
  }

  function precipStr(period) {
    var v = period.probabilityOfPrecipitation && period.probabilityOfPrecipitation.value;
    return (v != null) ? v + '%' : '—';
  }

  function smallIconUrl(url) {
    return url.replace(/size=\w+/, 'size=small');
  }

  function render(pairs) {
    var rows = pairs.map(function (pair) {
      var day = pair.day;
      var night = pair.night;
      var lowStr = night ? night.temperature + '°' : '—';
      return '<div class="weather-row">' +
        '<span class="weather-day">' + esc(shortDayName(day.name)) + '</span>' +
        '<img class="weather-icon" src="' + esc(smallIconUrl(day.icon)) + '" alt="' + esc(day.shortForecast) + '" title="' + esc(day.shortForecast) + '" width="32" height="32">' +
        '<span class="weather-desc">' + esc(day.shortForecast) + '</span>' +
        '<span class="weather-temps"><span class="weather-high">' + esc(String(day.temperature)) + '°</span><span class="weather-low">' + esc(lowStr) + '</span></span>' +
        '<span class="weather-precip" title="Precipitation chance">💧' + esc(precipStr(day)) + '</span>' +
        '<span class="weather-wind" title="' + esc(day.windSpeed) + '">' + esc(day.windDirection) + '</span>' +
        '</div>';
    }).join('');

    card.setAttribute('aria-busy', 'false');
    card.innerHTML =
      '<h3 class="metadata-heading">Weather Forecast</h3>' +
      '<div class="weather-rows">' + rows + '</div>' +
      '<p class="weather-note"><a href="' + esc(nwsLink) + '" target="_blank" rel="noopener noreferrer">Full NWS forecast ↗</a></p>';
  }

  function renderError() {
    card.setAttribute('aria-busy', 'false');
    card.innerHTML =
      '<h3 class="metadata-heading">Weather Forecast</h3>' +
      '<p class="weather-error">Forecast unavailable. <a href="' + esc(nwsLink) + '" target="_blank" rel="noopener noreferrer" class="inline-link">Check NWS directly ↗</a></p>';
  }

  run();
}());
