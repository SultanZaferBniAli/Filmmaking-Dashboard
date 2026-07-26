import { TMDB_API_KEY } from './config.js';

const SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

interface TmdbSearchResult {
  poster_path: string | null;
}

interface TmdbSearchResponse {
  results: TmdbSearchResult[];
}

// Poster lookups are keyed by title+year and cached for the life of the process — trainer
// filmography titles don't change between requests, so there's no reason to re-hit TMDB (and its
// rate limits) on every /view/trainers call.
const posterCache = new Map<string, string | null>();

export async function findMoviePosterUrl(title: string, year?: number): Promise<string | null> {
  if (!TMDB_API_KEY || !title.trim()) return null;

  const cacheKey = `${title}|${year ?? ''}`;
  if (posterCache.has(cacheKey)) return posterCache.get(cacheKey) ?? null;

  const params = new URLSearchParams({ api_key: TMDB_API_KEY, query: title });
  if (year) params.set('year', String(year));

  try {
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
    if (!res.ok) {
      posterCache.set(cacheKey, null);
      return null;
    }
    const data = (await res.json()) as TmdbSearchResponse;
    const posterPath = data.results?.[0]?.poster_path ?? null;
    const url = posterPath ? `${IMAGE_BASE}${posterPath}` : null;
    posterCache.set(cacheKey, url);
    return url;
  } catch {
    posterCache.set(cacheKey, null);
    return null;
  }
}
