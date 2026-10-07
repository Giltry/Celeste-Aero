// Función serverless de Vercel: obtiene elementos orbitales de cometas desde
// la JPL Small-Body Database (dominio público) y los cachea en el CDN 12 h.
const JPL = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';
const FIELDS = ['full_name', 'e', 'q', 'i', 'om', 'w', 'tp', 'M1', 'K1'];

export default async function handler(req, res) {
  const jdNow = Date.now() / 86400000 + 2440587.5;
  const url = `${JPL}?fields=${FIELDS.join(',')}&sb-kind=c`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`JPL respondió ${r.status}`);
    const json = await r.json();
    const idx = Object.fromEntries(json.fields.map((f, k) => [f, k]));
    const num = (row, f) => (row[idx[f]] == null ? null : parseFloat(row[idx[f]]));

    const comets = [];
    for (const row of json.data) {
      const c = {
        name: String(row[idx.full_name] || '').trim(),
        e: num(row, 'e'), q: num(row, 'q'), i: num(row, 'i'),
        om: num(row, 'om'), w: num(row, 'w'), tp: num(row, 'tp'),
        M1: num(row, 'M1'), K1: num(row, 'K1'),
      };
      if ([c.e, c.q, c.i, c.om, c.w, c.tp, c.M1].some((v) => v == null || Number.isNaN(v))) continue;
      // Candidatos a ser observables: perihelio cercano en el tiempo y no muy lejano al Sol
      if (Math.abs(c.tp - jdNow) > 540 || c.q > 4.5) continue;
      // Estimación rápida del brillo máximo posible (Δ≈|r-1|) para descartar los muy débiles
      const best = c.M1 + 5 * Math.log10(Math.max(0.05, Math.abs(c.q - 1))) + (c.K1 ?? 10) * Math.log10(c.q);
      if (best > 16) continue;
      if (c.K1 == null || Number.isNaN(c.K1)) c.K1 = 10;
      comets.push(c);
    }

    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=86400');
    res.status(200).json({ updated: new Date().toISOString(), source: 'JPL SBDB', count: comets.length, comets });
  } catch (err) {
    res.setHeader('Cache-Control', 's-maxage=600');
    res.status(200).json({ updated: new Date().toISOString(), error: String(err.message || err), comets: [] });
  }
}
