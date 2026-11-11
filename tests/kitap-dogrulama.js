// HAİS kitap doğrulama testi
// Çalıştırma:  node tests/kitap-dogrulama.js     (playwright gerekir: npm i playwright)
// Karşılaştırır: uygulamadaki 81 mm tablolarını KKYY 164-14'ten çıkarılan altın veriyle (golden81.json),
// kitabın çözümlü örneklerini, 106 mm talimname (KKT 315-30) satırlarını ve Cetvel 4-3'ü.
const { chromium } = require('playwright');
const path = require('path');
const golden = require('./golden81.json');
let fail = 0, ok = 0;
const say = (c, msg) => { if (c) ok++; else { fail++; console.log('✗', msg); } };
const near = (a, b, t) => Math.abs(a - b) <= t;

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => { const u = r.request().url(); (u.startsWith('file:') || u.startsWith('data:')) ? r.continue() : r.abort(); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.waitForTimeout(800);

  // 1) 81 mm tablo karşılaştırması (nişangah, uçuş süresi, metro sütunları)
  const app = await p.evaluate((names) => { const o = {}; for (const n of names) { try { o[n] = eval(n); } catch (e) { o[n] = null; } } return o; },
    [...Object.keys(golden.sight), ...Object.keys(golden.metro)]);
  for (const [tn, bhs] of Object.entries(golden.sight)) for (const [bh, rows] of Object.entries(bhs)) {
    const A = {}; ((app[tn] || {})[bh] || []).forEach(r => A[r[0]] = r);
    for (const g of rows) { const a = A[g[0]];
      say(a && near(a[1], g[1], 0.51) && near(a[2], g[2], 0.051), `${tn} BH${bh} ${g[0]} m: kitap ${g[1]}/${g[2]} uygulama ${a ? a[1] + '/' + a[2] : 'YOK'}`); }
  }
  for (const [tn, bhs] of Object.entries(golden.metro)) for (const [bh, rows] of Object.entries(bhs)) {
    const A = {}; ((app[tn] || {})[bh] || []).forEach(r => A[r[0]] = r);
    for (const g of rows) { const a = A[g[0]];
      let eq = !!a; if (a) for (let i = 1; i < 8; i++) if (a[i] === undefined || !near(a[i], g[i], 0.051)) eq = false;
      say(eq, `${tn} BH${bh} ${g[0]} m metro: kitap ${JSON.stringify(g)} uygulama ${JSON.stringify(a)}`); }
  }

  // 2) 81 mm kitap örnekleri (KKYY 164-14 Bölüm 1, MOD-214)
  const ex = await p.evaluate(() => {
    const set = (id, v) => { document.getElementById(id).value = v; };
    const o = {};
    set('ruzgarHizi', 0); set('ruzgarYonu', 0); set('havaSicaklik', 15); set('havaBasinc', 886.6); set('metroIstRakim', '');
    o.yog = calculateManualMetro(0, 4600, '81', 5, 'mke214');
    set('havaSicaklik', 29); set('havaBasinc', 1013.25 * (302.15 / 288.15));
    o.sic = calculateManualMetro(0, 4000, '81', 5, 'mke214');
    set('havaSicaklik', 15); set('havaBasinc', 1013.25); set('ruzgarHizi', 5); set('ruzgarYonu', 3200);
    o.kr = calculateManualMetro(0, 4800, '81', 6, 'mke214');
    return o;
  });
  const dm = (r) => (r && r.rangeMeters);
  say(near(dm(ex.yog), -237, 2), `81 örnek yoğunluk %87,5: kitap −237, uygulama ${dm(ex.yog)}`);
  say(near(dm(ex.sic), 10, 2), `81 örnek sıcaklık %5: kitap +10, uygulama ${dm(ex.sic)}`);
  say(near(dm(ex.kr), -60, 2), `81 örnek 5 kn kuyruk: kitap −60, uygulama ${dm(ex.kr)}`);

  // 3) Cetvel-D (81/120): +90 m rakım → sıcaklık −0.2, yoğunluk −0.9
  const d = await p.evaluate(() => cetvelDDuzeltme(90));
  say(near(d.sic, -0.2, 0.05) && near(d.yog, -0.9, 0.05), `Cetvel-D +90 m: kitap −0.2/−0.9, uygulama ${JSON.stringify(d)}`);

  // 4) 81 mm TAÇ: kitap yöntemi DTAÇ×(1+c); yukarı/aşağı simetri ve küçüklük
  const t = await p.evaluate(() => ({ a: getDTACGenel(dtac_m56a1, 1, 400, 100), b: getDTACGenel(dtac_m56a1, 1, 400, -100) }));
  say(t.a !== null && Math.abs(t.a) < 60 && Math.abs(t.a + t.b) <= 1, `81 TAÇ M-56A1 ±100 m @400: ${JSON.stringify(t)}`);

  // 5) 106 mm talimname Çizelge 4-58 (3000 m: BH 17 4/8, uçuş 29,1, tabii yan 40,1) ve Cetvel 4-3
  const s = await p.evaluate(() => ({ r: get106DataOnlyBH(3000), c: get106MesafeDuzeltmesi(3000, 300), c2: get106MesafeDuzeltmesi(1500, 100) }));
  say(near(s.r.bhDec, 17.5, 0.01) && near(s.r.ucusSuresi, 29.1, 0.05) && near(s.r.tabiiYan, 40.1, 0.05), `106 @3000: ${JSON.stringify(s.r)}`);
  say(near(Math.abs(s.c), 200, 1) && near(Math.abs(s.c2), 70, 1), `106 Cetvel 4-3: 3000m/300→200, 1500m/100→70; uygulama ${s.c}, ${s.c2}`);

  say(errs.length === 0, 'Sayfa hataları: ' + errs.join(' | '));
  console.log(`\n${ok} geçti, ${fail} kaldı`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
