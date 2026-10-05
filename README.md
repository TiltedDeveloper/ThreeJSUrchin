# ThreeJSUrchin

Editable source for the Urchin Studios Three.js website. The TypeScript and
Webpack setup were recovered from commit `1768aa7`, then reconciled with the
root deployment bundle at `feaa848`. Three.js is pinned to `0.157.0` to preserve
the existing rendering, controls, model loading, and lighting behavior.

## Local Development

Install Node.js LTS, then run from this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Webpack (normally `http://127.0.0.1:8080`). Source edits
rebuild automatically and reload the page. Stop the server with Ctrl+C.

Use this server to preview source changes. Live Server at the repository root
still runs the old `bundle.js`, not the restored TypeScript.

## What to Edit

- `src/client/client.ts`: camera, lighting, controls, textured worlds, model,
  and animation. Scene settings and texture mappings are near the top.
- `src/client/shell-interactions.ts`: About, Work, and Contact placeholder copy,
  icons, shell attachment points, and modal behavior. Edit `createSections` for
  section content.
- `index.html`: title and overlay text.
- `style.css`: styles. The HTML also contains existing inline styles.
- Root `.jpg`, `.png`, and `.fbx` files: original deployment assets. Their
  hashed filenames are kept to avoid duplicating large files; readable world
  names and their paths are in `client.ts`.

The old source alone did not contain the current five worlds, camera settings,
antialiasing, disabled panning, or lighting fade. Those were recovered from the
current bundle. Frame-dependent animation timing and the existing layout are
intentionally preserved in this restoration.

The opening camera distance is now the minimum zoom distance. Shell markers
face the viewer, disappear behind the shell, and fade out between twice and
three times the opening distance. A marker opens a modal that pauses shell
rotation and camera controls. Close it with the X button, Escape, or the
backdrop to resume. The dialog text is placeholder content, with no contact
form or external service.

## Build and Check

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run preview
```

The standalone production site is generated in `dist/client`, including HTML,
CSS, the new bundle, images, the model, and `CNAME`. Preview it at
`http://127.0.0.1:8081`. Builds do not overwrite the existing root bundle.

```powershell
npm.cmd test
```

Browser checks compare the rebuilt site with the original root bundle on
desktop and mobile, including rendered pixels, assets, lighting, rotation,
orbiting, zooming, and resizing. By default they use installed Google Chrome.
For Playwright's Chromium, run `npx.cmd playwright install chromium` and set
`$env:PLAYWRIGHT_CHANNEL = 'chromium'` before running the tests.

## Publishing

Nothing in the restored setup automatically publishes or changes GitHub Pages
settings. `npm run build` only creates local files. When ready to release,
publish the **contents of `dist/client`** through the repository's Pages
deployment process, retaining `CNAME` for `urchinxr.com`.

If Pages currently publishes the repository root, source edits alone will not
update the live JavaScript. Either explicitly replace the root deployment
files with the build output, or configure Pages to deploy `dist/client` as an
Actions artifact. Confirm the publishing settings before making that change.
