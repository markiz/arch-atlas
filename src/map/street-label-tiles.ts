/** Precomputed street-label tiles: one binary file per language. */
export const LABEL_TILE_SIZE = 512;
export const LABEL_TILE_MAGIC = 'ATLLBL01';
export const LABEL_TILE_VERSION = 1;

/** Tile-local positions in quarter pixels, angles in milliradians. */
export type LabelTileGlyphs = {
  count: number;
  x: Int16Array;
  y: Int16Array;
  angle: Int16Array;
  code: Uint16Array;
};

export type StreetLabelTileSet = {
  /** zoom key is zoom * 2, i.e. 31 for 15.5. */
  levels: Map<number, Map<string, LabelTileGlyphs>>;
};

/** Parse a gzip-decompressed label-tile file. Throws on malformed input. */
export function parseStreetLabelTiles(buffer: ArrayBuffer): StreetLabelTileSet {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12) throw new Error('label tiles: файл слишком короткий');
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
    view.getUint8(4),
    view.getUint8(5),
    view.getUint8(6),
    view.getUint8(7),
  );
  if (magic !== LABEL_TILE_MAGIC) throw new Error('label tiles: неверная сигнатура');
  if (view.getUint16(8, true) !== LABEL_TILE_VERSION)
    throw new Error('label tiles: неподдерживаемая версия');
  const zoomCount = view.getUint16(10, true);
  let offset = 12;
  const levels = new Map<number, Map<string, LabelTileGlyphs>>();
  for (let zoomIndex = 0; zoomIndex < zoomCount; zoomIndex++) {
    if (offset + 6 > buffer.byteLength) throw new Error('label tiles: обрезан заголовок зума');
    const zoom2 = view.getUint16(offset, true);
    const tileCount = view.getUint32(offset + 2, true);
    offset += 6;
    const tiles = new Map<string, LabelTileGlyphs>();
    for (let tileIndex = 0; tileIndex < tileCount; tileIndex++) {
      if (offset + 12 > buffer.byteLength) throw new Error('label tiles: обрезан тайл');
      const tx = view.getInt32(offset, true);
      const ty = view.getInt32(offset + 4, true);
      const count = view.getUint32(offset + 8, true);
      offset += 12;
      if (offset + count * 8 > buffer.byteLength) throw new Error('label tiles: обрезаны глифы');
      const x = new Int16Array(count);
      const y = new Int16Array(count);
      const angle = new Int16Array(count);
      const code = new Uint16Array(count);
      for (let glyph = 0; glyph < count; glyph++) {
        x[glyph] = view.getInt16(offset, true);
        y[glyph] = view.getInt16(offset + 2, true);
        angle[glyph] = view.getInt16(offset + 4, true);
        code[glyph] = view.getUint16(offset + 6, true);
        offset += 8;
      }
      tiles.set(`${tx},${ty}`, { count, x, y, angle, code });
    }
    levels.set(zoom2, tiles);
  }
  return { levels };
}
