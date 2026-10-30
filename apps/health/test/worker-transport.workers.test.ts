import { describe, expect, it, vi } from 'vitest'
import { handleHealthApi } from '../src/worker'

// Runs under @cloudflare/vitest-plugin: native workerd Request implementation.
describe('Health -> LifeSpace transport in Cloudflare Workers', () => {
  const env = {
    LIFESPACE_IDENTITY_BASE_URL: 'https://identity.example.com',
    LIFESPACE_CORE_BASE_URL: 'https://core.example.com',
    LIFESPACE_APPLICATION_CREDENTIAL: 'lsa_synthetic_test_only',
  }
  const request = () => new Request('https://health.example.com/health/api/v1/spaces', {
    headers: { 'Cf-Access-Jwt-Assertion': 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.fake' },
  })
  it('proves redirect error is unsupported and manual is supported', () => {
    expect(() => new Request('https://identity.example.com', { redirect: 'error' }))
      .toThrow(TypeError)
    expect(new Request('https://identity.example.com', { redirect: 'manual' }).redirect)
      .toBe('manual')
  })
  it('exchanges Identity token and fetches Core data without unsupported Request options', async () => {
    const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // Construct a real workerd Request to catch unsupported redirect modes.
      const outbound = new Request(input, init)
      expect(outbound.redirect).toBe('manual')
      if (new URL(outbound.url).pathname === '/internal/v1/access/tokens') {
        expect(outbound.headers.get('authorization')).toBe('Bearer lsa_synthetic_test_only')
        return Response.json({ data: { accessToken: 'synthetic_user_token' } })
      }
      expect(new URL(outbound.url).pathname).toBe('/api/v1/me/spaces')
      expect(outbound.headers.get('authorization')).toBe('Bearer synthetic_user_token')
      return Response.json({ data: [{ id: 'spc_synthetic' }] })
    })
    const response = await handleHealthApi(request(), env, f)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ id: 'spc_synthetic' }] })
    expect(f).toHaveBeenCalledTimes(2)
  })
})
