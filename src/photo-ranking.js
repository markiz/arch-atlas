export const HIGH_RATING = 50;
export const MIN_HIGH_PHOTOS = 3;

/**
 * Order gallery photos by their deterministic rating and hide low-rated
 * overflow when there is enough strong material.
 *
 * A photo with rating 50 is not "high" for the trigger, but it is not hidden
 * either: the rule hides only ratings below 50 once three photos above 50
 * exist. Without three strong photos, every photo stays visible.
 *
 * @template {{rating?: number}} T
 * @param {readonly T[]} photos
 * @returns {T[]}
 */
export function rankPhotos(photos) {
  const ranked = photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => {
      const byRating = (b.photo.rating ?? 0) - (a.photo.rating ?? 0);
      return byRating || a.index - b.index;
    });
  const strong = ranked.filter(({ photo }) => (photo.rating ?? 0) > HIGH_RATING).length;
  const visible = strong >= MIN_HIGH_PHOTOS
    ? ranked.filter(({ photo }) => (photo.rating ?? 0) >= HIGH_RATING)
    : ranked;
  return visible.map(({ photo }) => photo);
}
