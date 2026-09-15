// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const appWindowMock = vi.hoisted(() => ({
  setFocus: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
}))

const rendererReadyMock = vi.hoisted(() => vi.fn(async () => {}))

const appEventsMock = vi.hoisted(() => {
  let listener: ((payload: unknown) => void) | null = null
  return {
    onAppEvent: vi.fn((_event: string, handler: (payload: unknown) => void) => {
      listener = handler
      return () => {
        listener = null
      }
    }),
    emit: (payload: unknown) => listener?.(payload),
    hasListener: () => listener !== null,
  }
})

const invokeCommandMock = vi.hoisted(() => vi.fn())
const recognizeMock = vi.hoisted(() => vi.fn(async () => 'recognized text'))

// `recognize_service_list` resolution is held open by the test so the component
// observes `null` (the real hook returns null until the config IPC resolves).
const configMock = vi.hoisted(() => {
  const resolvers = new Map<string, (value: unknown) => void>()
  const defaults = new Map<string, unknown>()
  return {
    resolvers,
    defaults,
    reset: () => {
      resolvers.clear()
      defaults.clear()
    },
    resolve: (key: string, value: unknown) => {
      defaults.set(key, value)
      resolvers.get(key)?.(value)
    },
  }
})

vi.mock('@/renderer/lib/electron/window', () => ({
  getCurrentWindow: () => appWindowMock,
  getCurrentWindowLabel: () => 'translate',
}))

// SourceArea calls `window.neoPot.app.rendererReady()` once its workflow config
// values resolve. jsdom lacks the preload bridge, so stub just enough of
// `window.neoPot` for the component.
beforeAll(() => {
  Object.defineProperty(window, 'neoPot', {
    configurable: true,
    value: {
      app: {
        rendererReady: rendererReadyMock,
        getWindowLabel: () => Promise.resolve('translate'),
      },
    },
  })
})
vi.mock('@/renderer/lib/electron/events', () => appEventsMock)
vi.mock('@/renderer/lib/electron/command', () => ({ invokeCommand: invokeCommandMock }))
vi.mock('@/renderer/lib/electron/clipboard', () => ({ writeClipboardText: vi.fn() }))
vi.mock('@/renderer/lib/runtimeError', () => ({ reportRuntimeError: vi.fn() }))
vi.mock('@/renderer/lib/plugin/invoke_plugin', () => ({ invoke_plugin: vi.fn() }))
vi.mock('@/renderer/lib/language/lang_detect', () => ({ default: vi.fn(async () => 'en') }))
vi.mock('@/renderer/lib/config/env', () => ({
  osType: 'Linux',
  arch: '',
  osVersion: '',
  appVersion: '',
  initEnv: vi.fn(async () => {}),
}))
vi.mock('@/renderer/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createPluginLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/renderer/providers/recognize', () => ({
  local_model: {
    info: { icon: 'i' },
    Language: { auto: 'auto', zh_cn: 'zh_cn' },
    recognize: recognizeMock,
  },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@heroui/react', () => ({
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
  ButtonGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Chip: () => <span />,
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Spacer: () => <span />,
}))

vi.mock('@/renderer/hooks', async () => {
  const React = await import('react')
  return {
    // Mirrors the real hook: the value is null until the store read resolves,
    // and resolving triggers a re-render so effects observe the new value.
    useConfig: (key: string, _defaultValue: unknown) => {
      const initial = configMock.defaults.has(key) ? configMock.defaults.get(key) : null
      const [value, setValue] = React.useState(initial)
      React.useEffect(() => {
        configMock.resolvers.set(key, (resolved: unknown) => {
          setValue(resolved)
        })
      }, [key])
      return [value, () => Promise.resolve(), () => value]
    },
    useSyncAtom: () => ['', () => Promise.resolve(), () => {}],
    useTtsSpeak: () => ({ serviceInstanceKey: null, speak: async () => {} }),
    useVoice: () => ({}),
    useGetState: (initial: unknown) => [initial, () => {}, () => initial],
    deleteKey: async () => {},
    isSameConfigValue: (left: unknown, right: unknown) => left === right,
  }
})

import SourceArea from '../../src/renderer/windows/Translate/components/SourceArea'

function renderSourceArea() {
  return render(
    <SourceArea
      pluginList={{ translate: {}, recognize: {}, tts: {} } as never}
      serviceInstanceConfigMap={{ local_model: {} } as never}
    />,
  )
}

// The five config keys SourceArea gates `rendererReady` on.
const workflowConfigKeys = [
  'translate_delete_newline',
  'incremental_translate',
  'recognize_language',
  'recognize_service_list',
  'translate_hide_window',
]

function resolveWorkflowConfigs(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    translate_delete_newline: false,
    incremental_translate: false,
    recognize_language: 'auto',
    recognize_service_list: ['local_model'],
    translate_hide_window: false,
    ...overrides,
  }
  act(() => {
    for (const key of workflowConfigKeys) {
      configMock.resolve(key, values[key])
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  configMock.reset()
  invokeCommandMock.mockResolvedValue('')
  rendererReadyMock.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('SourceArea image workflow config readiness', () => {
  it('does not signal renderer ready until the workflow config store resolves', async () => {
    renderSourceArea()
    await waitFor(() => expect(appEventsMock.hasListener()).toBe(true))

    expect(rendererReadyMock).not.toHaveBeenCalled()

    resolveWorkflowConfigs()
    await waitFor(() => expect(rendererReadyMock).toHaveBeenCalledTimes(1))
  })

  it('defers an image workflow event that arrives before the config store resolves', async () => {
    renderSourceArea()
    await waitFor(() => expect(appEventsMock.hasListener()).toBe(true))

    // The screenshot workflow delivers `new_text` while `recognize_service_list`
    // is still unresolved; the OCR provider must not be invoked yet.
    appEventsMock.emit({ kind: 'image' })

    expect(invokeCommandMock).not.toHaveBeenCalledWith('get_base64')
    expect(recognizeMock).not.toHaveBeenCalled()
  })

  it('runs OCR once the config store has resolved', async () => {
    renderSourceArea()
    await waitFor(() => expect(appEventsMock.hasListener()).toBe(true))

    resolveWorkflowConfigs()
    await waitFor(() => expect(rendererReadyMock).toHaveBeenCalledTimes(1))

    invokeCommandMock.mockResolvedValue('c2NyZWVuc2hvdA==')
    await act(async () => {
      appEventsMock.emit({ kind: 'image' })
    })

    await waitFor(() => expect(recognizeMock).toHaveBeenCalledTimes(1))
    expect(invokeCommandMock).toHaveBeenCalledWith('get_base64')
  })
})
