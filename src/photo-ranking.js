export const HIGH_RATING = 50;
export const MIN_HIGH_PHOTOS = 3;
/** Photos with this tag are documentary stamp scans, not building photos. */
export const STAMP_TAG = 'stamp';

function isStamp(photo) {
  return Array.isArray(photo.tags) && photo.tags.includes(STAMP_TAG);
}

/**
 * Order gallery photos by their deterministic rating and hide low-rated
 * overflow when there is enough strong material.
 *
 * A photo with rating 50 is not "high" for the trigger, but it is not hidden
 * either: the rule hides only ratings below 50 once three photos above 50
 * exist. Without three strong photos, every photo stays visible.
 *
 * @template {{rating?: number, tags?: string[]}} T
 * @param {readonly T[]} photos
 * @returns {T[]}
 */
export function rankPhotos(photos) {
  const regular = [];
  const stamps = [];
  photos.forEach((photo, index) => {
    (isStamp(photo) ? stamps : regular).push({ photo, index });
  });
  const ranked = regular.sort((a, b) => {
    const byRating = (b.photo.rating ?? 0) - (a.photo.rating ?? 0);
    return byRating || a.index - b.index;
  });
  const strong = ranked.filter(({ photo }) => (photo.rating ?? 0) > HIGH_RATING).length;
  const visible =
    strong >= MIN_HIGH_PHOTOS
      ? ranked.filter(({ photo }) => (photo.rating ?? 0) >= HIGH_RATING)
      : ranked;
  // Stamps never affect the rating-based overflow rule and always sit after
  // real photographs, in their original order.
  return [...visible.map(({ photo }) => photo), ...stamps.map(({ photo }) => photo)];
}
