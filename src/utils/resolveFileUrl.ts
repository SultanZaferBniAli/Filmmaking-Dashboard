// Backend file URLs (photos, reports, guides) are relative ("/files/<workshop folder>/photos/
// ...") — served by the backend's own origin, not the frontend dev server. This resolves them
// to an absolute src regardless of origin, while leaving already-absolute/blob/data URLs (e.g.
// a freshly-uploaded local preview) untouched.
export function resolveFileUrl(apiUrl: string, url: string): string {
  return url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:') ? url : `${apiUrl}${url}`;
}
