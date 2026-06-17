import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('notifications migration', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260718120000_notifications.sql'),
    'utf8',
  );

  it('defines canonical notification tables and deferred weather behavior', () => {
    expect(source).toContain('create table if not exists public.notification_preferences');
    expect(source).toContain('create table if not exists public.notifications');
    expect(source).toContain('weather_alerts_enabled');
    expect(source).toContain('create_app_notification');
    expect(source).not.toContain('weather_risk');
    expect(source).not.toContain('WeatherAPI');
  });

  it('includes dedupe support and read/update policies', () => {
    expect(source).toContain('notifications_dedupe_source_idx');
    expect(source).toContain('users read own notifications');
    expect(source).toContain('users update own notifications');
  });
});
