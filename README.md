# Cookie Poster

Browser extension to send cookies from the active tab to a configured POST endpoint.

This tool is intended for developers only.

## GitHub

- Source code: https://github.com/JuanSotoM/cookie-poster

## Why this can be necessary

- Validate authenticated integrations without manually copying cookies each time.
- Reproduce backend session bugs quickly by posting real browser cookie state to a local or staging endpoint.
- Automate QA and debugging flows when testing multiple domains/environments with different tokens and targets.

## Project Structure

```text
cookie-poster/
├─ manifest.json
├─ tsconfig.json
├─ package.json
├─ pnpm-lock.yaml
├─ build/
│  ├─ background/
│  │  └─ service-worker.js
│  ├─ options/
│  │  └─ options.js
│  ├─ popup/
│  │  └─ popup.js
│  └─ shared/
│     ├─ get-all-cookies.js
│     └─ post-profiles.js
├─ src/
│  ├─ background/
│  │  └─ service-worker.ts
│  ├─ content/
│  │  └─ content-script.ts
│  ├─ popup/
│  │  ├─ popup.html
│  │  ├─ popup.ts
│  │  └─ popup.css
│  ├─ options/
│  │  ├─ options.html
│  │  ├─ options.ts
│  │  └─ options.css
│  ├─ assets/
│  │  ├─ icon-16.png
│  │  ├─ icon-32.png
│  │  ├─ icon-48.png
│  │  └─ icon-128.png
│  ├─ types/
│  │  ├─ custom.d.ts
│  │  └─ express/
│  │     └─ index.d.ts
│  └─ shared/
│     ├─ get-all-cookies.ts
│     └─ post-profiles.ts
└─ README.md
```

## TypeScript Build

- Install dependencies with `pnpm install`.
- Build compiled runtime files with `pnpm build`.
- Optional watch mode: `pnpm watch`.
- The extension loads compiled JS from the `build/` folder.

## Behavior

- Options supports multiple profiles with: nombre, dominio, URL del POST y token.
- Popup has one smart action: Enviar por tab actual.
- Popup also renders one button per profile to execute that profile manually at any time.
- If a matching domain tab is not open, the extension attempts to collect cookies by domain.
- Default URL for new profiles is http://localhost:3000.
