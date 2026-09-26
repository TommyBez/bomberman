import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end smoke tests against the production build (`vite preview`).
 * The game exposes its App object as `window.__bomberman` so tests can read state.
 */

type AnyScene = Record<string, any>;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function scene(page: Page): Promise<AnyScene> {
  return page.evaluate(() => {
    const s = (window as any).__bomberman.scenes.scene;
    return {
      hasWorld: !!s?.world,
      phase: s?.phase,
      stage: s?.session?.stageNumber,
      version: s?.session?.version,
      bombs: s?.session?.powers?.bombs,
      fire: s?.session?.powers?.fire,
      demo: s?.match?.demo,
      bombers: s?.world?.bombers?.length,
      menu: s?.menu?.items?.map((i: any) => i.label),
    };
  });
}

async function waitFor(page: Page, fn: string, timeout = 20_000): Promise<void> {
  await page.waitForFunction(`(() => { const s = window.__bomberman?.scenes.scene; return !!(${fn}); })()`, null, { timeout });
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
}

test('boots to the title screen without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('#screen')).toBeVisible();
  await waitFor(page, 's && s.idle !== undefined');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('Normal Game: menus lead to stage 1 and Bomberman can walk and bomb', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitFor(page, 's && s.idle !== undefined');
  await page.waitForTimeout(500);
  await press(page, 'Enter'); // PRESS START
  await waitFor(page, 's && s.menu');
  await page.waitForTimeout(400);
  await press(page, 'Enter'); // NORMAL GAME
  await page.waitForTimeout(600);
  await press(page, 'Enter'); // NEW GAME
  await page.waitForTimeout(600);
  await press(page, 'Enter'); // MODERN
  await waitFor(page, 's && s.world && s.phase === "play"', 30_000);
  const info = await scene(page);
  expect(info.stage).toBe(1);
  expect(info.version).toBe('modern');

  const x0 = await page.evaluate(() => (window as any).__bomberman.scenes.scene.world.player.x);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  const x1 = await page.evaluate(() => (window as any).__bomberman.scenes.scene.world.player.x);
  expect(x1).toBeGreaterThan(x0);

  await press(page, 'Space');
  await waitFor(page, 's.world.bombs.length === 1', 2_000);
  // Walk away from the bomb (back to the start pocket) and let it explode.
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowDown');
  await waitFor(page, 's.world.bombs.length === 0', 5_000);
  expect(errors).toEqual([]);
});

test('Normal Game: a password restores stage and power-ups', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitFor(page, 's && s.idle !== undefined');
  await page.waitForTimeout(500);
  await press(page, 'Enter');
  await waitFor(page, 's && s.menu');
  await page.waitForTimeout(400);
  await press(page, 'Enter'); // NORMAL GAME
  await page.waitForTimeout(600);
  await press(page, 'ArrowDown');
  await press(page, 'Enter'); // CONTINUE
  await page.waitForTimeout(600);
  await press(page, 'Enter'); // PASSWORD
  await page.waitForTimeout(600);
  await page.keyboard.type('0KA53KU1', { delay: 60 });
  await press(page, 'Enter');
  await waitFor(page, 's && s.world', 10_000);
  const info = await scene(page);
  expect(info).toMatchObject({ stage: 24, bombs: 4, fire: 3, version: 'modern' });
  expect(errors).toEqual([]);
});

test('Battle Game: the setup menus start a round with you and three CPUs', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitFor(page, 's && s.idle !== undefined');
  await page.waitForTimeout(500);
  await press(page, 'Enter'); // PRESS START
  await waitFor(page, 's && s.menu');
  await page.waitForTimeout(400);
  await press(page, 'ArrowDown');
  await press(page, 'Enter'); // BATTLE GAME
  // BATTLE ROYAL → BEGINNER → SINGLE MATCH
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(500);
    await press(page, 'Enter');
  }
  await page.waitForTimeout(500);
  await press(page, 'ArrowUp'); // wrap to OK on the rules screen
  await press(page, 'Enter');
  await page.waitForTimeout(500);
  await press(page, 'Enter'); // players: P1 human, P2-P4 computer
  await page.waitForTimeout(500);
  await press(page, 'Enter'); // stage 1
  await waitFor(page, 's && s.world && s.phase === "play"', 20_000);
  expect((await scene(page)).bombers).toBe(4);
  // P1 answers the keyboard (WASD + Space).
  const x0 = await page.evaluate(() => (window as any).__bomberman.scenes.scene.world.bombers[0].x);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  const x1 = await page.evaluate(() => (window as any).__bomberman.scenes.scene.world.bombers[0].x);
  expect(x1).toBeGreaterThan(x0);
  expect(errors).toEqual([]);
});

test('Battle Game: five computer players fight a round', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#demo=n4');
  await waitFor(page, 's && s.world && s.phase === "play"', 20_000);
  expect((await scene(page)).bombers).toBe(5);
  // Let the CPUs play for a while: bombs get placed and blow up.
  await page.waitForFunction(
    () => {
      const w = (window as any).__bomberman.scenes.scene.world;
      return !w || w.bombsExploded > 0;
    },
    null,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(5_000);
  expect(errors).toEqual([]);
});

test('Title: Demo Play starts when idle and a key returns to the title', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitFor(page, 's && s.idle !== undefined');
  await page.evaluate(() => ((window as any).__bomberman.scenes.scene.idle = 20 * 60 - 5));
  await waitFor(page, 's && s.match && s.match.demo === true', 10_000);
  await page.waitForTimeout(2_000);
  await press(page, 'Space');
  await waitFor(page, 's && s.idle !== undefined', 10_000);
  expect(errors).toEqual([]);
});
