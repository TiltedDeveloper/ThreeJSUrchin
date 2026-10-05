const { test, expect } = require('@playwright/test');
const { PNG } = require('pngjs');
const { readFileSync } = require('node:fs');

// Observe both bundles through Three.js's devtools hook, without changing app code.
function observeScene() {
    const callbacks = new Map();
    let nextFrame = 0;
    let skipRender = false;
    const probe = { scene: null, renderer: null, camera: null };
    window.__sceneProbe = probe;
    window.requestAnimationFrame = (callback) => {
        callbacks.set(++nextFrame, callback);
        return nextFrame;
    };
    window.cancelAnimationFrame = (id) => callbacks.delete(id);
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', ({ detail }) => {
        if (detail.isScene) probe.scene = detail;
        if (detail.isWebGLRenderer) {
            probe.renderer = detail;
            const render = detail.render.bind(detail);
            detail.render = (scene, camera) => {
                probe.camera = camera;
                if (!skipRender) render(scene, camera);
            };
        }
    });
    probe.step = (count = 1) => {
        for (let frame = 0; frame < count; frame++) {
            skipRender = frame < count - 1;
            const pending = [...callbacks.values()];
            callbacks.clear();
            for (const callback of pending) callback(performance.now());
        }
        skipRender = false;
    };
    probe.capture = () => {
        probe.renderer.render(probe.scene, probe.camera);
        return probe.renderer.domElement.toDataURL('image/png').split(',')[1];
    };
    probe.state = () => {
        const model = probe.scene.getObjectByName('Urchin');
        return {
            camera: {
                position: probe.camera.position.toArray(),
                fov: probe.camera.fov,
                near: probe.camera.near,
                far: probe.camera.far,
                aspect: probe.camera.aspect,
            },
            canvas: [probe.renderer.domElement.width, probe.renderer.domElement.height],
            antialias: probe.renderer.getContext().getContextAttributes().antialias,
            toneMapping: probe.renderer.toneMapping,
            lights: probe.scene.children.filter((child) => child.isLight).map((light) => ({
                type: light.type,
                intensity: light.intensity,
                position: light.position.toArray(),
            })),
            worlds: probe.scene.children.filter((child) => child.geometry?.type === 'SphereGeometry').map((world) => ({
                geometry: world.geometry.parameters,
                image: new URL(world.material.map.image.src).pathname.split('/').pop(),
                side: world.material.side,
                shininess: world.material.shininess,
                specular: world.material.specular.getHex(),
                colorSpace: world.material.map.colorSpace,
            })),
            model: { scale: model.scale.toArray(), rotation: model.rotation.toArray() },
        };
    };
}

async function loadScene(browser, viewport, path, contextOptions = {}) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, ...contextOptions });
    const failures = [];
    const failedRequests = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('requestfailed', (request) => failedRequests.push({ error: request.failure()?.errorText, url: request.url() }));
    page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    await page.addInitScript(observeScene);
    await page.goto(`http://127.0.0.1:4173${path}`);
    await page.waitForFunction(() => {
        const scene = window.__sceneProbe.scene;
        const worlds = scene?.children.filter((child) => child.geometry?.type === 'SphereGeometry');
        return scene?.getObjectByName('Urchin') && worlds?.length === 5 &&
            worlds.every((world) => world.material.map.image?.naturalWidth > 0);
    }, null, { timeout: 30_000 });
    const modelUrl = new URL('b4b5396601f3dd397682.fbx', page.url()).href;
    return {
        page,
        get failures() {
            // Chrome can report a consumed streaming FBX fetch as aborted. The
            // readiness wait above requires a parsed model; asset bytes are also checked.
            return [...failures, ...failedRequests
                .filter(({ error, url }) => !(error === 'net::ERR_ABORTED' && url === modelUrl))
                .map(({ error, url }) => `${error} ${url}`)];
        },
    };
}

async function capture(page) {
    const base64 = await page.evaluate(() => window.__sceneProbe.capture());
    return Buffer.from(base64, 'base64');
}

function comparePixels(originalBuffer, rebuiltBuffer) {
    const original = PNG.sync.read(originalBuffer);
    const rebuilt = PNG.sync.read(rebuiltBuffer);
    expect([rebuilt.width, rebuilt.height]).toEqual([original.width, original.height]);
    let litPixels = 0;
    let difference = 0;
    for (let index = 0; index < rebuilt.data.length; index += 4) {
        if (Math.max(...rebuilt.data.subarray(index, index + 3)) > 12) litPixels++;
        for (let channel = 0; channel < 3; channel++) {
            difference += Math.abs(original.data[index + channel] - rebuilt.data[index + channel]);
        }
    }
    expect(litPixels / (rebuilt.width * rebuilt.height)).toBeGreaterThan(0.01);
    expect(difference / (rebuilt.width * rebuilt.height * 3)).toBeLessThan(0.5);
}

for (const [label, viewport] of Object.entries({
    desktop: { width: 1280, height: 800 },
    mobile: { width: 390, height: 844 },
})) {
    test(`${label}: rebuilt scene matches the original and responds to input`, async ({ browser }, testInfo) => {
        const original = await loadScene(browser, viewport, '/');
        const rebuilt = await loadScene(browser, viewport, '/dist/client/');
        const pages = [original.page, rebuilt.page];
        try {
            const initialStates = await Promise.all(pages.map((page) => page.evaluate(() => window.__sceneProbe.state())));
            expect(initialStates[1]).toEqual(initialStates[0]);

            // Fast-forward the original frame-based fade, drawing only the final frame.
            await Promise.all(pages.map((page) => page.evaluate(() => window.__sceneProbe.step(2001))));
            const states = await Promise.all(pages.map((page) => page.evaluate(() => window.__sceneProbe.state())));
            expect(states[1]).toEqual(states[0]);
            expect(states[1].lights.every((light) => light.intensity >= 2)).toBe(true);
            expect(states[1].model.rotation[1]).toBeGreaterThan(initialStates[1].model.rotation[1]);

            for (const distance of [2, 30, 300, 3000, 30000]) {
                await Promise.all(pages.map((page) => page.evaluate((radius) => {
                    const probe = window.__sceneProbe;
                    probe.camera.position.normalize().multiplyScalar(radius);
                    probe.step();
                }, distance)));
                const images = await Promise.all(pages.map(capture));
                comparePixels(images[0], images[1]);
                await testInfo.attach(`world-${distance}`, { body: images[1], contentType: 'image/png' });
            }

            const page = rebuilt.page;
            await page.evaluate(() => {
                window.__sceneProbe.camera.position.normalize().multiplyScalar(2);
                window.__sceneProbe.step();
            });
            await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
            const layout = await page.evaluate(() => {
                const heading = document.getElementById('UrchinHeading').getBoundingClientRect();
                const canvas = document.querySelector('canvas').getBoundingClientRect();
                return { headingBottom: heading.bottom, canvasTop: canvas.top, headingRight: heading.right, width: innerWidth };
            });
            expect(layout.headingBottom).toBeLessThanOrEqual(layout.canvasTop);
            expect(layout.headingRight).toBeLessThanOrEqual(layout.width);

            const before = await capture(page);
            await page.evaluate(() => window.__sceneProbe.step(30));
            expect((await capture(page)).equals(before)).toBe(false);

            const position = await page.evaluate(() => window.__sceneProbe.camera.position.toArray());
            await page.mouse.move(viewport.width / 4, viewport.height / 2);
            await page.mouse.down();
            await page.mouse.move(viewport.width / 4 + 60, viewport.height / 2 + 20, { steps: 5 });
            await page.mouse.up();
            await page.evaluate(() => window.__sceneProbe.step(60));
            expect(await page.evaluate(() => window.__sceneProbe.camera.position.toArray())).not.toEqual(position);
            const distance = await page.evaluate(() => window.__sceneProbe.camera.position.length());
            await page.mouse.wheel(0, 600);
            await expect.poll(() => page.evaluate(() => window.__sceneProbe.camera.position.length())).toBeGreaterThan(distance);

            // Let orbit damping settle before testing that right-drag cannot pan.
            await page.evaluate(() => window.__sceneProbe.step(300));
            const targetPosition = await page.evaluate(() => window.__sceneProbe.camera.position.toArray());
            await page.mouse.down({ button: 'right' });
            await page.mouse.move(viewport.width / 2 - 40, viewport.height / 2 + 40);
            await page.mouse.up({ button: 'right' });
            await page.evaluate(() => window.__sceneProbe.step(60));
            const afterPan = await page.evaluate(() => window.__sceneProbe.camera.position.toArray());
            afterPan.forEach((value, index) => expect(value).toBeCloseTo(targetPosition[index], 4));

            await page.setViewportSize({ width: 700, height: 500 });
            await expect.poll(() => page.evaluate(() => window.__sceneProbe.camera.aspect)).toBe(1.4);
            expect(await page.evaluate(() => window.__sceneProbe.state().canvas)).toEqual([700, 500]);
            expect(original.failures).toEqual([]);
            expect(rebuilt.failures).toEqual([]);
        } finally {
            await Promise.all(pages.map((page) => page.close()));
        }
    });
}

async function showSection(page, id) {
    await page.evaluate((section) => {
        const probe = window.__sceneProbe;
        probe.scene.getObjectByName('Urchin').rotation.y = -['about', 'work', 'contact'].indexOf(section) * Math.PI * 2 / 3;
        probe.step();
    }, id);
    const button = page.locator(`.shell-marker[data-section="${id}"]`);
    await expect(button).toBeVisible();
    return button;
}

for (const [label, viewport] of Object.entries({
    desktop: { width: 1280, height: 800 },
    mobile: { width: 390, height: 844 },
})) {
    test(`${label}: shell markers, modal pause, and zoom limits`, async ({ browser }, testInfo) => {
        const loaded = await loadScene(browser, viewport, '/dist/client/', {
            hasTouch: true, isMobile: label === 'mobile',
        });
        const { page } = loaded;
        try {
            const dialog = page.getByRole('dialog');
            const close = page.getByRole('button', { name: 'Close dialog' });
            const startingDistance = await page.evaluate(() => window.__sceneProbe.camera.position.length());
            await expect(page.locator('.shell-marker')).toHaveCount(3);
            let about = await showSection(page, 'about');
            await expect(page.locator('.shell-marker[data-section="work"]')).toBeHidden();
            await expect(page.locator('.shell-marker[data-section="contact"]')).toBeHidden();
            const size = await about.boundingBox();
            expect([size.width, size.height]).toEqual([44, 44]);

            // A gesture that crosses the threshold must not become a click on return.
            await page.mouse.move(size.x + 22, size.y + 22);
            await page.mouse.down();
            await page.mouse.move(size.x + 40, size.y + 22);
            await page.mouse.move(size.x + 22, size.y + 22);
            await page.mouse.up();
            await expect(dialog).not.toBeVisible();

            for (const [index, id] of ['about', 'work', 'contact'].entries()) {
                const button = await showSection(page, id);
                if (label === 'mobile') await button.tap();
                else await button.click();
                await expect(dialog).toBeVisible();
                await expect(dialog.getByRole('heading')).toHaveText(id[0].toUpperCase() + id.slice(1));
                await expect(close).toBeFocused();
                const paused = await page.evaluate(() => window.__sceneProbe.state());
                await page.mouse.wheel(0, 500);
                await page.evaluate(() => window.__sceneProbe.step(30));
                const after = await page.evaluate(() => window.__sceneProbe.state());
                expect(after.model.rotation).toEqual(paused.model.rotation);
                expect(after.camera.position).toEqual(paused.camera.position);
                expect(after.lights[0].intensity).toBeGreaterThan(paused.lights[0].intensity);
                await page.keyboard.press('Tab');
                expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement))).toBe(true);
                await page.keyboard.press('Shift+Tab');
                expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement))).toBe(true);

                if (index === 0) await close.click();
                if (index === 1) await page.keyboard.press('Escape');
                if (index === 2) await page.mouse.click(4, 4);
                await expect(dialog).not.toBeVisible();
                await expect(button).toBeFocused();
                await page.evaluate(() => window.__sceneProbe.step());
                expect((await page.evaluate(() => window.__sceneProbe.state())).model.rotation).not.toEqual(paused.model.rotation);
            }

            about = await showSection(page, 'about');
            await about.focus();
            await expect(about.locator('.shell-marker__tooltip')).toBeVisible();
            await page.keyboard.press('Enter');
            await expect(dialog).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(about).toBeFocused();
            await page.keyboard.press('Space');
            await expect(dialog).toBeVisible();
            await close.click();

            // The limit covers wheel, middle-button dolly, and native touch pinch.
            await page.mouse.move(30, viewport.height / 2);
            await page.mouse.wheel(0, 500);
            await expect.poll(() => page.evaluate(() => window.__sceneProbe.camera.position.length())).toBeGreaterThan(startingDistance);
            for (let index = 0; index < 12; index++) {
                await page.mouse.wheel(0, -500);
                await page.evaluate(() => window.__sceneProbe.step());
            }
            expect(await page.evaluate(() => window.__sceneProbe.camera.position.length())).toBeCloseTo(startingDistance, 8);
            await page.mouse.down({ button: 'middle' });
            await page.mouse.move(30, viewport.height / 2 - 80, { steps: 4 });
            await page.mouse.up({ button: 'middle' });
            await page.evaluate(() => window.__sceneProbe.step());
            expect(await page.evaluate(() => window.__sceneProbe.camera.position.length())).toBeCloseTo(startingDistance, 8);

            const session = await page.context().newCDPSession(page);
            const pinch = async (startGap, endGap) => {
                const centerX = viewport.width / 2;
                const y = viewport.height * 0.8;
                const touches = (gap) => [
                    { x: centerX - gap / 2, y, id: 1 },
                    { x: centerX + gap / 2, y, id: 2 },
                ];
                await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(startGap) });
                for (let step = 1; step <= 4; step++) {
                    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(startGap + (endGap - startGap) * step / 4) });
                    await page.evaluate(() => window.__sceneProbe.step());
                }
                await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            };
            await pinch(60, 180);
            expect(await page.evaluate(() => window.__sceneProbe.camera.position.length())).toBeCloseTo(startingDistance, 8);
            await pinch(180, 60);
            expect(await page.evaluate(() => window.__sceneProbe.camera.position.length())).toBeGreaterThan(startingDistance);
            await session.detach();

            await page.evaluate((distance) => {
                window.__sceneProbe.camera.position.normalize().multiplyScalar(distance * 2.5);
            }, startingDistance);
            about = await showSection(page, 'about');
            expect(Number(await about.evaluate((button) => button.style.opacity))).toBeCloseTo(0.5, 5);
            await page.evaluate((distance) => {
                window.__sceneProbe.camera.position.normalize().multiplyScalar(distance * 3.1);
                window.__sceneProbe.step();
            }, startingDistance);
            await expect(page.locator('.shell-marker:visible')).toHaveCount(0);

            await page.evaluate((distance) => {
                window.__sceneProbe.camera.position.set(-1, 0.6, 1.2).normalize().multiplyScalar(distance);
                window.__sceneProbe.step(2001);
            }, startingDistance);
            about = await showSection(page, 'about');
            await page.mouse.move(0, 0);
            await page.screenshot({ path: testInfo.outputPath(`${label}-markers.png`) });
            const firstPosition = await about.boundingBox();
            await page.evaluate(() => window.__sceneProbe.step(100));
            const movedPosition = await about.boundingBox();
            expect(Math.hypot(movedPosition.x - firstPosition.x, movedPosition.y - firstPosition.y)).toBeGreaterThan(1);

            // Opening a dialog must also freeze residual orbit damping.
            await page.mouse.move(30, 120);
            await page.mouse.down();
            await page.mouse.move(40, 125, { steps: 2 });
            await page.mouse.up();
            await about.click();
            const frozen = await page.evaluate(() => window.__sceneProbe.state());
            await page.screenshot({ path: testInfo.outputPath(`${label}-dialog.png`) });
            await page.setViewportSize({ width: 320, height: 300 });
            await expect.poll(() => page.evaluate(() => window.__sceneProbe.state().canvas)).toEqual([320, 300]);
            await page.evaluate(() => window.__sceneProbe.step(10));
            const resized = await page.evaluate(() => window.__sceneProbe.state());
            expect(resized.model.rotation).toEqual(frozen.model.rotation);
            expect(resized.camera.position).toEqual(frozen.camera.position);
            const bounds = await dialog.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(300);
            await close.click();
            await expect(dialog).not.toBeVisible();
            await showSection(page, 'about');
            await page.locator('.shell-marker[data-section="about"]').click();
            await page.setViewportSize({ width: 320, height: 80 });
            await expect.poll(() => page.evaluate(() => window.__sceneProbe.state().canvas)).toEqual([320, 80]);
            await expect(page.locator('.shell-marker:visible')).toHaveCount(0);
            await page.keyboard.press('Escape');
            await expect(page.locator('canvas')).toBeFocused();
            expect(loaded.failures).toEqual([]);
        } finally {
            await page.close();
        }
    });
}

test('build contains the custom domain and unchanged static assets', async () => {
    for (const filename of [
        'index.html', 'style.css', 'CNAME',
        '7a5ad68f1a9349a4605b.jpg', '380b6ece336672a1f8f4.jpg',
        '2c04fc5017458fdf96a0.png', 'f3054be440efc1d9e27d.jpg',
        '7ce9f15429d3ecee33b2.jpg', 'b4b5396601f3dd397682.fbx',
    ]) {
        expect(readFileSync(`dist/client/${filename}`).equals(readFileSync(filename))).toBe(true);
    }
});
