import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  RefreshCw,
  Sun,
  Wind,
} from 'lucide-react';
import OpsCard from '../OpsCard';
import Button from '../../ui/Button';
import { useAuth } from '../../../hooks/useAuth';
import { useSettingsStore } from '../../../store';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { isPlanSufficient } from './dashboardWidgetCategories';
import type { DashboardLayoutItemConfig } from '../../../lib/dashboardLayout';
import type { DashboardCardContext } from '../layout/dashboardData';
import type { ForecastDay } from '../../../types';
import {
  getForecastByQuery,
  WeatherServiceError,
  type ExtendedForecastResult,
} from '../../../services/weatherService';
import { isUsageLimitError } from '../../../lib/usageMetering';
import { usageLimitToastMessage } from '../../../lib/usageLimitUx';
import {
  projectsWithJobsite,
  type ProjectJobsiteOption,
} from '../../../utils/weatherWidgetProjects';
import {
  activeProjectOption,
  resolveDefaultWeatherSource,
  resolveMyWeatherLocation,
  weatherSubtitleLine,
  type WeatherSourceSelection,
} from '../../../utils/weatherWidgetLocation';
import {
  deriveWeatherRiskChip,
  weatherRiskChipClass,
  type WeatherRiskChip,
} from '../../../utils/weatherWidgetRisk';
import {
  weatherForecastDaysForMode,
  weatherForecastDisplayMode,
  type WeatherForecastDisplayMode,
} from './weatherForecastDisplay';
import { WeatherLocationSelector, type WeatherLocationOption } from './WeatherLocationSelector';
import { OPS_BODY, OPS_MUTED, OPS_OUTLINE_BTN, OPS_PANEL_INNER, OPS_TITLE } from '../opsTheme';

interface WeatherForecastWidgetProps {
  ctx: DashboardCardContext;
  cardWidth?: number;
  isMobile?: boolean;
  widgetConfig?: DashboardLayoutItemConfig;
  onWidgetConfigChange?: (config: DashboardLayoutItemConfig) => void;
}

function truncateProjectName(name: string, max = 36): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function formatUpdatedTime(value?: string): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'Updated just now';
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `Updated ${diffDays}d ago`;
}

type WeatherFetchKind = 'my' | 'project';

interface WeatherFetchTarget {
  kind: WeatherFetchKind;
  query: string;
  locationKey: string;
  locationLabel: string;
  projectOption?: ProjectJobsiteOption;
}

function weatherIcon(conditions: string, className = 'h-8 w-8') {
  const lower = conditions.toLowerCase();
  if (lower.includes('rain') || lower.includes('shower')) {
    return <CloudRain className={`${className} text-blue-400`} aria-hidden />;
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return <Cloud className={`${className} text-slate-400`} aria-hidden />;
  }
  if (lower.includes('sun') || lower.includes('clear')) {
    return <Sun className={`${className} text-amber-400`} aria-hidden />;
  }
  return <CloudSun className={`${className} text-cyan-400`} aria-hidden />;
}

function RiskChip({ level }: { level: WeatherRiskChip }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${weatherRiskChipClass(level)}`}
      data-testid="weather-risk-chip"
    >
      WEATHER RISK: {level.toUpperCase()}
    </span>
  );
}

function ForecastSkeleton({ mode }: { mode: WeatherForecastDisplayMode }) {
  if (mode === 'wide') {
    return (
      <div className="space-y-4" data-testid="weather-forecast-loading">
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
          <div className="h-44 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-700/80" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'twoThirds') {
    return (
      <div className="space-y-3" data-testid="weather-forecast-loading">
        <div className="h-16 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-700/80" />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[110px] animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="weather-forecast-loading">
      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200/80 dark:bg-slate-700/80" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-14 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
        <div className="h-14 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
        <div className="h-14 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
      </div>
    </div>
  );
}

type ForecastDayTileVariant = 'wide' | 'compact';

function ForecastDayCard({
  day,
  variant = 'compact',
}: {
  day: ForecastDay;
  variant?: ForecastDayTileVariant;
}) {
  const label = format(new Date(`${day.date}T12:00:00`), 'EEE');
  const isWide = variant === 'wide';

  return (
    <div
      className={`${OPS_PANEL_INNER} flex min-w-0 flex-col items-center justify-center text-center ${
        isWide ? 'min-h-[140px] gap-2 px-3 py-4' : 'gap-0 p-3'
      }`}
      data-testid={isWide ? 'weather-forecast-day-tile-wide' : undefined}
    >
      <p
        className={`truncate font-semibold uppercase tracking-wide ${OPS_MUTED} ${
          isWide ? 'text-sm' : 'text-[10px] font-medium'
        }`}
      >
        {label}
      </p>
      <div className={`flex justify-center ${isWide ? 'my-0.5' : 'my-1.5'}`}>
        {weatherIcon(day.conditions, isWide ? 'h-10 w-10' : 'h-6 w-6')}
      </div>
      <p
        className={`font-semibold tabular-nums ${OPS_BODY} ${
          isWide ? 'text-2xl leading-none' : 'text-sm'
        }`}
      >
        {Math.round(day.maxTemp)}°
      </p>
      <p className={`tabular-nums ${OPS_MUTED} ${isWide ? 'text-base' : 'text-[10px]'}`}>
        {Math.round(day.minTemp)}°
      </p>
      <p
        className={`${OPS_MUTED} ${isWide ? 'mt-0.5 text-sm font-medium' : 'mt-0.5 text-[10px]'}`}
      >
        {Math.round(day.chanceOfRain)}% rain
      </p>
    </div>
  );
}

function ForecastStrip({ days }: { days: ForecastDay[] }) {
  return (
    <div
      className="grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3"
      data-testid="weather-forecast-strip"
    >
      {days.map((day) => (
        <ForecastDayCard key={day.date} day={day} variant="wide" />
      ))}
    </div>
  );
}

function TodayWeatherSummary({
  day,
  locationLabel,
}: {
  day: ForecastDay;
  locationLabel: string;
}) {
  return (
    <div
      className={`${OPS_PANEL_INNER} flex min-w-0 flex-col gap-3 p-4`}
      data-testid="weather-forecast-today-summary"
    >
      <div className="flex items-start gap-3">
        {weatherIcon(day.conditions, 'h-10 w-10 shrink-0')}
        <div className="min-w-0 flex-1">
          <p className={`text-xs ${OPS_MUTED}`}>Today</p>
          <p className={`truncate text-sm font-medium ${OPS_TITLE}`}>{locationLabel}</p>
          <p className={`mt-0.5 text-sm ${OPS_BODY}`}>{day.conditions}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <p className={`text-3xl font-semibold tabular-nums ${OPS_TITLE}`}>
          {Math.round(day.maxTemp)}°
          <span className={`ml-1 text-base font-normal ${OPS_MUTED}`}>
            / {Math.round(day.minTemp)}°
          </span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="min-w-0 rounded-lg bg-slate-50/80 p-2 dark:bg-slate-900/40">
          <p className={OPS_MUTED}>Rain</p>
          <p className={`font-semibold ${OPS_BODY}`}>{Math.round(day.chanceOfRain)}%</p>
        </div>
        <div className="min-w-0 rounded-lg bg-slate-50/80 p-2 dark:bg-slate-900/40">
          <p className={OPS_MUTED}>Wind</p>
          <p className={`font-semibold ${OPS_BODY}`}>{Math.round(day.maxWindSpeed)} mph</p>
        </div>
        <div className="min-w-0 rounded-lg bg-slate-50/80 p-2 dark:bg-slate-900/40">
          <p className={OPS_MUTED}>Humidity</p>
          <p className={`font-semibold ${OPS_BODY}`}>
            {day.avgHumidity != null ? `${Math.round(day.avgHumidity)}%` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function CompactDayView({ day, locationLabel }: { day: ForecastDay; locationLabel: string }) {
  const risk = deriveWeatherRiskChip(day);
  return (
    <div className="space-y-3" data-testid="weather-forecast-compact">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate text-xs ${OPS_MUTED}`}>
            <MapPin className="mr-1 inline h-3 w-3 shrink-0" aria-hidden />
            {locationLabel}
          </p>
          <p className={`mt-1 truncate text-sm font-medium ${OPS_BODY}`}>{day.conditions}</p>
        </div>
        {weatherIcon(day.conditions, 'h-7 w-7 shrink-0')}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <p className={`text-2xl font-semibold tabular-nums ${OPS_TITLE}`}>
          {Math.round(day.maxTemp)}°
          <span className={`ml-1 text-sm font-normal ${OPS_MUTED}`}>
            / {Math.round(day.minTemp)}°
          </span>
        </p>
        <RiskChip level={risk} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <span className={`inline-flex items-center gap-1 ${OPS_MUTED}`}>
          <Droplets className="h-3.5 w-3.5" aria-hidden />
          {Math.round(day.chanceOfRain)}% rain
        </span>
        <span className={`inline-flex items-center gap-1 ${OPS_MUTED}`}>
          <Wind className="h-3.5 w-3.5" aria-hidden />
          {Math.round(day.maxWindSpeed)} mph
        </span>
      </div>
    </div>
  );
}

function SingleDayView({
  day,
  locationLabel,
}: {
  day: ForecastDay;
  locationLabel: string;
}) {
  const risk = deriveWeatherRiskChip(day);
  const hourly = (day.hourly ?? []).slice(0, 8);

  return (
    <div className="space-y-3" data-testid="weather-forecast-single-day">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs ${OPS_MUTED}`}>Today&apos;s forecast</p>
          <p className={`mt-0.5 truncate text-sm font-medium ${OPS_TITLE}`}>{locationLabel}</p>
          <p className={`mt-1 text-sm ${OPS_BODY}`}>{day.conditions}</p>
        </div>
        {weatherIcon(day.conditions)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className={`text-3xl font-semibold tabular-nums ${OPS_TITLE}`}>
          {Math.round(day.maxTemp)}°
          <span className={`ml-1 text-base font-normal ${OPS_MUTED}`}>
            / {Math.round(day.minTemp)}°
          </span>
        </p>
        <RiskChip level={risk} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className={`${OPS_PANEL_INNER} p-2`}>
          <p className={OPS_MUTED}>Rain</p>
          <p className={`font-semibold ${OPS_BODY}`}>{Math.round(day.chanceOfRain)}%</p>
        </div>
        <div className={`${OPS_PANEL_INNER} p-2`}>
          <p className={OPS_MUTED}>Wind</p>
          <p className={`font-semibold ${OPS_BODY}`}>{Math.round(day.maxWindSpeed)} mph</p>
        </div>
        <div className={`${OPS_PANEL_INNER} p-2`}>
          <p className={OPS_MUTED}>Humidity</p>
          <p className={`font-semibold ${OPS_BODY}`}>
            {day.avgHumidity != null ? `${Math.round(day.avgHumidity)}%` : '—'}
          </p>
        </div>
      </div>
      {hourly.length > 0 ? (
        <div>
          <p className={`mb-2 text-[10px] uppercase tracking-wide ${OPS_MUTED}`}>Next hours</p>
          <div className="flex gap-1 overflow-x-hidden">
            {hourly.map((h) => (
              <div
                key={h.hour}
                className={`min-w-0 flex-1 ${OPS_PANEL_INNER} px-1.5 py-2 text-center`}
              >
                <p className={`text-[10px] ${OPS_MUTED}`}>{h.hour}:00</p>
                <p className={`text-xs font-semibold tabular-nums ${OPS_BODY}`}>{Math.round(h.temp)}°</p>
                <p className={`text-[10px] ${OPS_MUTED}`}>{Math.round(h.chanceOfRain)}%</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WeatherStatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[90px] rounded-lg border border-slate-200/70 px-3 py-2 text-center dark:border-slate-600/70">
      <p className={`text-[10px] ${OPS_MUTED}`}>{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${OPS_BODY}`}>{value}</p>
    </div>
  );
}

function CompactForecastDayTile({ day }: { day: ForecastDay }) {
  const label = format(new Date(`${day.date}T12:00:00`), 'EEE');
  return (
    <div
      className={`${OPS_PANEL_INNER} flex min-h-[110px] min-w-0 flex-col items-center justify-center p-3 text-center`}
    >
      <p className={`truncate text-[10px] font-medium uppercase tracking-wide ${OPS_MUTED}`}>
        {label}
      </p>
      <div className="my-1 flex justify-center">{weatherIcon(day.conditions, 'h-5 w-5')}</div>
      <p className={`text-xs font-semibold tabular-nums ${OPS_BODY}`}>{Math.round(day.maxTemp)}°</p>
      <p className={`text-[10px] tabular-nums ${OPS_MUTED}`}>{Math.round(day.minTemp)}°</p>
      <p className={`mt-0.5 text-[10px] ${OPS_MUTED}`}>{Math.round(day.chanceOfRain)}%</p>
    </div>
  );
}

function TwoThirdsLayoutView({
  days,
  today,
}: {
  days: ForecastDay[];
  today: ForecastDay;
}) {
  const stripDays = days.slice(0, 5);

  return (
    <div className="space-y-3" data-testid="weather-forecast-two-thirds">
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 p-3 dark:border-slate-700/60"
        data-testid="weather-forecast-two-thirds-summary"
      >
        <div className="flex min-w-[160px] flex-1 items-center gap-3">
          {weatherIcon(today.conditions, 'h-9 w-9 shrink-0')}
          <div className="min-w-0">
            <p className={`text-[10px] font-medium uppercase tracking-wide ${OPS_MUTED}`}>Today</p>
            <p className={`truncate text-sm font-medium ${OPS_BODY}`}>{today.conditions}</p>
            <p className={`text-lg font-semibold tabular-nums leading-tight ${OPS_TITLE}`}>
              {Math.round(today.maxTemp)}°
              <span className={`ml-1 text-sm font-normal ${OPS_MUTED}`}>
                / {Math.round(today.minTemp)}°
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WeatherStatChip label="Rain" value={`${Math.round(today.chanceOfRain)}%`} />
          <WeatherStatChip label="Wind" value={`${Math.round(today.maxWindSpeed)} mph`} />
          <WeatherStatChip
            label="Humidity"
            value={today.avgHumidity != null ? `${Math.round(today.avgHumidity)}%` : '—'}
          />
        </div>
      </div>

      <div
        className="grid grid-cols-5 gap-2"
        data-testid="weather-forecast-two-thirds-strip"
      >
        {stripDays.map((day) => (
          <CompactForecastDayTile key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}

function WideLayoutView({
  days,
  today,
  locationLabel,
}: {
  days: ForecastDay[];
  today: ForecastDay;
  locationLabel: string;
}) {
  const stripDays = days.length > 1 ? days.slice(1) : days;

  return (
    <div
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]"
      data-testid="weather-forecast-wide"
    >
      <TodayWeatherSummary day={today} locationLabel={locationLabel} />
      <div className="flex min-w-0 flex-col gap-2">
        <p className={`text-[10px] font-medium uppercase tracking-wide ${OPS_MUTED}`}>
          {stripDays.length}-day outlook
        </p>
        <ForecastStrip days={stripDays} />
      </div>
    </div>
  );
}

export function WeatherForecastWidget({
  ctx,
  cardWidth,
  isMobile,
  widgetConfig,
  onWidgetConfigChange,
}: WeatherForecastWidgetProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const companyAddress = useSettingsStore((state) => state.companySettings?.address ?? '');
  const { plan } = useSubscription();
  const mode = weatherForecastDisplayMode(cardWidth, isMobile);
  const forecastDays = weatherForecastDaysForMode(mode);
  const selectorCompact = mode === 'compact' || mode === 'singleDay';

  const myWeather = useMemo(
    () => resolveMyWeatherLocation(profile, companyAddress),
    [profile, companyAddress],
  );
  const siteOptions = useMemo(() => projectsWithJobsite(ctx.projects), [ctx.projects]);
  const savedConfig = widgetConfig?.weatherForecast;

  const autoSelection = useMemo(
    () => resolveDefaultWeatherSource(profile, companyAddress, ctx.projects, savedConfig),
    [profile, companyAddress, ctx.projects, savedConfig],
  );

  const [localSelection, setLocalSelection] = useState<WeatherSourceSelection | null>(null);
  const selection = localSelection ?? autoSelection;

  const selectorOptions = useMemo((): WeatherLocationOption[] => {
    const options: WeatherLocationOption[] = [
      { value: 'my', label: 'My Weather', group: 'personal' },
    ];
    for (const project of siteOptions) {
      options.push({
        value: project.id,
        label: truncateProjectName(project.name),
        title: project.name,
        group: 'projects',
      });
    }
    return options;
  }, [siteOptions]);

  const selectorValue =
    selection.source === 'project' && selection.projectId
      ? selection.projectId
      : 'my';

  const fetchTarget = useMemo((): WeatherFetchTarget | null => {
    if (selection.source === 'project' && selection.projectId) {
      const option = activeProjectOption(selection.projectId, siteOptions);
      if (option) {
        return {
          kind: 'project',
          query: option.query,
          locationKey: `project:${option.id}`,
          locationLabel: option.name,
          projectOption: option,
        };
      }
      return null;
    }
    if (myWeather) {
      return {
        kind: 'my',
        query: myWeather.query,
        locationKey: `my:${myWeather.query.toLowerCase().replace(/\s+/g, ' ').trim()}`,
        locationLabel: 'My Weather',
      };
    }
    return null;
  }, [selection, siteOptions, myWeather]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtendedForecastResult | null>(null);
  const fetchKeyRef = useRef('');
  const requestIdRef = useRef(0);

  const persistSelection = useCallback(
    (next: WeatherSourceSelection) => {
      setLocalSelection(next);
      onWidgetConfigChange?.({
        weatherForecast: {
          selectedWeatherSource: next.source === 'project' ? 'project' : 'my',
          selectedProjectId: next.projectId,
        },
      });
    },
    [onWidgetConfigChange],
  );

  const handleSourceChange = useCallback(
    (value: string) => {
      if (value === 'my') {
        persistSelection({ source: 'my', projectId: null });
        return;
      }
      persistSelection({ source: 'project', projectId: value });
    },
    [persistSelection],
  );

  const loadForecast = useCallback(
    async (target: WeatherFetchTarget, days: number, options: { forceRefresh?: boolean } = {}) => {
      const fetchKey = `${target.kind}|${target.query}|${days}`;
      if (!options.forceRefresh && fetchKey === fetchKeyRef.current) return;

      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      fetchKeyRef.current = fetchKey;

      try {
        const data = await getForecastByQuery(target.query, days, {
          projectId: target.projectOption?.id,
          locationKey: target.locationKey,
          locationLabel: target.locationLabel,
          forceRefresh: options.forceRefresh ?? false,
        });
        if (requestId !== requestIdRef.current) return;
        if (!data || data.forecast.length === 0) {
          setResult(null);
          setError(
            target.kind === 'my'
              ? 'Could not load weather for My Weather.'
              : 'Could not load forecast for this project jobsite.',
          );
          fetchKeyRef.current = '';
          return;
        }
        setResult(data);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        if (err instanceof WeatherServiceError && err.code === 'unauthorized') {
          setError(
            target.kind === 'my'
              ? 'Sign in again to load My Weather.'
              : 'Sign in again to load the jobsite forecast.',
          );
        } else if (isUsageLimitError(err)) {
          setError(usageLimitToastMessage(err));
        } else if (err instanceof WeatherServiceError && err.code === 'usage_limit') {
          setError(err.message);
        } else {
          setError(
            target.kind === 'my'
              ? 'Could not load weather for My Weather.'
              : 'Could not load forecast for this project jobsite.',
          );
        }
        fetchKeyRef.current = '';
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!fetchTarget || !isPlanSufficient(plan, 'starter')) {
      setResult(null);
      setError(null);
      fetchKeyRef.current = '';
      return;
    }
    void loadForecast(fetchTarget, forecastDays);
  }, [fetchTarget, forecastDays, loadForecast, plan]);

  const handleRetry = () => {
    if (!fetchTarget) return;
    fetchKeyRef.current = '';
    void loadForecast(fetchTarget, forecastDays, { forceRefresh: true });
  };

  const activeProject =
    selection.source === 'project' && selection.projectId
      ? activeProjectOption(selection.projectId, siteOptions)
      : null;

  const resolvedLocationLabel =
    result?.location?.city && result.location.city !== 'Unknown'
      ? `${result.location.city}${result.location.country ? `, ${result.location.country}` : ''}`
      : activeProject?.label ?? myWeather?.label ?? 'Location';

  const subtitle =
    fetchTarget?.kind === 'project' || activeProject
      ? weatherSubtitleLine('project', resolvedLocationLabel)
      : weatherSubtitleLine('my', resolvedLocationLabel);

  const todayForecast = result?.forecast[0] ?? null;
  const todayRisk = todayForecast ? deriveWeatherRiskChip(todayForecast) : null;
  const showHeaderRisk = todayRisk != null && (mode === 'wide' || mode === 'twoThirds');
  const needsMyWeatherSetup = selectorValue === 'my' && !myWeather;
  const hasNoLocationSources = !myWeather && siteOptions.length === 0;
  const updatedLabel = formatUpdatedTime(result?.fetchedAt);
  const cacheLabel = result?.stale
    ? 'Refresh available'
    : result?.cached
      ? 'Showing saved forecast'
      : null;

  if (!isPlanSufficient(plan, 'starter')) {
    return (
      <OpsCard data-testid="weather-forecast-widget">
        <header className="mb-3">
          <h3 className={`font-semibold ${OPS_TITLE}`}>Weather Forecast</h3>
          <p className={`mt-0.5 text-xs ${OPS_MUTED}`}>
            Jobsite forecast and placement conditions at a glance.
          </p>
        </header>
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30"
          data-testid="weather-forecast-upgrade"
        >
          <p className={`text-sm font-semibold ${OPS_TITLE}`}>Upgrade required</p>
          <p className={`mt-1 text-sm ${OPS_MUTED}`}>
            Jobsite weather forecast is available on Starter and above.
          </p>
          <Button
            variant="accent"
            size="sm"
            className="mt-3 whitespace-nowrap"
            onClick={() => navigate('/settings/billing')}
          >
            View plans
          </Button>
        </div>
      </OpsCard>
    );
  }

  return (
    <OpsCard data-testid="weather-forecast-widget">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className={`shrink-0 font-semibold ${OPS_TITLE}`}>Weather Forecast</h3>
          <WeatherLocationSelector
            value={selectorValue}
            options={selectorOptions}
            onChange={handleSourceChange}
            compact={selectorCompact}
          />
          {showHeaderRisk ? <RiskChip level={todayRisk!} /> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className={`rounded-lg p-1.5 ${OPS_OUTLINE_BTN}`}
            onClick={handleRetry}
            aria-label="Retry forecast"
            data-testid="weather-forecast-retry"
            disabled={!fetchTarget}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className={`w-full min-w-0 truncate text-xs ${OPS_MUTED}`} data-testid="weather-forecast-subtitle">
          {needsMyWeatherSetup
            ? 'My Weather · Set your location'
            : hasNoLocationSources && selection.source === 'setup'
              ? 'Set your location to see My Weather.'
              : subtitle}
        </p>
        {result ? (
          <p className={`w-full text-[11px] ${OPS_MUTED}`} data-testid="weather-forecast-cache-status">
            {[updatedLabel, cacheLabel, 'Refresh uses weather credits'].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </header>

      {needsMyWeatherSetup || (hasNoLocationSources && !fetchTarget) ? (
        <div className="space-y-3" data-testid="weather-forecast-setup">
          <p className={`text-sm ${OPS_MUTED}`}>Set your location to see My Weather.</p>
          <Button
            variant="accent"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => navigate('/settings')}
            data-testid="weather-forecast-setup-settings"
          >
            Open settings
          </Button>
        </div>
      ) : null}

      {loading && !result && fetchTarget ? <ForecastSkeleton mode={mode} /> : null}

      {error && !loading ? (
        <div className="space-y-3" data-testid="weather-forecast-error">
          <p className={`text-sm ${OPS_MUTED}`}>{error}</p>
          <Button variant="outline" size="sm" className={OPS_OUTLINE_BTN} onClick={handleRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error && todayForecast && fetchTarget ? (
        <>
          {mode === 'compact' ? (
            <CompactDayView day={todayForecast} locationLabel={resolvedLocationLabel} />
          ) : null}
          {mode === 'singleDay' ? (
            <SingleDayView day={todayForecast} locationLabel={resolvedLocationLabel} />
          ) : null}
          {mode === 'twoThirds' ? (
            <TwoThirdsLayoutView days={result!.forecast} today={todayForecast} />
          ) : null}
          {mode === 'wide' ? (
            <WideLayoutView
              days={result!.forecast}
              today={todayForecast}
              locationLabel={resolvedLocationLabel}
            />
          ) : null}
        </>
      ) : null}
    </OpsCard>
  );
}

export default WeatherForecastWidget;
