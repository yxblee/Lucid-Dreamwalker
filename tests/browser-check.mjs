import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.LUCID_BASE_URL || 'http://127.0.0.1:5173';

await mkdir('.artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

async function waitFor(fn, arg = null) {
  await page.waitForFunction(fn, arg, { timeout: 15000, polling: 100 });
}

async function crossThreshold(id) {
  await waitFor(() => window.__LUCID__.getMode() === 'dream' && !document.querySelector('#dream-intro').hidden);
  assert.ok(await page.evaluate((dreamId) => window.__NARRATION_CUES__.includes(`voice-${dreamId}-intro`), id));
  await page.click('#dream-intro [data-action="resume"]', { force: true });
  await waitFor(() => !window.__LUCID__.getPaused());
}

async function collectAndFinish(id) {
  await page.evaluate(() => {
    const game = window.__LUCID__.getDream();
    for (const item of game.level.collectibles.filter((collectible) => collectible.kind === 'memory')) {
      Object.assign(game.player, { x: item.x, y: item.y, vx: 0, vy: 0 });
      game.update(0.016, window.__LUCID__.getInput());
    }
  });
  assert.equal(await page.evaluate(() => window.__LUCID__.getDream().memories), 3);
  await page.evaluate(() => {
    const game = window.__LUCID__.getDream();
    Object.assign(game.player, { x: game.level.exit.x, y: game.level.exit.y, vx: 0, vy: 0 });
    game.update(0.016, window.__LUCID__.getInput());
  });
  await waitFor(() => window.__LUCID__.getPaused());
  assert.ok(await page.evaluate((dreamId) => window.__LUCID__.getState().completed.includes(dreamId), id));
  assert.ok(await page.evaluate((dreamId) => window.__NARRATION_CUES__.includes(`clue-${dreamId}`), id));
  await page.click('#modal [data-action="hub"]');
  await waitFor(() => window.__LUCID__.getMode() === 'hub' && !window.__LUCID__.getPaused());
}

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  assert.equal(await page.title(), 'LUCID — Dreamwalker');
  await page.screenshot({ path: '.artifacts/title.png' });
  await page.evaluate(() => {
    const audio = window.__LUCID__.getAudio();
    window.__NARRATION_CUES__ = [];
    window.__NARRATION_STOPS__ = 0;
    const narrate = audio.narrate.bind(audio);
    const stopNarration = audio.stopNarration.bind(audio);
    audio.narrate = (id) => {
      window.__NARRATION_CUES__.push(id);
      return narrate(id);
    };
    audio.stopNarration = () => {
      window.__NARRATION_STOPS__ += 1;
      return stopNarration();
    };
  });
  await page.click('[data-action="new"]');
  await waitFor(() => window.__LUCID__.getMode() === 'hub');
  assert.ok(await page.evaluate(() => window.__NARRATION_CUES__.includes('narration-opening')));
  const generatedPlayback = await page.evaluate(async () => {
    const audio = window.__LUCID__.getAudio();
    const samples = 400;
    const bytes = new Uint8Array(44 + samples * 2);
    const view = new DataView(bytes.buffer);
    const write = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    write(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    write(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, samples * 2, true);
    for (let index = 0; index < samples; index += 1) view.setInt16(44 + index * 2, Math.sin(index / 8) * 5000, true);
    const url = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
    const createBufferSource = audio.context.createBufferSource.bind(audio.context);
    let sources = 0;
    audio.context.createBufferSource = () => {
      sources += 1;
      return createBufferSource();
    };
    audio.assets['sfx-jump'] = url;
    audio.assets['narration-opening'] = url;
    const played = await audio.sfx('jump');
    const narrated = await audio.narrate('narration-opening');
    audio.stopNarration();
    audio.context.createBufferSource = createBufferSource;
    delete audio.assets['sfx-jump'];
    delete audio.assets['narration-opening'];
    return { played, narrated, sources };
  });
  assert.deepEqual(generatedPlayback, { played: true, narrated: true, sources: 2 });

  await page.evaluate(() => {
    const hub = window.__LUCID__.getHub();
    hub.player.x = 0;
    hub.player.z = -16;
  });
  await page.keyboard.press('KeyE');
  await waitFor(() => !document.querySelector('#dialogue').hidden);
  assert.ok(await page.evaluate(() => window.__NARRATION_CUES__.includes('narration-sealed')));
  await page.click('#dialogue [data-action="resume"]');

  const startZ = await page.evaluate(() => window.__LUCID__.getHub().player.z);
  await page.keyboard.down('KeyW');
  await waitFor((z) => window.__LUCID__.getHub().player.z < z - 0.2, startZ);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => {
    const hub = window.__LUCID__.getHub();
    const enemy = hub.enemies[0];
    enemy.x = hub.player.x + 1.2;
    enemy.z = hub.player.z;
    enemy.health = 1;
  });
  await page.keyboard.press('KeyJ');
  await waitFor(() => window.__LUCID__.getState().enemiesDefeated === 1);
  await page.screenshot({ path: '.artifacts/hub.png' });

  await page.evaluate(() => {
    const hub = window.__LUCID__.getHub();
    hub.player.x = 0;
    hub.player.z = 3.5;
  });
  await page.keyboard.press('KeyE');
  await waitFor(() => !document.querySelector('#dialogue').hidden);
  assert.ok(await page.evaluate(() => window.__NARRATION_CUES__.includes('narration-dais')));
  await page.click('#dialogue [data-action="resume"]');

  const narrationStops = await page.evaluate(() => window.__NARRATION_STOPS__);
  await page.keyboard.press('KeyU');
  await waitFor(() => window.__LUCID__.getPaused());
  assert.ok(await page.evaluate((before) => window.__NARRATION_STOPS__ > before, narrationStops));
  assert.equal(await page.locator('#modal-title').textContent(), 'Strengthen the thread');
  await page.click('#modal [data-action="resume"]');

  await page.evaluate(() => window.__LUCID__.enterDream('bellwright'));
  await crossThreshold('bellwright');
  assert.equal(await page.locator('#touch-controls [data-key="Space"]').textContent(), 'Strike');
  await page.keyboard.press('Space');
  await waitFor(() => window.__LUCID__.getDream().player.attack > 0);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__LUCID__.getDream().player.jumps), 0);
  assert.ok(await page.evaluate(() => window.__LUCID__.getDream().player.grounded));
  await page.keyboard.down('KeyW');
  await waitFor(() => window.__LUCID__.getDream().player.vy < 0);
  await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(() => window.__LUCID__.getDream().player.jumps) >= 1);
  const gravity = await page.evaluate(() => window.__LUCID__.getDream().gravity);
  await page.keyboard.press('KeyG');
  await waitFor((previous) => window.__LUCID__.getDream().gravity === -previous, gravity);
  await waitFor(() => window.__LUCID__.getDream().gravityCooldown <= 0);
  await page.keyboard.press('KeyG');
  await waitFor((previous) => window.__LUCID__.getDream().gravity === previous, gravity);
  await page.screenshot({ path: '.artifacts/bellwright.png' });

  await page.evaluate(() => { window.__LUCID__.getDream().remaining = 0.01; });
  await waitFor(() => document.querySelector('#gameover-screen').hidden === false);
  await page.click('#gameover-screen [data-action="retry"]');
  await crossThreshold('bellwright');
  await collectAndFinish('bellwright');
  assert.equal(await page.evaluate(() => window.__LUCID__.getState().abilities.doubleJump), true);

  await page.keyboard.press('Escape');
  await page.click('#modal [data-action="title"]');
  await waitFor(() => window.__LUCID__.getMode() === 'title');
  await page.click('[data-action="continue"]');
  await waitFor(() => window.__LUCID__.getMode() === 'hub');
  assert.ok(await page.evaluate(() => window.__LUCID__.getState().completed.includes('bellwright')));

  await page.evaluate(() => window.__LUCID__.enterDream('archivist'));
  await crossThreshold('archivist');
  await page.evaluate(() => {
    const game = window.__LUCID__.getDream();
    Object.assign(game.player, { x: 300, y: 572, vx: 0, vy: 0, grounded: true, jumps: 0 });
  });
  await page.keyboard.down('KeyW');
  await waitFor(() => window.__LUCID__.getDream().player.jumps === 1);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyW');
  await waitFor(() => window.__LUCID__.getDream().player.jumps === 2);
  await page.evaluate(() => {
    const game = window.__LUCID__.getDream();
    Object.assign(game.player, { x: 300, y: 572, vx: 0, vy: 0, grounded: true, jumps: 0 });
  });
  await page.keyboard.press('ShiftLeft');
  await waitFor(() => window.__LUCID__.getDream().player.h === 27);
  await page.keyboard.down('KeyQ');
  await waitFor(() => window.__LUCID__.getDream().timeActive);
  await page.keyboard.up('KeyQ');
  await page.screenshot({ path: '.artifacts/archivist.png' });
  await collectAndFinish('archivist');
  assert.equal(await page.evaluate(() => window.__LUCID__.getState().abilities.time), true);
  assert.equal(await page.evaluate(() => window.__LUCID__.getState().abilities.fly), true);

  await page.evaluate(() => window.__LUCID__.enterDream('cartographer'));
  await crossThreshold('cartographer');
  await page.keyboard.down('KeyF');
  await waitFor(() => window.__LUCID__.getDream().player.vy < 0);
  await page.keyboard.up('KeyF');
  await page.evaluate(() => {
    const game = window.__LUCID__.getDream();
    const wall = game.level.walls[0];
    Object.assign(game.player, { x: wall.x - 45, y: wall.y + 40, vx: 0, vy: 0, facing: 1 });
  });
  await page.keyboard.press('Space');
  await waitFor(() => window.__LUCID__.getDream().level.walls[0].broken);
  await page.evaluate(() => {
    const game = window.__LUCID__.getDream();
    Object.assign(game.player, { x: 100, y: 560, vx: 0, vy: 0 });
    game.rewindBuffer = Array.from({ length: 40 }, (_, i) => ({ x: 50 + i, y: 560, vx: 0, vy: 0, gravity: 1, worldTime: i / 10, health: 100 }));
    game.player.focus = 100;
  });
  await page.keyboard.press('KeyR');
  await waitFor(() => window.__LUCID__.getDream().player.x < 100);
  await page.screenshot({ path: '.artifacts/cartographer.png' });
  await collectAndFinish('cartographer');
  assert.equal(await page.evaluate(() => window.__LUCID__.getState().artifact), true);

  await page.keyboard.press('KeyU');
  await page.click('[data-upgrade="blade"]');
  assert.equal(await page.evaluate(() => window.__LUCID__.getState().upgrades.blade), 1);
  await page.click('#modal [data-action="resume"]');
  await page.evaluate(() => {
    const hub = window.__LUCID__.getHub();
    hub.player.x = 0;
    hub.player.z = 3.5;
  });
  await page.keyboard.press('KeyE');
  await waitFor(() => window.__LUCID__.getMode() === 'win');
  assert.ok(await page.evaluate(() => window.__NARRATION_CUES__.includes('narration-win')));
  await page.waitForTimeout(600);
  const winRect = await page.locator('#win-screen').evaluate((screen) => screen.getBoundingClientRect().toJSON());
  assert.deepEqual({ x: winRect.x, y: winRect.y, width: winRect.width, height: winRect.height }, { x: 0, y: 0, width: 1440, height: 900 });
  await page.screenshot({ path: '.artifacts/win.png' });
  await page.setViewportSize({ width: 390, height: 600 });
  await page.waitForTimeout(100);
  const mobileWinAction = await page.locator('#win-screen [data-action="new"]').boundingBox();
  assert.ok(mobileWinAction.y >= 0 && mobileWinAction.y + mobileWinAction.height <= 600, 'Win actions remain reachable on short portrait screens');
  await page.screenshot({ path: '.artifacts/mobile-win.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('#win-screen [data-action="new"]');
  await waitFor(() => window.__LUCID__.getMode() === 'hub');
  assert.equal(await page.evaluate(() => window.__LUCID__.getState().completed.length), 0);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: '.artifacts/mobile-title.png' });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await mobile.close();

  const tablet = await browser.newPage({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  tablet.on('pageerror', (error) => errors.push(error.message));
  await tablet.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await tablet.click('[data-action="new"]');
  await tablet.waitForFunction(() => window.__LUCID__.getMode() === 'hub');
  assert.equal(await tablet.locator('#abilities').evaluate((element) => getComputedStyle(element).display), 'none');
  const tabletLayout = await tablet.evaluate(() => ({
    vitalsBottom: document.querySelector('.vitals').getBoundingClientRect().bottom,
    touchTop: document.querySelector('.touch-dpad').getBoundingClientRect().top
  }));
  assert.ok(tabletLayout.vitalsBottom <= tabletLayout.touchTop, 'Vitals and touch controls do not overlap on tablets');
  await tablet.close();

  const unavailableAudio = await browser.newPage();
  unavailableAudio.on('pageerror', (error) => errors.push(error.message));
  await unavailableAudio.addInitScript(() => {
    if (!window.AudioContext) return;
    Object.defineProperty(window.AudioContext.prototype, 'state', { configurable: true, get: () => 'suspended' });
    window.AudioContext.prototype.resume = () => new Promise(() => {});
  });
  await unavailableAudio.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await unavailableAudio.click('[data-action="new"]');
  await unavailableAudio.waitForFunction(() => window.__LUCID__.getMode() === 'hub');
  await unavailableAudio.close();

  assert.deepEqual(errors, [], 'No browser errors');
  console.log('Browser campaign passed: combat, all dreams and abilities, puzzles, upgrades, defeat/retry, save/continue, final win/restart, responsive layouts, unavailable audio, and clean console.');
} finally {
  await browser.close();
}
