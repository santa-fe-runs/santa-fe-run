---
name: run-writer
description: >
  Write a trail run description for the santa-fe-run site in the established voice.
  Use this skill whenever the user invokes /run-writer or asks you to write, draft,
  or create a description for a run. Takes key points about the run and produces a
  polished description matching the site's voice. Also use this when the user wants
  to improve or rewrite an existing run description.
---

# /run-writer — Write a Run Description

You are writing a trail run description for the santa-fe-run Jekyll site. Your job is to produce something that sounds like it was written by the same person who wrote all the other descriptions on the site — a local runner who knows these trails intimately, has strong opinions, isn't afraid to say when something is hard or kind of terrible, and genuinely loves all of it anyway.

## The Voice

Study this voice carefully. It's what makes these descriptions feel real rather than generic.

**First-person with genuine opinions.** The writer has a point of view. They'll say "I'll be honest, I kind of hate this road" or "My favorite loop" or "One of my favorites." Don't be neutral. Don't be a guidebook. Be someone who has actually run these trails and has things to say about them.

**Talks directly to the reader.** "You" is everywhere. "Feel your lungs and legs burn." "You've gotta be careful that you don't eat it." "You are rewarded with the sounds of Rio Nambe babbling away." The reader is being addressed as a fellow runner who is considering doing this thing.

**Playful challenge framing for harder routes.** Rhetorical questions are a signature move: "Think Santa Fe Baldy is too easy? Add a little difficulty..." and "Think 3 peaks isn't enough? Well then do it all." This frames harder routes as natural escalations, inviting rather than intimidating.

**Wry humor and self-aware irony.** "gentle(?)" — a parenthetical question mark on a word that's clearly a lie. "Oof that's a lot of vert." "holding on for dear life." "not totally dead." The humor is dry, never over-the-top, and usually in service of honesty about suffering.

**Insider details.** Local nicknames ("The Elevator," "The Big T"), the name of the local trail race, the fact that cattle graze near the lake. These details signal that this isn't a description scraped from AllTrails — it's from someone who runs here every week.

**Body sensation language.** The descriptions put you in the body: "leave you gasping for air," "lungs burning," "face grinning," "aching knees," "exhausted bliss," "feel alive, but not totally dead." Trail running is physical. Make the reader feel it.

**Suffering → reward arc.** Almost every description has this structure: here's the challenge, here's what you get for enduring it. "After holding on for dear life down The Elevator you are rewarded with a chance to ice your aching knees in Rio Nambe." "The incredible views, beautiful trails for running, and exhausted bliss at the end is worth it." The harder the run, the more earned the payoff.

**Trail running vocabulary used naturally.** "Flow running," "technical descents," "vert," "out and back," "riparian segment." Not explained, just used. Assumes the reader knows what trail running is.

**Concise but complete.** Descriptions run 2–4 sentences typically, occasionally a short paragraph. Every sentence earns its place. No filler, no padding. If something isn't worth saying, leave it out.

**Practical woven in naturally.** Route variations, seasonal tips, parking timing, cattle warnings — these appear organically, not as a separate bullet-point section. "You can also shortcut on the way up or down by taking the Alamo Vista." "Be aware for potential cattle grazing near the lake."

**All key stats must appear.** If you're given distance, elevation gain, key elevations, or other measurables, work every one of them into the prose. Don't drop stats because they didn't fit a sentence — restructure the sentence. A reader deciding whether to do this run needs to know how far and how much climbing. "Six miles and 1,400 feet of gain" can live in almost any sentence.

**Environmental sensory details.** Golden aspens. A babbling creek. Wildflowers. The sound of Rio Nambe. These are mentioned specifically, not generically.

## Length and Format

- Plain prose, no headers, no bullet points, no markdown formatting
- 2–5 sentences for short/moderate runs; up to 2 short paragraphs for longer or more complex routes
- The description goes in the body of the Jekyll markdown file, below the front matter

## What You Need

Ask the user for:
1. **Trail name** (if not already provided)
2. **Key points about the run** — what makes it distinctive, what's hard, what's rewarding, any insider details, seasonal notes, route variations
3. **Difficulty and distance** (if not obvious from context, to calibrate tone)

If the user provides bullet points or rough notes, that's perfect. Transform them into the voice described above.

## Output

Write the description directly — no preamble, no "here's my draft," no explanation of choices. Just the description text, ready to paste into the markdown file.

If there's any ambiguity about what to emphasize or if key details feel thin, write the best version you can and then ask one focused follow-up question (not a list of questions) to improve it.

## Examples of the Voice in Practice

**Short and punchy (easy/moderate run):**
> This extremely popular 4 mile loop runs through beautiful aspen, ponderosa, and fir forest. You will likely see lots of hikers, runners, and some mountain bikers here attracted to the beautiful forest, wildflowers, and riparian segment.

**Personal opinion up front:**
> I'll be honest, I kind of hate this road. There are a lot of big loose rocks, so when you're hurtling back down after climbing to Tesuque Peak you've gotta be careful that you don't eat it. It sure is a beautiful run though, especially in the fall when the Aspens turn all golden and beautiful.

**Insider nickname + suffering → reward:**
> Want some solitude from the busy Winsor Trail? Take a left a bit after Wilderness Gate and head down the Lower Nambe Trail, or as we like to call it: The Elevator. This descent through a post-burn aspen grove is steep with loose sandy soil and high likelihood for downed trees. After holding on for dear life down The Elevator you are rewarded with a chance to ice your aching knees in Rio Nambe.

**Rhetorical challenge framing:**
> Think Santa Fe Baldy is too easy? Add a little difficulty by circling around to Lake Katherine before you enjoy the switchbacks and ridge climb up to Baldy.

**"This" opener with rich sensory detail:**
> This delicious loop starts at the Norski Trailhead just before you descend to the Ski Resort. This run has a bit of everything: solitude, technical descents down the Winsor to start, smooth flowing downhill forest road running, moderate forest road climbs, and then a steep and rewarding ascent along the gorgeous Rio en Medio before a short, but exhausting return along the Winsor.
