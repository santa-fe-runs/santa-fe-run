---
layout: default
title: "Races"
description: "Upcoming trail and road races across New Mexico, pulled from RunSignup and UltraSignup."
permalink: /races/
uses_map: true
---

<div class="guide-hero">
  <div class="container">
    <h1 class="guide-title">Races</h1>
    <p class="guide-subtitle">Upcoming trail and road races across New Mexico</p>
  </div>
</div>

<div class="home-content races-content">
  <div class="container">

    <!-- Filter Sidebar -->
    <aside class="home-filters" aria-label="Filter races">

      <button class="filters-toggle" id="filters-toggle" aria-expanded="false" aria-controls="filters-panel">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Filter Races
        <span id="filter-active-count" class="filter-badge" hidden></span>
      </button>

      <div class="filters-panel" id="filters-panel" role="group" aria-label="Filter options">

        <div class="filters-header">
          <span class="filters-title">Filters</span>
          <button class="filters-clear" id="filters-clear" aria-label="Clear all filters">Clear all</button>
        </div>

        <!-- Type -->
        <div class="filter-group">
          <span class="filter-label" id="type-label">Type</span>
          <div class="type-chips" role="group" aria-labelledby="type-label">
            <button class="type-chip active" type="button" data-type="trail" aria-pressed="true">Trail</button>
            <button class="type-chip active" type="button" data-type="road" aria-pressed="true">Road</button>
          </div>
        </div>

        <!-- Distance (slider indexes into DISTANCE_STOPS in races.js) -->
        <div class="filter-group">
          <span class="filter-label" id="distance-label">Distance</span>
          <div class="range-slider" id="slider-distance" aria-labelledby="distance-label">
            <div class="range-track">
              <div class="range-fill" id="fill-distance"></div>
            </div>
            <input type="range" class="range-thumb" id="distance-min" min="0" max="11" step="1" value="0" aria-label="Minimum distance">
            <input type="range" class="range-thumb" id="distance-max" min="0" max="11" step="1" value="11" aria-label="Maximum distance">
            <div class="range-values">
              <span class="range-val" id="distance-val-min">0 mi</span>
              <span class="range-val" id="distance-val-max">100+ mi</span>
            </div>
          </div>
        </div>

        <!-- Date range -->
        <div class="filter-group">
          <span class="filter-label">Dates</span>
          <div class="date-range">
            <label class="date-range-field">
              <span class="date-range-label">From</span>
              <input id="filter-date-from" class="filter-date" type="date" aria-label="Races on or after">
            </label>
            <label class="date-range-field">
              <span class="date-range-label">To</span>
              <input id="filter-date-to" class="filter-date" type="date" aria-label="Races on or before">
            </label>
          </div>
        </div>

      </div><!-- /filters-panel -->
    </aside>

    <!-- Results -->
    <section class="home-results" aria-label="Race results">
      <div class="results-bar">
        <p class="results-count" aria-live="polite">
          Showing <strong id="results-count">0</strong> <span id="results-noun">races</span>
        </p>
        <div class="results-actions">
          <details class="subscribe" id="subscribe">
            <summary class="subscribe-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              Subscribe
            </summary>
            <div class="subscribe-menu">
              <p class="subscribe-intro">Add races to your calendar. New races show up automatically.</p>
              {% assign feed_base = site.url | append: site.baseurl | append: "/races/" %}
              {% assign feeds = "all:All races,trail:Trail races,road:Road races" | split: "," %}
              {% for f in feeds %}
                {% assign parts = f | split: ":" %}
                {% assign https_url = feed_base | append: parts[0] | append: ".ics" %}
                {% assign webcal_url = https_url | replace: "https://", "webcal://" | replace: "http://", "webcal://" %}
              <div class="subscribe-row">
                <span class="subscribe-name">{{ parts[1] }}</span>
                <div class="subscribe-links">
                  <a href="https://calendar.google.com/calendar/render?cid={{ webcal_url | url_encode }}" target="_blank" rel="noopener">Google</a>
                  <a href="{{ webcal_url }}">Apple / Outlook</a>
                  <button type="button" class="subscribe-copy" data-copy="{{ https_url }}">Copy link</button>
                </div>
              </div>
              {% endfor %}
              <p class="subscribe-note">Google re-checks subscribed calendars on its own schedule, usually within a day.</p>
            </div>
          </details>

          <div class="view-toggle" role="tablist" aria-label="Display">
            <button class="view-btn active" type="button" role="tab" data-view="list" aria-selected="true">List</button>
            <button class="view-btn" type="button" role="tab" data-view="calendar" aria-selected="false">Calendar</button>
            <button class="view-btn" type="button" role="tab" data-view="map" aria-selected="false">Map</button>
          </div>
        </div>
      </div>

      <div id="races-list" class="races-view races-list"></div>
      <div id="races-calendar" class="races-view races-calendar" hidden></div>
      <div id="races-map-wrap" class="races-view" hidden>
        <div id="races-map" class="races-map" aria-label="Map of upcoming races"></div>
        <p class="map-note" id="races-map-note"></p>
      </div>

      <div class="no-results" id="no-results" role="status">
        <div class="no-results-icon" aria-hidden="true">🏁</div>
        <h3>No races found</h3>
        <p>Try adjusting your filters or widening the date range.</p>
      </div>

      <p class="races-source">
        Race data from <a href="https://runsignup.com" target="_blank" rel="noopener">RunSignup</a>
        and <a href="https://ultrasignup.com" target="_blank" rel="noopener">UltraSignup</a>{% if site.data.races.fetched_at %}, updated {{ site.data.races.fetched_at | date: "%b %-d, %Y" }}{% endif %}.
        Trail/road is a best guess &mdash; check the race page for details.
      </p>
    </section>

  </div>
</div>

<script type="application/json" id="races-data">{{ site.data.races.races | jsonify | replace: "</", "<\/" }}</script>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js" integrity="sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj" crossorigin="anonymous" defer></script>
<script src="{{ '/assets/js/races.js' | relative_url }}" defer></script>
