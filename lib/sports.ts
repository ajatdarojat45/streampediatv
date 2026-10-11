import {
  Trophy,
  Target,
  CircleDot,
  Gauge,
  Circle,
  Activity,
  Shield,
  Flag,
  Zap,
  Snowflake,
  Feather,
  CircleDashed,
  Swords,
  Bike,
  Dumbbell,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import type { Sport } from './types';

/** Single source of truth for sport categories (mapped to the app's sportType enum). */
export const SPORTS: Sport[] = [
  { value: 1, label: 'Football', slug: 'football', icon: Trophy, color: '#22c55e' },
  { value: 2, label: 'Basketball', slug: 'basketball', icon: Target, color: '#f97316' },
  { value: 3, label: 'Tennis', slug: 'tennis', icon: CircleDot, color: '#a3e635' },
  { value: 7, label: 'Motorsport', slug: 'motorsport', icon: Gauge, color: '#ef4444', scoring: false },
  { value: 4, label: 'Baseball', slug: 'baseball', icon: Circle, color: '#eab308' },
  { value: 6, label: 'Cricket', slug: 'cricket', icon: Activity, color: '#4ade80' },
  { value: 8, label: 'Rugby', slug: 'rugby', icon: Shield, color: '#d97706' },
  { value: 9, label: 'American Football', slug: 'american-football', icon: Flag, color: '#c084fc' },
  { value: 10, label: 'Aussie Rules', slug: 'aussie-rules', icon: Zap, color: '#facc15' },
  { value: 11, label: 'Ice Hockey', slug: 'ice-hockey', icon: Snowflake, color: '#38bdf8' },
  { value: 12, label: 'Badminton', slug: 'badminton', icon: Feather, color: '#2dd4bf' },
  { value: 13, label: 'Volleyball', slug: 'volleyball', icon: CircleDashed, color: '#fb923c' },
  { value: 14, label: 'Fighting', slug: 'fighting', icon: Swords, color: '#f43f5e', scoring: false },
  { value: 15, label: 'Cycling', slug: 'cycling', icon: Bike, color: '#10b981', scoring: false },
  { value: 16, label: 'Handball', slug: 'handball', icon: Dumbbell, color: '#818cf8' },
  { value: 90, label: 'Others', slug: 'others', icon: LayoutGrid, color: '#94a3b8' },
];

export const POPULAR_SPORTS: Sport[] = SPORTS.slice(0, 4);
export const MORE_SPORTS: Sport[] = SPORTS.slice(4);

const sportByValue = new Map(SPORTS.map((s) => [s.value, s]));

export function sportLabel(code?: number): string {
  return sportByValue.get(code ?? -1)?.label ?? `Sport ${code}`;
}

export function sportIcon(code?: number): LucideIcon {
  return sportByValue.get(code ?? -1)?.icon ?? LayoutGrid;
}

export function sportColor(code?: number): string {
  return sportByValue.get(code ?? -1)?.color ?? '#94a3b8';
}

export function sportIsScoring(code?: number): boolean {
  return sportByValue.get(code ?? -1)?.scoring !== false;
}

/** Resolve a URL slug (from /sports/[category]) back to a sport definition. */
export function sportBySlug(slug: string): Sport | undefined {
  return SPORTS.find((s) => s.slug === slug);
}

/** URL slug for a sport code; empty string when the code is unknown. */
export function sportSlug(code?: number): string {
  return sportByValue.get(code ?? -1)?.slug ?? '';
}

/** Resolve a `?sport=` query param into a sport definition. The canonical form
 *  is the category slug (`?sport=football`) so the URL reads as a name instead
 *  of an opaque enum value; the legacy numeric sportType (`?sport=1`) is still
 *  accepted because shared links, cached HTML and indexed URLs carry it. */
export function sportByParam(param?: string | null): Sport | undefined {
  const raw = param?.trim().toLowerCase();
  if (!raw) return undefined;
  const bySlug = sportBySlug(raw);
  if (bySlug) return bySlug;
  const value = Number(raw);
  return Number.isFinite(value) ? sportByValue.get(value) : undefined;
}

/** Sport code for a `?sport=` param holding a category slug or legacy value.
 *  Falls back to `fallback` (0 = "All/Live") when the param is unknown. */
export function sportTypeFromParam(param?: string | null, fallback = 0): number {
  return sportByParam(param)?.value ?? fallback;
}

/** Canonical watch URL for a match: the category travels as its readable slug
 *  (`/watch/42?sport=football`). An unknown/absent code drops the param entirely
 *  so the detail page falls back to its own default sport. */
export function watchHref(matchId: number | string | undefined, sportType?: number): string {
  const slug = sportSlug(sportType);
  return slug ? `/watch/${matchId}?sport=${slug}` : `/watch/${matchId}`;
}


