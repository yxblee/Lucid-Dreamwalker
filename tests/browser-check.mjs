import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

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

async function crossThreshold() {
  await waitFor(() => window.__LUCID__.getMode() === 'dream' && !document.querySelector('#dream-intro').hidden);
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
  await page.click('#modal [data-action="hub"]');
  await waitFor(() => window.__LUCID__.getMode() === 'hub' && !window.__LUCID__.getPaused());
}

try {
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  assert.equal(await page.title(), 'LUCID — Dreamwalker');
  await page.screenshot({ path: '.artifacts/title.png' });
  await page.click('[data-action="new"]');
  await waitFor(() => window.__LUCID__.getMode() === 'hub');

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

  await page.keyboard.press('KeyU');
  await waitFor(() => window.__LUCID__.getPaused());
  assert.equal(await page.locator('#modal-title').textContent(), 'Strengthen the thread');
  await page.click('#modal [data-action="resume"]');

  await page.evaluate(() => window.__LUCID__.enterDream('bellwright'));
  await crossThreshold();
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
  await crossThreshold();
  await collectAndFinish('bellwright');
  assert.equal(await page.evaluate(() => window.__LUCID__.getState().abilities.doubleJump), true);

  await page.keyboard.press('Escape');
  await page.click('#modal [data-action="title"]');
  await waitFor(() => window.__LUCID__.getMode() === 'title');
  await page.click('[data-action="continue"]');
  await waitFor(() => window.__LUCID__.getMode() === 'hub');
  assert.ok(await page.evaluate(() => window.__LUCID__.getState().completed.includes('bellwright')));

  await page.evaluate(() => window.__LUCID__.enterDream('archivist'));
  await crossThreshold();
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
  await crossThreshold();
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
  await page.waitForTimeout(600);
  const winRect = await page.locator('#win-screen').evaluate((screen) => screen.getBoundingClientRect().toJSON());
  assert.deepEqual({ x: winRect.x, y: winRect.y, width: winRect.width, height: winRect.height }, { x: 0, y: 0, width: 1440, height: 900 });
  await page.screenshot({ path: '.artifacts/win.png' });
  await page.click('#win-screen [data-action="new"]');
  await waitFor(() => window.__LUCID__.getMode() === 'hub');
  assert.equal(await page.evaluate(() => window.__LUCID__.getState().completed.length), 0);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: '.artifacts/mobile-title.png' });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await mobile.close();

  assert.deepEqual(errors, [], 'No browser errors');
  console.log('Browser campaign passed: combat, all dreams and abilities, puzzles, upgrades, defeat/retry, save/continue, final win/restart, mobile layout, and clean console.');
} finally {
  await browser.close();
}
