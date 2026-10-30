import { describe, expect, it } from 'vitest'
import { assistantNavigationFallbackAllowlist } from '../pwa-navigation'

describe('temporary Assistant root PWA navigation boundary', () => {
  const matches = (pathname: string) =>
    assistantNavigationFallbackAllowlist.some(pattern => pattern.test(pathname))

  it('retains offline navigation only for the root-hosted Assistant', () => {
    expect(matches('/')).toBe(true)
  })

  it.each([
    '/health', '/health/', '/health/api/v1/profile',
    '/settings', '/settings/', '/settings/api/v1/me',
    '/finance/', '/things/', '/assistant/', '/v1/interactions',
    '/something-unrelated',
  ])('does not intercept another application or API: %s', path => {
    expect(matches(path)).toBe(false)
  })
})
