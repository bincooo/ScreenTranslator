import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('applies Linux window frame classes from the synchronous preload platform', async () => {
  vi.stubGlobal('window', {
    neoPot: {
      app: {
        platform: 'Linux',
      },
    },
  })

  const chrome = await import('../../src/renderer/components/windowChrome')

  expect(chrome.LINUX_WINDOW_FRAME_CLASS).toBe(
    'rounded-[10px] border-1 border-default-100 h-[calc(100vh-2px)] w-[calc(100vw-2px)]',
  )
  expect(chrome.LINUX_LEFT_WINDOW_FRAME_CLASS).toBe('rounded-l-[10px] border-1 h-[calc(100vh-2px)]')
  expect(chrome.LINUX_RIGHT_WINDOW_FRAME_CLASS).toBe(
    'rounded-r-[10px] border-1 border-l-0 border-default-100 h-[calc(100vh-2px)]',
  )
  expect(chrome.LINUX_CLOSE_WINDOW_CORNER_CLASS).toBe('rounded-tr-[10px]')
})
