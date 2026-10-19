# Generates subscribable iCalendar feeds from _data/races.json:
#   /races/all.ics, /races/trail.ics, /races/road.ics
#
# Each race is an all-day event with a stable UID so calendar apps update
# events in place when race details change.

require "date"

module RaceCalendars
  FEEDS = {
    "all"   => { name: "New Mexico Races",       types: %w[trail road] },
    "trail" => { name: "New Mexico Trail Races", types: %w[trail] },
    "road"  => { name: "New Mexico Road Races",  types: %w[road] },
  }.freeze

  EPS = 0.06

  class Feed < Jekyll::Page
    def initialize(site, slug, body)
      @site = site
      @base = site.source
      @dir  = "races"
      @name = "#{slug}.ics"
      process(@name)
      @data = { "layout" => nil, "sitemap" => false }
      self.content = body
    end

    # Body is pre-rendered; skip Liquid/markdown
    def render_with_liquid?
      false
    end
  end

  class Generator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      races = (site.data.dig("races", "races") || [])
      stamp = Time.now.utc.strftime("%Y%m%dT%H%M%SZ")
      host  = URI(site.config["url"] || "https://santafe.run").host rescue "santafe.run"

      FEEDS.each do |slug, feed|
        events = races.select { |r| feed[:types].include?(r["type"]) }
        body = RaceCalendars.calendar(feed[:name], events, stamp, host, site)
        site.pages << Feed.new(site, slug, body)
      end
    end
  end

  module_function

  def calendar(name, races, stamp, host, site)
    lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Run Santa Fe//Races//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:#{escape(name)}",
      "X-WR-CALDESC:#{escape("Upcoming races in New Mexico from RunSignup and UltraSignup, via #{site.config["url"]}/races/")}",
      "X-WR-TIMEZONE:America/Denver",
      "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
      "X-PUBLISHED-TTL:PT12H",
    ]
    races.each { |r| lines.concat(event(r, stamp, host)) }
    lines << "END:VCALENDAR"
    lines.map { |l| fold(l) }.join("\r\n") + "\r\n"
  end

  def event(r, stamp, host)
    start = Date.parse(r["date"])
    last  = r["end_date"] ? Date.parse(r["end_date"]) : start
    dists = (r["distances"] || []).map { |d| distance_label(d) }
    type  = r["type"] == "trail" ? "Trail" : "Road"

    desc = ["#{type} · #{dists.join(", ")}"]
    desc << "Register: #{r["url"]}" if r["url"]
    desc << "Listed on #{r["source"]}"

    lines = [
      "BEGIN:VEVENT",
      "UID:#{r["id"]}@#{host}",
      "DTSTAMP:#{stamp}",
      "DTSTART;VALUE=DATE:#{start.strftime("%Y%m%d")}",
      # DTEND is exclusive for all-day events
      "DTEND;VALUE=DATE:#{(last + 1).strftime("%Y%m%d")}",
      "SUMMARY:#{escape(r["name"])}",
      "LOCATION:#{escape("#{r["city"]}, NM")}",
      "DESCRIPTION:#{escape(desc.join("\n"))}",
      "CATEGORIES:#{type}",
      "TRANSP:TRANSPARENT",
    ]
    lines << "URL:#{r["url"]}" if r["url"]
    lines << "GEO:#{r["lat"]};#{r["lng"]}" if r["lat"] && r["lng"]
    lines << "END:VEVENT"
  end

  # Mirrors distanceLabel() in assets/js/races.js
  def distance_label(d)
    return d["label"] if d["timed"] || d["miles"].nil?
    mi = d["miles"].to_f
    { 3.1 => "5K", 6.2 => "10K", 13.1 => "Half", 26.2 => "Marathon" }.each do |v, label|
      return label if (mi - v).abs < EPS
    end
    label = d["label"].to_s.strip
    return label.upcase if label =~ /\A\d+(\.\d+)?\s*k\z/i
    return label if mi < 0.1
    (mi % 1).zero? ? "#{mi.to_i} mi" : format("%.1f mi", mi)
  end

  def escape(s)
    s.to_s.gsub("\\", "\\\\\\\\").gsub(";", "\\;").gsub(",", "\\,").gsub(/\r?\n/, "\\n")
  end

  # RFC 5545: fold lines longer than 75 octets, without splitting UTF-8 characters
  def fold(line)
    return line if line.bytesize <= 75
    out = []
    cur = +""
    limit = 75
    line.each_char do |ch|
      if cur.bytesize + ch.bytesize > limit
        out << cur
        cur = +""
        limit = 74 # continuation lines start with a space
      end
      cur << ch
    end
    out << cur
    out.join("\r\n ")
  end
end
