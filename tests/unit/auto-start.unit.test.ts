import { describe, expect, it } from 'vitest'
import { AUTO_START_HIDDEN_ARG, isAutoStartLaunch } from '../../src/main/modules/autoStart'

describe('auto-start launch detection', () => {
  it('recognizes the login-item marker without treating normal launches as auto-starts', () => {
    expect(isAutoStartLaunch(['NeoPot.exe', AUTO_START_HIDDEN_ARG])).toBe(true)
    expect(isAutoStartLaunch(['NeoPot.exe'])).toBe(false)
  })
})
