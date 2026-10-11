// Streaming video API client — a thin, swappable fetch layer.
//
// To point this at your real Third-Party API, set NEXT_PUBLIC_STREAM_API_BASE_URL
// in `.env` (see `.env.example`). While that variable is empty, every function
// below returns in-memory MOCK data so the whole UI works end-to-end without a
// backend. Only the two `fetch*` functions know about the URL — the hooks in
// `lib/streamingQueries.ts` call these and never change.

import dayjs from 'dayjs';

export interface Video {
  id: string;
  category: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  durationSec: number;
  publishedAt: string;
}

export interface StreamDetail {
  id: string;
  title: string;
  description: string;
  streamUrl: string;
  thumbnailUrl: string;
  category: string;
  views: number;
  publishedAt: string;
}

/** Third-Party API base URL. Leave empty (default) to use mock data. */
const API_BASE_URL = process.env.NEXT_PUBLIC_STREAM_API_BASE_URL;

const delay = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

const titleCase = (slug: string): string =>
  slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/* ----------------------------- mock fallback ----------------------------- */

async function mockCategoryVideos(category: string): Promise<Video[]> {
  await delay(250);
  const label = titleCase(category) || 'Category';
  /** One clock reading for the whole batch, so the items sit exactly an hour
   *  apart regardless of how long the loop takes. */
  const now = dayjs();
  return Array.from({ length: 8 }, (_, i) => ({
    id: `${category}-${i + 1}`,
    category,
    title: `${label} — Event ${i + 1}`,
    description: `Mock description for ${label} event ${i + 1}.`,
    thumbnailUrl: `https://placehold.co/320x180?text=${encodeURIComponent(`${label} ${i + 1}`)}`,
    durationSec: 90 * 60 + i * 7,
    publishedAt: now.subtract(i, 'hour').toISOString(),
  }));
}

async function mockStreamDetail(videoId: string): Promise<StreamDetail> {
  await delay(250);
  const category = videoId.split('-')[0] ?? '';
  return {
    id: videoId,
    title: `Stream ${videoId}`,
    description: 'Mock metadata — replace by wiring a real Third-Party API.',
    streamUrl: `https://demo-stream.example.com/${videoId}/master.m3u8`,
    thumbnailUrl: `https://placehold.co/640x360?text=${encodeURIComponent(videoId)}`,
    category,
    views: 12_345,
    publishedAt: dayjs().toISOString(),
  };
}

/* ------------------------------ real API ------------------------------ */

/** Fetch the video list for a category (e.g. "football").
 *  Adjust the path/shape below to match your Third-Party API contract. */
export async function fetchCategoryVideos(category: string): Promise<Video[]> {
  if (!API_BASE_URL) return mockCategoryVideos(category);

  const res = await fetch(`${API_BASE_URL}/api/sports/${encodeURIComponent(category)}/videos`);
  if (!res.ok) throw new Error(`Failed to load "${category}": HTTP ${res.status}`);
  return (await res.json()) as Video[];
}

/** Fetch stream metadata — title, description, stream URL, thumbnail. */
export async function fetchStreamDetail(videoId: string): Promise<StreamDetail> {
  if (!API_BASE_URL) return mockStreamDetail(videoId);

  const res = await fetch(`${API_BASE_URL}/api/streams/${encodeURIComponent(videoId)}`);
  if (!res.ok) throw new Error(`Failed to load stream "${videoId}": HTTP ${res.status}`);
  return (await res.json()) as StreamDetail;
}
