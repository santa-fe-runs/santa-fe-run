---
layout: default
title: "The Areas"
description: "Seven distinct running zones around Santa Fe — from high alpine wilderness to desert plateau."
permalink: /the-areas/
uses_map: true
---

<div class="guide-page">
  <div class="guide-hero">
    <div class="container">
      <h1 class="guide-title">The Areas</h1>
      <p class="guide-subtitle">Seven distinct running zones around Santa Fe</p>
    </div>
  </div>

  <div class="areas-body">
    <div class="container">

      <p class="areas-intro">Santa Fe sits at the intersection of alpine wilderness and high desert — the terrain around town ranges from 5,500-foot sage flats to 13,000-foot summit ridges. Here's how the running breaks down by zone.</p>

      <!-- Carousel -->
      <div class="areas-carousel-wrapper">
        <button class="carousel-btn carousel-btn--prev" type="button" aria-label="Previous area">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="areas-carousel">
          {% for area in site.data.areas %}
          <div class="area-card" data-area-id="{{ area.id }}" role="button" tabindex="0" aria-label="Select {{ area.name }}">
            <div class="area-card-header">
              {% include difficulty-badge.html difficulty=area.difficulty %}
            </div>
            <h2 class="area-card-name">{{ area.name }}</h2>
            <p class="area-card-tagline">{{ area.tagline }}</p>
            <p class="area-card-description">{{ area.description }}</p>
            <div class="area-card-stats">
              <div class="area-card-stat">
                <strong>{{ area.elevation_range.min | divided_by: 1000.0 | round: 1 }}k–{{ area.elevation_range.max | divided_by: 1000.0 | round: 1 }}k ft</strong> elevation
              </div>
            </div>
          </div>
          {% endfor %}
        </div>
        <button class="carousel-btn carousel-btn--next" type="button" aria-label="Next area">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M8 4l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- Map -->
      <div id="areas-map"
           class="areas-map-container"
           data-areas="{{ site.data.areas | jsonify | uri_escape }}"
           aria-label="Interactive map of Santa Fe running areas"></div>

    </div>
  </div>
</div>

<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js" integrity="sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj" crossorigin="anonymous" defer></script>
<script src="{{ '/assets/js/areas-map.js' | relative_url }}" defer></script>
