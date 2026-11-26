const { chromium } = require("playwright");
const path = require("path"),
  fs = require("fs"),
  assert = require("assert/strict");
const dir = "docs/media/review";
fs.mkdirSync(dir, { recursive: true });
const url =
  "file:///" + path.resolve("html-preview/index.html").replaceAll("\\", "/");
let activeBrowser;
(async () => {
  const browser = (activeBrowser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-features=CalculateNativeWinOcclusion",
    ],
  }));
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [],
    network = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/*", (r) => {
    if (r.request().url().startsWith("file:")) r.continue();
    else {
      network.push(r.request().url());
      r.abort();
    }
  });
  await page.goto(url);
  await page.waitForFunction(() => window.cascade);
  const environment = await page.evaluate(() => {
    const gl = document.querySelector("#scene").getContext("webgl2"),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      gpu: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
      headless: true,
      userAgent: navigator.userAgent,
    };
  });
  assert(!/SwiftShader|llvmpipe/i.test(environment.gpu));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dir}/12-opening-mid.png` });
  await page.evaluate(() => window.cascade.skipOpening());
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/01-overview.png` });
  await page.screenshot({ path: `${dir}/21-overview-public.png` });
  assert(await page.locator("#focus-inset").isHidden());
  await page.locator("#search").fill("pleat");
  await page.waitForTimeout(140);
  assert((await page.locator(".result").count()) > 0);
  await page.screenshot({ path: `${dir}/02-search-typing.png` });
  await page.locator("#search").fill("ISO 554");
  await page.waitForTimeout(140);
  assert(
    (await page.locator("#results").innerText())
      .toLowerCase()
      .includes("public standards"),
  );
  await page.screenshot({ path: `${dir}/03-search-public.png` });
  await page.locator("#search").fill("DSGN-347");
  await page.waitForTimeout(100);
  await page.locator("#search").press("Enter");
  await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(() => window.cascade.current), "DSGN-347");
  assert(await page.locator("#results").evaluate((e) => e.hidden));
  assert(await page.locator("#back").isHidden(), "Back only appears when there is somewhere to go back to");
  assert.equal(await page.locator("#breadcrumbs, #trail, #theme, #overview-note").count(), 0);
  await page.screenshot({ path: `${dir}/04-focus-DSGN-347.png` });
  assert(await page.locator("#focus-inset").isVisible());
  await page.screenshot({ path: `${dir}/17-focus-inset.png` });
  await page.screenshot({ path: `${dir}/18-edge-labels.png` });
  await page.mouse.move(300, 130);
  const frame = await page.evaluate(() => ({
    scene: document.querySelector("#scene").getBoundingClientRect().right,
    panel: document.querySelector("#panel").getBoundingClientRect().left,
  }));
  assert(frame.scene <= frame.panel + 1, "Scene must not overlap the side panel");
  await page
    .locator("#panel details")
    .first()
    .evaluate((e) => (e.open = true));
  await page.screenshot({ path: `${dir}/05-sidepanel.png` });
  await page.locator('.relation[data-target="DSGN-348"]').first().hover();
  await page.waitForTimeout(170);
  assert((await page.evaluate(() => window.cascade.state.hover)) >= 0);
  await page.screenshot({ path: `${dir}/06-hover-fiber.png` });
  await page.screenshot({ path: `${dir}/19-hover-neighbor.png` });
  assert((await page.evaluate(() => window.cascade.state.hover)) >= 0);
  await page.locator('.relation[data-target="DSGN-348"]').first().click();
  await page.waitForTimeout(550);
  assert((await page.evaluate(() => window.cascade.state.run)) >= 0);
  await page.evaluate(() => window.cascade.pauseAnimations(true));
  await page.screenshot({ path: `${dir}/07-fiber-run-mid.png` });
  await page.screenshot({ path: `${dir}/22-panel-no-overlap.png` });
  await page.evaluate(() => window.cascade.pauseAnimations(false));
  await page.waitForTimeout(2600);
  assert.equal(await page.evaluate(() => window.cascade.current), "DSGN-348");
  await page.screenshot({ path: `${dir}/08-fiber-run-arrive.png` });
  await page.evaluate(() => window.cascade.focus("MATL-686"));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.cascade.pauseAnimations(true));
  assert.equal(await page.evaluate(() => window.cascade.state.run), -1, "Without a direct citation the ring rolls");
  assert.equal(
    await page.evaluate(() => {
      const c = window.cascade;
      return c.nodes[c.state.transitionTarget].id;
    }),
    "MATL-686",
  );
  assert(
    await page.evaluate(
      () =>
        window.cascade.state.focusBlend > 0 &&
        window.cascade.state.focusBlend < 1,
    ),
  );
  await page.screenshot({ path: `${dir}/09-ring-roll-mid.png` });
  await page.screenshot({ path: `${dir}/20-ring-roll-focus-mid.png` });
  await page.evaluate(() => window.cascade.pauseAnimations(false));
  await page.waitForTimeout(2600);
  assert.equal(await page.evaluate(() => window.cascade.current), "MATL-686");
  // Voltar percorre a cascata ate a primeira norma clicada.
  assert(await page.locator("#back").isVisible());
  await page.locator("#back").click();
  await page.waitForTimeout(2800);
  assert.equal(await page.evaluate(() => window.cascade.current), "DSGN-348");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(2800);
  assert.equal(await page.evaluate(() => window.cascade.current), "DSGN-347");
  assert(await page.locator("#back").isHidden());
  await page.screenshot({ path: `${dir}/23-back-to-first.png` });
  // Norma final sem codigo novo.
  await page.evaluate(() => window.cascade.focus("W-B-0718"));
  await page.waitForTimeout(3000);
  assert.equal(await page.evaluate(() => window.cascade.current), "W-B-0718");
  assert.equal(await page.locator("#panel .relation").count(), 9);
  await page.screenshot({ path: `${dir}/24-final-legacy-W-B-0718.png` });
  await page.evaluate(() => window.cascade.overview());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/10-public-ring.png` });
  // Outros comportamentos funcionais: vazio, teclado, legado, tema e preferência.
  await page.locator("#search").fill("nothing-should-match-012345");
  await page.waitForTimeout(140);
  assert((await page.locator("#results").innerText()).includes("No match"));
  await page.locator("#search").fill("WNA 5031");
  await page.waitForTimeout(140);
  assert((await page.locator(".result").count()) > 0);
  await page.locator("#search").press("ArrowDown");
  await page.locator("#search").press("Escape");
  await page.keyboard.press("/");
  assert(
    await page.locator("#search").evaluate((e) => e === document.activeElement),
  );
  await page.locator("#search").press("Escape");
  // Arrastar com o botao esquerdo gira a roda (sem selecionar norma) e segue com inercia.
  await page.evaluate(() => window.cascade.overview());
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => window.cascade.state.rotation);
  await page.mouse.move(600, 820);
  await page.mouse.down();
  for (let x = 600; x <= 1000; x += 20) {
    await page.mouse.move(x, 830);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  const released = await page.evaluate(() => window.cascade.state.rotation);
  await page.waitForTimeout(1200);
  const settled = await page.evaluate(() => window.cascade.state.rotation);
  assert(released - before > 0.5, "Dragging right along the bottom turns the wheel");
  assert(settled > released, "Wheel keeps gliding after release");
  assert.equal(await page.evaluate(() => window.cascade.current), "", "A drag is not a click");
  await page.screenshot({ path: `${dir}/14-drag-rotate.png` });
  const metrics = {};
  await page.evaluate(() => window.cascade.focus("ISO 554"));
  await page.waitForTimeout(2600);
  const expectedPublic = await page.evaluate(
    () =>
      window.cascade.data.public.filter((e) => e.target === "ISO 554").length,
  );
  const publicSection = page
    .locator("#panel section")
    .filter({ has: page.locator("h3", { hasText: "Required by" }) });
  assert.equal(
    await publicSection.locator(".relation").count(),
    expectedPublic,
  );
  await page.screenshot({ path: `${dir}/16-public-details.png` });
  await page.evaluate(() => window.cascade.focus("MATL-686"));
  await page.waitForTimeout(2600);
  const opened = await page.evaluate(() => {
    let target = "";
    const original = window.open;
    window.open = (u) => ((target = String(u)), null);
    document.querySelector("#open-pdf").click();
    window.open = original;
    return target;
  });
  assert(opened.startsWith("file:"), "Open PDF opens the file directly, with no dialog");
  await page.locator("#search").fill("");
  await page.waitForTimeout(100);
  assert(await page.locator("#results").evaluate((e) => e.hidden));
  await page.evaluate(() => window.cascade.overview());
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => window.cascade.state.mix), 0);
  for (const removed of ["#transition", "#public", "#live", "#fps", "#file-dialog"])
    assert.equal(await page.locator(removed).count(), 0, removed + " was removed");
  async function measure(name, action) {
    await page.evaluate(() => (window.cascade.samples.length = 0));
    await action();
    const s = await page.evaluate(() => window.cascade.samples.slice(2));
    metrics[name] = {
      fps: 1000 / (s.reduce((a, b) => a + b, 0) / s.length),
      frames: s.length,
      p95ms: s.sort((a, b) => a - b)[Math.floor(s.length * 0.95)],
    };
  }
  await measure("idle", () => page.waitForTimeout(4000));
  await page.evaluate(() => window.cascade.focus("DSGN-347"));
  await page.waitForTimeout(2600);
  await measure("focus", () => page.waitForTimeout(4000));
  await measure("fiberRun", async () => {
    for (const id of ["DSGN-348", "DSGN-347", "DSGN-348"]) {
      await page.evaluate((id) => window.cascade.focus(id), id);
      await page.waitForTimeout(2800);
    }
  });
  await measure("ringRoll", async () => {
    for (const id of ["MATL-686", "MEAS-579", "DSGN-347"]) {
      await page.evaluate((id) => window.cascade.focus(id), id);
      await page.waitForTimeout(2600);
    }
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForFunction(() => window.cascade);
  assert.equal(await page.evaluate(() => window.cascade.state.live), false);
  await context.close();
  // Vídeo de fluxo completo separado da medição de FPS.
  const videoContext = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir: ".tmp/video", size: { width: 1600, height: 1000 } },
  });
  const v = await videoContext.newPage();
  await v.route("**/*", (r) =>
    r.request().url().startsWith("file:") ? r.continue() : r.abort(),
  );
  await v.goto(url);
  await v.waitForTimeout(3200);
  await v.locator("#search").fill("drawing");
  await v.waitForTimeout(650);
  await v.locator("#search").fill("DSGN-347");
  await v.waitForTimeout(140);
  await v.locator("#search").press("Enter");
  await v.waitForTimeout(2600);
  await v.locator('.relation[data-target="DSGN-348"]').first().click();
  await v.waitForTimeout(3200);
  await v.evaluate(() => window.cascade.focus("MATL-686"));
  await v.waitForTimeout(3000);
  await v.locator("#back").click();
  await v.waitForTimeout(3000);
  const video = v.video();
  await videoContext.close();
  await video.saveAs(`${dir}/15-full-flow.webm`);
  await browser.close();
  const result = {
    viewport: [1600, 1000],
    environment,
    metrics,
    errors,
    externalRequests: network,
  };
  fs.writeFileSync(`${dir}/metrics.json`, JSON.stringify(result, null, 2));
  console.log(result);
  assert.equal(errors.length, 0);
  assert.equal(network.length, 0);
  for (const [mode, m] of Object.entries(metrics))
    assert(m.fps >= 55, `${mode}: ${m.fps} below 55`);
})().catch(async (e) => {
  console.error(e);
  await activeBrowser?.close();
  process.exitCode = 1;
});
