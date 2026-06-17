import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getForecastByQuery, WeatherServiceError } from './weatherService';

const getSession = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
    },
  },
}));

describe('weatherService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      data: { session: { access_token: 'user-jwt-token' } },
    });
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends the user access token to getWeatherForecast', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        location: { city: 'Portland', country: 'US' },
        forecast: [{ date: '2026-06-17', maxTemp: 70, minTemp: 55, conditions: 'Clear' }],
      }),
    });

    await getForecastByQuery('Portland, OR', 3);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/getWeatherForecast'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer user-jwt-token',
        }),
      }),
    );
  });

  it('sends cache options and forceRefresh flag for forecast queries', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        location: { city: 'Portland', country: 'US' },
        forecast: [{ date: '2026-06-17', maxTemp: 70, minTemp: 55, conditions: 'Clear' }],
        cached: true,
        usageCharged: false,
      }),
    });

    await getForecastByQuery('Portland, OR', 3, {
      locationKey: 'my:portland',
      locationLabel: 'My Weather',
      forceRefresh: true,
    });

    const forecastCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) =>
      String(url).includes('/getWeatherForecast'),
    );
    expect(forecastCall).toBeTruthy();
    const [, init] = forecastCall!;
    expect(JSON.parse(String(init.body))).toMatchObject({
      query: 'Portland, OR',
      days: 3,
      mode: 'forecast',
      locationKey: 'my:portland',
      locationLabel: 'My Weather',
      forceRefresh: true,
    });
  });

  it('throws WeatherServiceError when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(getForecastByQuery('Portland, OR')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('throws WeatherServiceError when the function returns 401', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Unauthorized' }),
    });

    await expect(getForecastByQuery('Portland, OR')).rejects.toBeInstanceOf(WeatherServiceError);
  });

  it('returns null for non-auth API failures', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    });

    await expect(getForecastByQuery('Portland, OR')).resolves.toBeNull();
  });
});
