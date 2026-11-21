---
name: flat-finder
description: Use to find flats by room size and amenities, to add a new city to Flat Finder, or to verify a housing society's real bedroom sizes from builder brochures and RERA plans. Triggers on "find me a flat", "smallest bedroom", "add Bangalore to flat finder", "verify <society>", "research this society", or a Flat Finder GitHub issue titled "Research: ...".
---

# Flat Finder

Flat Finder (https://flat-finder.pages.dev, repo `kairothq/flat-finder`) puts every housing society in a city on one map. Portal data covers every society; **verified rows** (bedroom sides read from builder brochures or RERA plans) are what make the room filter trustworthy. This skill does three jobs. Pick the one the user asked for.

Work from a clone of the repo: `gh repo clone kairothq/flat-finder && cd flat-finder`.

## Rules (all jobs)

- **Never estimate a number.** If a size is not printed, leave it out and say what is missing.
- **Every number keeps its source URL and page** (or slide, or HRERA document name).
- **Primary source beats portal.** Builder brochure or HRERA approved plan > portal floor plan image > portal text. If they disagree, keep the primary value and mention the other.
- **Sanity-check plans against the project's real unit sizes.** Portals sometimes attach another project's plan (one listed "4 BHK 1,133 sq ft" for a project whose smallest unit is 1,890).
- **Report captchas and blocked sites** instead of working around them. Never use anyone's logged-in session or cookies.
- **Crawl politely:** one request per second, cached, resumable (the pipeline already does this).

## Job 1: search

```bash
npx github:kairothq/flat-finder --city gurgaon --bhk 3,4 --min-bedroom "11'3x12'3" --min-sqft 1620 --amenity squash --likely
```

Explain the verdicts: **match** (every bedroom read and passes), **likely** (rooms read so far pass, not all read), societies with no room data are "not checked yet" and are never shown as matches. Offer Job 3 for the most promising "not checked yet" societies.

## Job 2: add a city

1. Add the city to `data/cities.json`: `name`, Magicbricks city slug (`magicbricks`, as in `magicbricks.com/residential-projects-in-<slug>-nprid`), `bbox` as [south, west, north, east], `center` [lng, lat], `zoom`.
2. Run the pipeline (python 3.9+, no dependencies):
   ```bash
   cd pipeline
   python3 mb_crawl.py list <city>       # list pages, a few minutes
   python3 mb_crawl.py projects <city>   # every project page, ~1 hour for 3,000 projects
   python3 osm_fetch.py <city>           # OSM outlines; retries Overpass mirrors
   python3 build_city.py <city>          # writes web/public/data/<city>.json, -shapes.geojson, cities.json
   ```
3. Check the printed counts: `not_located` should be small, and `other` kinds should be under 1%. Open `cd web && npm run dev` then `http://localhost:5173/?city=<city>` and confirm societies sit on the right neighbourhoods.
4. Run tests: `cd pipeline && uv run --with pytest pytest` and `cd web && npx vitest run --root .. cli web/src`.
5. Open a pull request with the new data files. Do not commit `pipeline/cache/` or `osm_buildings.geojson`.

## Job 2a: read every floor plan, brochure and HRERA filing with local OCR (free)

On a Mac (uses the built-in Vision framework, no upload):
```bash
cd pipeline
OCR="uv run --with pyobjc-framework-Vision --with pyobjc-framework-Quartz python"
$OCR plan_ocr.py <city>       # Magicbricks floor plan images (needs jev_reader.py run first for the cross-check, optional)
$OCR brochure_ocr.py <city>   # brochure PDFs: quick scan for plan pages, then 300 dpi tiled OCR
$OCR hrera.py <city>          # Haryana only for now: matches HRERA filings, reads approved building plans
python3 build_city.py <city>
```
Spot-check a few results by eye (open the plan, compare the bedrooms). Pairing bugs show up as tiny "bedrooms".

## Job 2b: read every floor plan image in a city with Jev (fast, cheap)

`python3 pipeline/jev_reader.py <city>` sends each Magicbricks floor plan image to Jev (TypeSafe, key `JEV_KEY` in `~/.claude/.env`, images need the `TypeSafe-Danger-Zone-Images: true` header). Jev answers typed questions only, so sizes are asked as multiple choice (narrowest bedroom side, 3-inch steps) and as yes/no ladders ("every bedroom's long side is at least 12'?", "at least 130 sq ft?"). Only confident answers count (choice confidence 0.75, yes 0.75, no 0.3); the result is a cautious lower bound, never an overstatement. Images that are 3D renders without printed sizes are skipped. Spot-check a sample by eye before publishing, then rebuild with `build_city.py`. Hand checks (Job 3) always outrank AI reads.

## Job 3: verify a society

1. **Find the primary sources.** Search for the builder brochure PDF (developer site, then mirrors) and the state RERA filing (Haryana: haryanarera.gov.in, Karnataka: rera.karnataka.gov.in, Maharashtra: maharera.maharashtra.gov.in). The Magicbricks `brochure_url` in the city JSON is a good start. Firecrawl works well for finding and fetching these.
2. **Read the floor plans.** Download each file into its own new folder. Render pages with `pdftoppm -r 150 file.pdf page` (300 dpi when labels are small) and read the room labels with vision. Fall back to `tesseract` OCR.
3. **Record every bedroom of each unit type exactly as printed**, in `data/verified/<city>.json`:
   ```json
   {
     "name": "Pioneer Araya", "match": ["Pioneer Araya"], "sector": "62",
     "amenities": { "squash": { "value": "yes", "source": "<brochure url>", "page": "12" } },
     "unit_types": [
       { "label": "4 BHK 4,279", "bhk": 4, "super_sqft": 4279,
         "bedrooms": ["12'10\"x16'4\"", "12'2\"x14'11\"", "12'2\"x14'11\"", "16'0\"x19'5\""],
         "confidence": "primary", "source": "<brochure url>", "page": "18" }
     ]
   }
   ```
   - Sides as printed: feet-inches `12'10"x16'4"` or millimetres `3350x3750`.
   - List every bedroom. If the plan only says the unlisted ones are larger (e.g. "master larger"), add `"others_larger": true`. If you only know the smallest room, add `"smallest_only": true`. Both of these give "likely", not "match".
   - `match` holds names as they appear on Magicbricks; `sector` must match the portal locality (leave it null if the portal uses a road name).
   - Label areas honestly: `super_sqft` vs `carpet_sqft`.
4. Rebuild and check: `python3 pipeline/build_city.py <city>` must report the society as verified, then open `/?city=<city>&open=<society id>` and confirm the card shows your rows with page links.
5. Open a pull request. If it came from a "Research: <society>" issue, reference the issue.

## Output to the user

Say what changed and whether it worked: societies verified (with pass or fail against the user's criteria), what could not be read and why, and links (`https://flat-finder.pages.dev/?city=<city>&open=<id>`).
