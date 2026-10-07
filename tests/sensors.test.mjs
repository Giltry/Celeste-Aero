import { eulerToQ, lookToQ, qToMat, viewDirection } from '../src/lib/sensors.js';
const r = (q) => qToMat(q).map(row => row.map(v => v.toFixed(3)).join(' ')).join(' | ');
console.log('euler 0,90,0 :', r(eulerToQ(0,90,0)), viewDirection(qToMat(eulerToQ(0,90,0))));
console.log('look 0,0     :', r(lookToQ(0,0)));
// alpha=90 (CCW) => device turned to face west: heading 270
console.log('alpha 90 view:', viewDirection(qToMat(eulerToQ(90,90,0))));
console.log('look 270,45  :', viewDirection(qToMat(lookToQ(270,45))));
// landscape: screen angle 90, phone rotated left; device held so back faces north
console.log('landscape:', viewDirection(qToMat(eulerToQ(0,0,-90,90))), r(eulerToQ(0,0,-90,90)));
