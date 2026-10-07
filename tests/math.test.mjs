import * as A from 'astronomy-engine';
import { eqjToEnuMatrix, applyEnu, enuToAltAz, radecToVec, cometHelio, solarSystem, cometPositions } from '../src/lib/astro.js';
const d = new Date('2026-10-07T04:00:00Z'), lat=25.54, lon=-103.41;
const M = eqjToEnuMatrix(d, lat, lon);
const o=[0,0,0];
// Polaris J2000 ra 37.95 dec 89.264
applyEnu(M, radecToVec(37.9546, 89.2641), o, false); console.log('Polaris', enuToAltAz(...o));
// Vega 279.2347, 38.7837 vs astronomy-engine
applyEnu(M, radecToVec(279.2347, 38.7837), o, false); console.log('Vega mine', enuToAltAz(...o));
const obs=new A.Observer(lat,lon,0); const t=A.MakeTime(d);
const ofd = A.Equator? null:null;
// astronomy-engine reference: precess J2000 to date then Horizon
const rot=A.Rotation_EQJ_EQD(t); const v=A.RotateVector(rot, A.VectorFromSphere(new A.Spherical(38.7837,279.2347,1),t)); const eqd=A.EquatorFromVector(v);
console.log('Vega ref', A.Horizon(t, obs, eqd.ra, eqd.dec, null));
for (const q of [0.999999,1.0,1.000001]) console.log(q, cometHelio({e:q,q:1.2,i:30,om:40,w:50,tp:2461000}, 2461030).map(x=>x.toFixed(6)));
const r=cometHelio({e:0.96714,q:0.5871,i:162.26,om:58.42,w:111.33,tp:2446467.395},2446467.395); console.log('r at tp',Math.hypot(...r));
console.log(solarSystem(d,lat,lon).map(b=>b.name+' '+b.mag.toFixed(1)).join(', '));
console.log(cometPositions([{name:'test',e:0.9,q:1,i:10,om:20,w:30,tp:2461320,M1:8,K1:10}], d).map(c=>[c.ra.toFixed(2),c.dec.toFixed(2),c.mag.toFixed(1),c.r.toFixed(2)]));
