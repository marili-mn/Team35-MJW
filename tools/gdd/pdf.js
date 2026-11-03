// The whole GDD in one PDF, newest first: v3 (Prototipo), v2 (Pre-Alfa), v1 (the original GDD). Run from
// Playwright (browser_run_code with this file) with the landing served on 127.0.0.1:58913. Every section is
// one A4 sheet: the few that run a little over are shrunk with CSS zoom to fit (to whole sheets when they are
// longer), and each version starts on a new sheet. The PDF lands on the Desktop.
async (page) => {
  const A4 = 1123;                                  // px at 96 dpi
  const out = 'C:/Users/Nicte/Desktop/GravityRunnerDash_GDD_completo.pdf';
  await page.goto('http://127.0.0.1:58913/?v=' + Date.now() + '#v3');
  await page.evaluate(() => {
    const mains = ['v3', 'v2', 'v1'].map((id) => document.getElementById(id));
    for (const m of mains) { m.hidden = false; m.style.display = ''; mains[0].parentElement.appendChild(m); }
    for (const m of mains.slice(0, -1)) { const last = [...m.querySelectorAll('section.page')].pop(); last.style.breakAfter = 'page'; }
    for (const img of document.images) img.loading = 'eager';
  });
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  });
  await page.setViewportSize({ width: 794, height: A4 });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(1500);
  const zoomed = await page.evaluate((A4) => [...document.querySelectorAll('main section.page')].map((s) => {
    const h = s.getBoundingClientRect().height, ratio = h / A4;
    const [n, slack] = ratio <= 1.45 ? [1, 0.965] : ratio <= 2.25 ? [2, 0.85] : [Math.ceil(ratio), 0.9];
    const z = Math.min(1, (n * A4 * slack) / h);
    if (z < 1) s.style.zoom = z.toFixed(3);
    return z < 1 ? `${s.closest('main').id} ${(s.querySelector('h2') || {}).innerText || 'portada'} ×${z.toFixed(2)}` : null;
  }).filter(Boolean), A4);
  await page.waitForTimeout(500);
  await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 1280, height: 900 });
  return { out, zoomed };
}
