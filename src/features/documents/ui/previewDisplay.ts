const PLACEHOLDER_TOKEN = /\[[\w.]+\]/g;

/** Replace raw template fill-in markers with user-friendly preview text. */
export function softenPreviewPlaceholders(body: string): string {
  return body.replace(PLACEHOLDER_TOKEN, 'Not provided');
}
