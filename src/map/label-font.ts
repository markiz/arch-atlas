let fontPromise: Promise<void> | null = null;

/**
 * The label tiles are laid out with DejaVu Sans metrics. Loading the same face
 * in the browser keeps glyph advances and the tile positions in sync.
 */
export function loadStreetLabelFont(): Promise<void> {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    if (typeof FontFace === 'undefined' || !document.fonts) return;
    const url = `${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`;
    const face = new FontFace('Atlas Labels', `url("${url}") format("truetype")`);
    await face.load();
    document.fonts.add(face);
  })().catch((error) => {
    fontPromise = null;
    throw error;
  });
  return fontPromise;
}
