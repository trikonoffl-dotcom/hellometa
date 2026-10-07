// Extract Australia's coastline (mainland + Tasmania) from Natural Earth 1:50m
// (world-atlas, public domain) as lon/lat rings for the in-browser map renderer.
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const world = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url)));
const fc = feature(world, world.objects.countries);
const au = fc.features.find((f) => f.id === '036' || f.properties.name === 'Australia');
const polys = au.geometry.type === 'MultiPolygon' ? au.geometry.coordinates : [au.geometry.coordinates];
// Keep landmasses with meaningful area (mainland, Tasmania, a few large islands).
const area = (r) => Math.abs(r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + (x * y2 - x2 * y); }, 0) / 2);
const rings = polys.map((p) => p[0]).filter((r) => area(r) > 0.4).map((r) => r.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]));
rings.sort((a, b) => area(b) - area(a));
writeFileSync(new URL('../assets/map/australia.json', import.meta.url), JSON.stringify({ source: 'Natural Earth 1:50m via world-atlas', rings }));
console.log('rings', rings.length, rings.map((r) => r.length));
