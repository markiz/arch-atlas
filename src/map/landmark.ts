const DRAWINGS: Record<string, string> = {
  museum: 'M4 13h16M6 13v8M10 13v8M14 13v8M18 13v8M3 21h18M12 4 3 10h18L12 4Z',
  castle: 'M4 21V10h3V6h3v4h4V6h3v4h3v11H4ZM9 21v-6h6v6M2 10h5m7 0h8',
  church: 'M5 21V11l7-5 7 5v10M3 21h18M9 21v-6h6v6M12 2v7M9.5 5h5',
  theatre: 'M4 7h16M6 7v12M18 7v12M8 11h8M8 15h8',
  monument: 'M12 3l3 6h-6l3-6ZM8 9h8v10H8ZM5 21h14',
};
const COLORS: Record<string, string> = {
  castle: '#746542',
  church: '#805664',
  theatre: '#6b5b8a',
  monument: '#5f7a6a',
};

export function landmarkSvg(category: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '30');
  svg.setAttribute('height', '36');
  svg.setAttribute('viewBox', '0 0 30 36');
  svg.setAttribute('aria-hidden', 'true');
  const pin = document.createElementNS(svg.namespaceURI, 'path');
  pin.setAttribute(
    'd',
    'M15 1C7.4 1 1.5 6.8 1.5 14c0 9.2 13.5 21 13.5 21S28.5 23.2 28.5 14C28.5 6.8 22.6 1 15 1Z',
  );
  pin.setAttribute('fill', COLORS[category] || '#a96f43');
  pin.setAttribute('stroke', '#fffef5');
  pin.setAttribute('stroke-width', '1.5');
  svg.append(pin);
  const glyph = document.createElementNS(svg.namespaceURI, 'path');
  glyph.setAttribute('d', DRAWINGS[category] || DRAWINGS.museum);
  glyph.setAttribute('transform', 'translate(6 7) scale(.75)');
  glyph.setAttribute('fill', 'none');
  glyph.setAttribute('stroke', '#fffef5');
  glyph.setAttribute('stroke-width', '1.7');
  glyph.setAttribute('stroke-linecap', 'round');
  glyph.setAttribute('stroke-linejoin', 'round');
  svg.append(glyph);
  return svg;
}
