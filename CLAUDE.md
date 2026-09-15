# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

NeoPot is a cross-platform (Windows/Linux) desktop tool for selection translation, input
translation, screenshot OCR, and screenshot translation. It is an Electron + React 19 +
TypeScript application, forked from Pot Desktop, migrating its UI to HeroUI/Tailwind 4 and its
state to Jotai. macOS is intentionally unsupported (no Apple Developer account). The primary
README is in Chinese; `README.en.md` is the English counterpart.

## Toolchain requirements

- Node.js `>= 24` (see `.node-version`), pnpm `>= 9`
- Uses pnpm workspaces; many native deps need build approval (see `pnpm-workspace.yaml`
  `allowBuilds`) — pnpm prompts for these on install.
- Electron 41, electron-vite 5, Vite 7, TypeScript 5.6 (strict, `noUnusedLocals`/
  `noUnusedParameters`).

## Commands

```bash
pnpm install              # install deps (may prompt to allow native builds)
pnpm run dev              # electron-vite dev (launches the app)
pnpm run build            # electron-vite build (outputs out/main, out/preload, out/renderer)
pnpm run make             # clean + build + Windows installer via electron-builder
pnpm run lint             # eslint .
pnpm run typecheck        # tsc --noEmit
pnpm run format           # prettier --write .
pnpm run format:check     # prettier --check . (part of the quality gate)

pnpm run test             # full release-confidence gate — MUST pass before commits/releases
pnpm run test:fast        # vitest run (unit + component + integration behavior tests)
pnpm run test:coverage    # test:fast + V8 coverage (thresholds: 25% lines/funcs/stmts, 20% branches)
pnpm run test:contracts   # node --test on tests/contract/*.test.mjs (cross-file invariants)
pnpm run test:e2e         # Playwright Electron journeys against built out/ (run after `build`)
```

The full gate (`pnpm run test`) runs, in order: format:check → lint → typecheck →
test:coverage → test:contracts → build → test:e2e, then emits
`test-results/quality-report.json` with command timings, runtime metrics, and artifact sizes
checked against `.scripts/test/performance-budgets.json`. Correctness failures exit non-zero;
budget overruns are warnings only. The gate refuses to run unless invoked through `npm run test`
(it checks `npm_execpath`).

Run a single Vitest test by file path, e.g. `pnpm run test:fast tests/unit/main-workflow.unit.test.ts`.
Run a single contract test with `node --experimental-transform-types --disable-warning=ExperimentalWarning --test tests/contract/<name>.test.mjs`.

## Test layers (see `tests/README.md`)

- `tests/unit/` — business rules and adapters with controlled deps.
- `tests/component/` — React behavior via accessible user interactions.
- `tests/integration/` — real neighboring boundaries (localhost sockets, temp files).
- `tests/contract/` — static cross-file/security invariants only; must not assert a behavior
  works merely because a symbol or source string exists.
- `tests/e2e/` — compiled Main + preload + renderer + IPC + windows in real Electron.
- `tests/shared/` — helpers for durable tests.

Provider tests (Deepl/Google/Ollama/Lingva) verify request/response handling with controlled
responses and must not depend on those services being online. Bug fixes require a regression
test that fails against the broken implementation.

## Architecture

### Three-process Electron layout (electron-vite)

`electron.vite.config.ts` builds three bundles, each with its own target and output:

1. **Main** (`src/main/`, output `out/main/index.cjs`, CJS, node22 target) — Node side.
   Most main deps are externalized *except* `adm-zip`, `electron-log`, `electron-store`,
   `electron-updater`, `tinyld`, which are bundled in.
2. **Preload** (`src/preload/index.ts`, output `out/preload/index.cjs`, CJS, node22) — the
   context bridge. Defines a closed `IpcChannel` union and an allowlist `Set`; only listed
   channels may be invoked. IPC handlers live in `src/main/modules/ipc.ts`.
3. **Renderer** (`src/renderer/`, output `out/renderer`, ES2020) — the React app, rooted at
   `index.html`. Vite aliases: `@` → `src`, `@assets` → `assets`. Node built-ins `fs`/`path`/
   `crypto` are aliased to `src/renderer/lib/nodeBuiltinUnavailable.ts` so renderer code that
   imports them fails safely rather than reaching Node.

The packaged app loads the renderer over a custom `neopot://` scheme (registered as privileged
in `src/main/index.ts` before `app.ready`), not `file:`. `src/main/modules/rendererProtocol.ts`
owns that scheme, its host, and `resolveRendererFile`/`SCREENSHOT_PATH`.

### Main process (`src/main/`)

`src/main/index.ts` is the entry: single-instance lock, then `startApp()` dynamically imports
the feature modules (`clipboard`, `config`, `hotkey`, `ipc`, `proxy`, `server`, `tray`,
`window`) in parallel and wires them together on `app.whenReady()`.

- **`modules/`** — feature modules, each exporting setup functions:
  - `window.ts` — owns the `WindowLabel` union (`config | translate | recognize | screenshot |
    updater`), per-label `windowDefinitions`, the live `BrowserWindow` map, webContents→label
    map, and a pending-events queue (events sent before a window is ready are buffered up to
    25). `openWindow`, `sendToWindow`, `markWindowReady`, `resizeTranslateWindowForText`.
  - `workflow.ts` — the user-facing actions (`selectionTranslate`, `inputTranslate`,
    `textTranslate`, `ocrRecognize`, `ocrTranslate`, `imageTranslate`, `recognizeWindow`,
    `openConfig`/`openUpdater`). Single-flights selection translate. Workflows open a window and
    push a `TranslateWorkflowPayload` (`src/shared/translateWorkflow.ts`) to it.
  - `config.ts` — `electron-store`-backed config with data migration
    (`data-migration.ts`), secrets via Electron `safeStorage` (`configSecrets.ts`), and a
    repository abstraction (`configRepository.ts`).
  - `server.ts` + `localServer.ts` — the local HTTP API (default port `60828`, configurable via
    `server_port`). Routes map to workflow actions (see README "外部调用"). Body size capped at
    `DEFAULT_MAX_LOCAL_REQUEST_BODY_BYTES` (1 MiB).
  - `hotkey.ts`, `clipboard.ts`, `screenshot.ts`, `selection.ts`, `tray.ts`, `proxy.ts`,
    `autoStart.ts`, `updater.ts` — other feature modules.
  - `externalUrlSafety.ts`, `networkSafety.ts`, `shellSafety.ts` — security guards for URLs,
    network, and shell execution. Changes that touch shell exec, URL handling, or the local
    server should respect these and are covered by `tests/contract/security-boundaries.contract.test.mjs`.
- **`plugins/`** — main-side plugin install/download (`installer.ts`, `marketplace.ts`,
  `remoteDownload.ts`, `binary.ts`, `pluginInstallerCore.ts`).
- **`services/translate/`** — main-side translate adapters (currently `google.ts`).

### Preload bridge (`src/preload/index.ts`)

Exposes a typed `NeoPotElectronAPI` (`window.neoPot`) via `contextBridge`, gated by the
`IpcChannel` allowlist. Shared types live in `src/shared/types/electron-api.ts`. To add a new
IPC channel: add it to the `IpcChannel` union *and* the `channels` allowlist set here, add a
handler in `src/main/modules/ipc.ts`, and add the typed method to `electron-api.ts`. The
contract test `tests/contract/ipc-bridge.contract.test.mjs` enforces that preload, main
handlers, and the typed API stay in sync.

### Renderer (`src/renderer/`)

- `main.tsx` boots; `App.tsx` reads the window label from `window.neoPot.app.getWindowLabel()`
  and lazy-loads one of `windows/{Translate,Screenshot,Recognize,Config,Updater}` per label.
  Only the `config` window is router-driven (`MemoryRouter`); the others are single-purpose.
  `App.tsx` also applies theme/language/font config from the config store.
- **Config window** (`windows/Config/`) — `routes/index.tsx` defines the seven lazy routes
  (`/general`, `/translate`, `/recognize`, `/hotkey`, `/service`, `/plugin`, `/about`) plus
  redirects to `/general`. Pages live in `windows/Config/pages/`.
- **`lib/electron/`** — thin async wrappers over `window.neoPot` (one file per domain:
  `window.ts`, `hotkey.ts`, `http.ts`, `files.ts`, `paths.ts`, `command.ts`, `clipboard.ts`,
  `dialog.ts`, `notification.ts`, `opener.ts`, `updater.ts`, `autoStart.ts`, `runtimeInfo.ts`,
  `logLevel.ts`, `events.ts`, `app.ts`). Renderer code should call these wrappers, not the
  raw `window.neoPot` API.
- **`lib/config/store.ts`** — renderer config cache with per-key revision tracking, inflight
  dedup, and `neopot:store-reloaded` / `neopot:store-changed` / `config:changed` events.
- **`lib/service/`** — `service_instance.ts` re-exports from `src/shared/serviceInstance.ts`
  (instance key encoding for builtin vs plugin services), `invokeTranslateService.ts` dispatches
  a translate call to either a builtin provider or a plugin, `serviceConfig.ts` manages
  instance configs, `autoCopyTranslation.ts` handles auto-copy.
- **`providers/`** — builtin providers, each implementing a typed interface:
  `translate/` (`deepl`, `google`, `ollama` → `TranslateProvider`), `recognize/`
  (`local_model` using PaddleOCR.js PP-OCRv5 + onnxruntime-web), `tts/` (`lingva`). Each
  provider exports `info`, a `Language` map, and a `translate`/`recognize`/`speak` function.
- **`lib/plugin/invoke_plugin.ts`** — plugin runtime. Plugins run inside sandboxed
  `iframe[srcdoc]` (`sandbox=allow-scripts` only — no same-origin). The host and sandbox
  communicate via `postMessage` on `neopot-plugin-*` channels. The host brokers RPC for
  `httpFetch`, `readFile`, `readTextFile`, `run` (binary), `openUrl`, `hostCallback`, and
  `log`. Plugin source is base64-encoded into the srcdoc and dynamically `import()`ed.
- **`hooks/`** — `useConfig` (subscribes to a config key), `useSyncAtom`, `useTtsSpeak`,
  `useVoice`.
- **`i18n/`** — i18next; locale JSON in `i18n/locales/` (12 languages). UI strings should go
  through `t(...)`.
- **`components/`** — shared UI (ErrorBoundary, RuntimeToaster, SafeRichText, window chrome,
  WindowPinning, ServiceInstanceDropdown).

### Shared (`src/shared/`)

Cross-process pure modules: `serviceInstance.ts` (instance-key encoding for `buildin` vs
`plugin` services — `name@randomId`, `plugin:` prefix), `logLevel.ts`, `logger.ts` (AppLogger
interface), `platform.ts`, `networkAddress.ts`, `providerUrl.ts`, `proxyConfig.ts`,
`hotkeyAccelerator.ts`, `translateWindowSizing.ts` (adaptive translate window sizing,
`MIN_TRANSLATE_WINDOW_SIZE`), `translateWorkflow.ts`, `trayLabels.ts`, `deeplConfig.ts`, and
type shims in `types/`. New shared logic that both main and renderer need belongs here and must
stay side-effect-free.

### Service instance keys

A service (translate/recognize/tts) is addressed by an instance key: `<name>@<randomId>` for
builtin, `plugin:<name>@<randomId>` for plugins. `whetherPluginService` / `getServiceName`
(`src/shared/serviceInstance.ts`) decode these. `invokeTranslateService` branches on whether
the configured instance is builtin (calls the provider directly) or plugin (calls
`invoke_plugin('translate', name)`).

## Conventions

- **TypeScript is strict.** `noUnusedLocals`/`noUnusedParameters` are on; unused vars and
  params will fail `typecheck` (and therefore the full gate). Do not silence with `// @ts-ignore`
  unless necessary (`@typescript-eslint/ban-ts-comment` is `warn`).
- **ESLint** (`eslint.config.js`) ignores `dist`, `out`, `.vite`, `spec`, `docs`,
  `test-results`, and `**/*.cjs`. React Hooks rules are `error`. Run `pnpm run lint`.
- **Prettier** config in `.prettierrc`; `format:check` is the first gate step.
- **Path aliases** `@/*` and `@assets/*` work in both Vite and `tsc` (see `tsconfig.json`).
- **IPC additions** must touch three places (preload union + allowlist, main handler, shared
  type) — the contract test enforces this.
- **Plugins are sandboxed** with no same-origin access; any new host capability must be added
  as an RPC method in `invoke_plugin.ts`'s `handleSandboxRequest` and mirrored in the sandbox
  HTML. Never give plugins direct Node, fs, or network access outside the brokered RPC.
- **Security-sensitive code** (shell exec, URL/network handling, local server) has dedicated
  contract tests under `tests/contract/`; changes should be reflected there.
- Release builds are triggered by `v*` tags via `.github/workflows/release.yml` (Windows + Linux
  matrices). `pnpm run make` produces a local Windows installer.

<comet-ambient-resume>
<!-- Managed by Comet. Edits inside this block may be replaced by comet init/update. -->
<!-- Contract: comet.resume_probe.v2 -->

## Comet Ambient Resume

在这个仓库中，开始处理需要改动或调查的任务前，如果可能存在活跃 Comet workflow，把当前用户请求传入只读探针：`comet resume-probe . --stdin --json`。

- 如果用户通过宿主明确调用任意 Comet Skill（例如 `@comet`、`/comet`、`@comet-native` 或 `/comet-hotfix`），显式调用优先于本恢复协议；不要运行 resume probe，直接进入被调用的 Skill。
- 如果用户通过宿主明确调用的是非 Comet 的 Skill 或斜杠命令，任务意图已由该调用明确：不要运行 resume probe，直接执行该 Skill。
- 如果你正在 Comet 流程内（包括正在等待用户回复你在流程中提出的问题），不要运行 resume probe；把这类回复（例如方案/选项选择）当作当前 change 的继续，直接按用户的选择推进。
- 只信任返回的 `workflow`、`skill` 和 `entrySource`；它们只由项目配置或无配置兼容回退决定。不得扫描或切换另一套 workflow。
- 如果 probe 返回 `auto_resume`，简短说明选中的 active change，并进入 `nextCommand` 指向的永久入口。不要把状态命令当作恢复入口直接推进。
- 如果 probe 返回 `ask_user`，只问一个简短问题并等待用户回复。
- 如果当前请求未明确调用 Comet Skill，且 probe 返回 `out_of_scope` 或 `none`，不要进入 Comet workflow。
- `out_of_scope` 或 `none` 只表示不要因为这个新请求进入 Comet workflow；它绝不表示要暂停或退出一个已在进行的 Comet 流程。
- 如果配置或状态无效且没有 `nextCommand`，停止并报告原因；不要猜测另一个 workflow。
- 不能只因为存在 active change 就把无关任务挂到该 change。Native 的未提交改动由 Native 入口检查，不由探针自动归因。
</comet-ambient-resume>
