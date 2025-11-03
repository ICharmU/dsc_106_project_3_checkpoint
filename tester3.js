import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// --- small contract ---
// Inputs: optional CSV at ./data/2022-epi-raw-data-time-series/POP_raw.csv (not required for the map)
// Output: a responsive SVG world map rendered into #map
// Error modes: fetch failures logged to console

// Try to load the CSV (if present) but continue even if it's missing.
let rawData = null;
try {
	rawData = await d3.csv("./data/2022-epi-raw-data-time-series/POP_raw.csv");
	console.log("Loaded CSV rows:", rawData.length);
} catch (err) {
	console.warn("CSV not loaded (this is optional for the map):", err.message);
}

// Map drawing
const container = d3.select('#map');

const width = 960;
const height = 600;

// If the #map element is already an <svg>, reuse it; otherwise append one.
let svg;
if (container.node() && container.node().nodeName && container.node().nodeName.toLowerCase() === 'svg') {
	svg = container;
	svg.attr('viewBox', `0 0 ${width} ${height}`)
	   .attr('preserveAspectRatio', 'xMidYMid')
	   .attr('role', 'img')
	   .attr('aria-label', 'World map')
	   .style('width', '100%')
	   .style('height', 'auto');
} else {
	svg = container.append('svg')
		.attr('viewBox', `0 0 ${width} ${height}`)
		.attr('preserveAspectRatio', 'xMidYMid')
		.attr('role', 'img')
		.attr('aria-label', 'World map')
		.style('width', '100%')
		.style('height', 'auto');
}

// add a subtle border to the SVG container for visual separation
svg.style('border', '1px solid #ccc')
   .style('border-radius', '4px');

// create or reuse a single group for map content
let g = svg.select('g');
if (g.empty()) g = svg.append('g');

const projection = d3.geoNaturalEarth1()
	.scale(160)
	.translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// GeoJSON source (public). If you prefer a local copy, download and point here.
const worldGeoUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';

async function drawMap() {
	try {
		const world = await d3.json(worldGeoUrl);

		// helper to get iso3 from GeoJSON feature
		// This is robust: it checks common iso3 properties, normalizes to uppercase,
		// and applies an alias map for known mismatches (e.g. GeoJSON uses "SDS" while CSV uses "SSD").
		function featureIso3(f) {
			const p = f.properties || {};
			// small alias map: geojson-id/name -> CSV iso3
			const aliasMap = {
				// South Sudan: geojson file uses "SDS" but CSV uses "SSD"
				'SDS': 'SSD'
				// add more entries here if you discover other mismatches, e.g. 'ROM': 'ROU'
			};

			// candidate fields that commonly hold a 3-letter ISO code
			const candidates = [f.id, p.iso_a3, p.ISO_A3, p.iso3, p.ISO3, p.adm0_a3, p.ADM0_A3, p.iso, p.ISO];
			let iso = null;
			for (const c of candidates) {
				if (!c) continue;
				const s = c.toString().trim();
				// accept only 3-letter alpha codes
				if (/^[A-Za-z]{3}$/.test(s)) {
					iso = s.toUpperCase();
					break;
				}
			}

			if (!iso) return null;
			// apply alias mapping if present
			if (aliasMap[iso]) return aliasMap[iso];
			return iso;
		}
		// prepare variables for population bins and lookups; these will be built per-year
		let popLookup = new Map();
		let nameLookup = new Map();
		let pops = [];
		const numBins = 10;
		let quantileScale = null;
		let binThresholds = [];

		// color accessor for bins using a perceptual interpolator (Greens)
		function binColor(binIndex) {
			const t = 0.15 + (binIndex / (numBins - 1)) * 0.8;
			return d3.interpolateGreens(t);
		}

		// tooltip
		const tip = d3.select('body').append('div')
			.attr('class', 'd3-tooltip')
			.style('position', 'absolute')
			.style('pointer-events', 'none')
			.style('padding', '6px 8px')
			.style('background', 'rgba(0,0,0,0.7)')
			.style('color', '#fff')
			.style('font-size', '13px')
			.style('border-radius', '4px')
			.style('display', 'none')
			.style('z-index', 1000);

		// optional: add graticule (non-interactable) BEFORE countries so gridlines render under country shapes
		const graticule = d3.geoGraticule();
		g.append('path')
			.datum(graticule())
			.attr('d', path)
			.attr('fill', 'none')
			.attr('stroke', '#ddd')
			.attr('stroke-width', 0.4)
			.attr('pointer-events', 'none');

		// draw country paths (classed so graticule remains separate)
		const countryPaths = g.selectAll('path.country')
			.data(world.features)
			.join('path')
			.attr('class', 'country')
			.attr('d', path)
			.attr('fill', '#eee')
			.attr('fill-opacity', 1)
			.attr('stroke', '#555')
			.attr('stroke-width', 0.3)
			.on('mouseover', function (event, d) {
				d3.select(this).attr('stroke-width', 0.8);
				// lookup population
				const pName = (d.properties && (d.properties.name || d.properties.ADMIN || d.properties.NAME)) || 'Unknown';
				const iso = (featureIso3(d) || '').toString().toUpperCase();
				let p = popLookup.get(iso);
				if (p == null) {
					// try matching by name (case-insensitive)
					const lower = pName.toLowerCase();
					const entry = nameLookup.get(lower);
					if (entry) p = entry.val;
				}
				const valText = p == null ? 'No data' : d3.format(',')(p);
				let binLabel = 'No data';
				if (p != null && pops.length) {
					const binIndex = quantileScale(p);
					binLabel = `${binIndex * 10}-${(binIndex + 1) * 10}%`;
				}
				tip.style('display', 'block')
					.html(`<strong>${pName}</strong><br>POP ${currentYear}: ${valText}<br>Decile: ${binLabel}`);
			})
			.on('mousemove', function (event) {
				tip.style('left', (event.pageX + 12) + 'px')
					.style('top', (event.pageY + 12) + 'px');
			})
			.on('mouseout', function () {
				d3.select(this).attr('stroke-width', 0.3);
				tip.style('display', 'none');
			});

			// helper: parse slider and selected year
			const yearSlider = d3.select('#year-slider');
			const yearValueSpan = d3.select('#year-value');
			// derive available years from CSV column names like "POP.raw.1990"
			let availableYears = [];
			if (rawData && rawData.columns) {
				availableYears = rawData.columns
					.map(c => {
						const m = c.match(/^POP\.raw\.(\d{4})$/);
						return m ? +m[1] : null;
					})
					.filter(y => y && y <= 2020)
					.sort((a, b) => a - b);
			}
			if (!availableYears.length) availableYears = [1990];
			const minYear = availableYears[0];
			const maxYear = availableYears[availableYears.length - 1];
			if (!yearSlider.empty()) {
				yearSlider.attr('min', minYear).attr('max', maxYear).attr('step', 1);
				// ensure current value falls within new range
				if (+yearSlider.node().value < minYear || +yearSlider.node().value > maxYear) {
					yearSlider.node().value = minYear;
				}
			}
			const selectedYear = yearSlider.empty() ? minYear : +yearSlider.node().value;
			let currentYear = selectedYear;

		// render function: builds popLookup for a year, computes quantile bins, updates fills and legend
		function renderForYear(year) {
			currentYear = year;
			// build lookups
			popLookup = new Map();
			nameLookup = new Map();
			if (rawData) {
				rawData.forEach(d => {
					const iso = (d.iso || '').toString().trim();
					const name = (d.country || '').toString().trim();
					const key = `POP.raw.${year}`;
					let val = +d[key];
					if (!isFinite(val) || val < 0) val = null;
					if (iso) popLookup.set(iso, val);
					if (name) nameLookup.set(name.toLowerCase(), { iso, val, name });
				});
			}
			pops = Array.from(popLookup.values()).filter(v => v != null);
			if (pops.length) {
				quantileScale = d3.scaleQuantile().domain(pops).range(d3.range(numBins));
				binThresholds = quantileScale.quantiles();
			} else {
				quantileScale = () => null;
				binThresholds = [];
			}

			// recolor countries (try iso3 first, then fallback to name-based lookup)
			countryPaths.attr('fill', d => {
				const iso = (featureIso3(d) || '') ? (featureIso3(d) || '').toString().toUpperCase() : '';
				let p = iso ? popLookup.get(iso) : null;
				if (p == null) {
					// try matching by country name (case-insensitive)
					const pName = (d.properties && (d.properties.name || d.properties.ADMIN || d.properties.NAME)) || '';
					const entry = nameLookup.get(pName.toLowerCase());
					if (entry) p = entry.val;
				}
				if (p == null) return '#eee';
				const bin = quantileScale(p);
				return binColor(bin);
			});

			// update HTML legend row (under the slider)
			const htmlLegend = d3.select('#legend-row');
			if (!htmlLegend.empty()) {
				htmlLegend.html('');
				if (pops.length) {
					const numericBins = [d3.min(pops), ...binThresholds, d3.max(pops)];
					numericBins.slice(0, numBins).forEach((low, i) => {
						const high = numericBins[i + 1];
						htmlLegend.append('div')
							.attr('class', 'swatch')
							.style('display', 'inline-block')
							.style('width', '28px')
							.style('height', '16px')
							.style('border', '1px solid #ccc')
							.style('background', binColor(i))
							.attr('title', `${d3.format(',')(Math.round(low))} – ${d3.format(',')(Math.round(high))}`);
					});
				} else {
					htmlLegend.append('div').text('No population data');
				}
			}
		}

		// initial render and slider wiring
		renderForYear(selectedYear);
		if (!yearSlider.empty()) {
			yearValueSpan.text(selectedYear);
			yearSlider.on('input', function () {
				const y = +this.value;
				yearValueSpan.text(y);
				renderForYear(y);
			});
		}

			// Play button behavior: animate through availableYears over 5 seconds total.
			const playBtn = d3.select('#play-btn');
			let playTimer = null;
			let isPlaying = false;

			function stopPlayback() {
				if (playTimer) {
					clearInterval(playTimer);
					playTimer = null;
				}
				isPlaying = false;
				if (!playBtn.empty()) playBtn.text('Play ▶');
				if (!yearSlider.empty()) yearSlider.property('disabled', false);
			}

			function startPlayback() {
				if (isPlaying) return;
				// If the current year is 2020, revert to 1990 before starting playback.
				if (currentYear === 2020) {
					const startYear = availableYears.includes(1990) ? 1990 : minYear;
					currentYear = startYear;
					if (!yearSlider.empty()) {
						yearSlider.node().value = startYear;
						yearValueSpan.text(startYear);
						renderForYear(startYear);
					}
				}
				const years = availableYears && availableYears.length ? availableYears : [selectedYear];
				const total = years.length;
				const stepMs = Math.max(1, Math.round(1500 / total));
				let idx = years.indexOf(currentYear);
				if (idx === -1) idx = 0;
				isPlaying = true;
				if (!playBtn.empty()) playBtn.text('Pause ❚❚');
				if (!yearSlider.empty()) yearSlider.property('disabled', true);
				// advance after each interval
				playTimer = setInterval(() => {
					idx = idx + 1;
					if (idx >= years.length) {
						stopPlayback();
						return;
					}
					const y = years[idx];
					if (!yearSlider.empty()) yearSlider.node().value = y;
					yearValueSpan.text(y);
					renderForYear(y);
				}, stepMs);
			}

			if (!playBtn.empty()) {
				playBtn.on('click', () => {
					if (isPlaying) stopPlayback(); else startPlayback();
				});
			}






			// zoom — allow dragging only when zoomed in and clamp the transform so the
			// content never leaves the SVG viewport. Wheel/dblclick/touch still zoom.
			const minK = 1;
			const maxK = 8;

			function clampTransform(t) {
				const k = t.k;
				// allowed translation range so content covers the viewport
				const minX = Math.min(0, width - width * k);
				const maxX = 0;
				const minY = Math.min(0, height - height * k);
				const maxY = 0;
				const x = Math.max(minX, Math.min(maxX, t.x));
				const y = Math.max(minY, Math.min(maxY, t.y));
				return { x, y, k };
			}

			const zoom = d3.zoom()
				.scaleExtent([minK, maxK])
				.filter(event => {
					// allow wheel, double-click, and touch gestures always
					if (event.type === 'wheel' || event.type === 'dblclick' || event.type === 'touchstart') return true;
					// allow pointer/mouse dragging only when currently zoomed in (k > 1)
					const t = d3.zoomTransform(svg.node());
					if (t.k > 1) {
						// accept pointer/mouse events so drag panning can occur
						return event.type.startsWith('mouse') || event.type.startsWith('pointer') || event.type.startsWith('touch');
					}
					// otherwise, disallow drag/pan
					return false;
				})
				.on('zoom', (event) => {
					// Clamp the transform so the map content always covers the SVG viewport.
					const t = event.transform;
					const c = clampTransform(t);
					g.attr('transform', `translate(${c.x},${c.y}) scale(${c.k})`);
				});

			svg.call(zoom);

		console.log('World map drawn');
	} catch (err) {
		console.error('Failed to load or draw world GeoJSON:', err);
		container.append('div').text('Failed to load map data. See console for details.');
	}
}

drawMap();


