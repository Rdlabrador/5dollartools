// Geometría y dibujo de las anotaciones (resaltar, subrayar, tachar, trazo, rectángulo, flecha, nota).
// Las usan la pantalla (anotar.js) y el guardado (guardar.js → construirPdf). Coordenadas de los elementos: puntos de la página
// tal como se ve a escala 1 (con el giro de la página aplicado); aquí se convierten a puntos PDF con el viewport de pdf.js.

export const COLORES = { amarillo: '#ffe600', verde: '#35d05a', rosa: '#ff6fb5', azul: '#2f80ff', rojo: '#e53935', negro: '#111111' };
export const OPACIDAD_RESALTE = 0.35;
export const TIPOS_ANOTACION = ['resaltar', 'subrayar', 'tachar', 'trazo', 'rect', 'flecha', 'nota'];
export const POS_LINEA = { subrayar: 0.92, tachar: 0.55 }; // altura de la línea dentro del rectángulo del texto

export function hexARgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '') || [0, '11', '11', '11'];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

// Douglas-Peucker sobre [[x,y],...]
export function simplificar(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const marca = new Uint8Array(pts.length); marca[0] = marca[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop(); let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = L === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * (px - ax) - dx * (py - ay)) / L;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { marca[idx] = 1; pila.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => marca[i]);
}

const f2 = (n) => (Math.round(n * 100) / 100).toString();
// Ruta SVG suave (curvas cuadráticas por los puntos medios) de [[x,y],...]
export function rutaSuave(P) {
  if (!P.length) return '';
  if (P.length === 1) return `M ${f2(P[0][0])} ${f2(P[0][1])} L ${f2(P[0][0] + 0.1)} ${f2(P[0][1])}`;
  let d = `M ${f2(P[0][0])} ${f2(P[0][1])}`;
  if (P.length === 2) return d + ` L ${f2(P[1][0])} ${f2(P[1][1])}`;
  const med = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = med(P[0], P[1]); d += ` L ${f2(m[0])} ${f2(m[1])}`;
  for (let i = 1; i < P.length - 1; i++) {
    m = med(P[i], P[i + 1]); d += ` Q ${f2(P[i][0])} ${f2(P[i][1])} ${f2(m[0])} ${f2(m[1])}`;
  }
  return d + ` L ${f2(P[P.length - 1][0])} ${f2(P[P.length - 1][1])}`;
}
// Puntas de una flecha que termina en (x2,y2) viniendo de (x1,y1)
export function puntasFlecha(x1, y1, x2, y2, g) {
  const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.max(9, g * 4.5), a = 0.5;
  return [[x2 - L * Math.cos(ang - a), y2 - L * Math.sin(ang - a)], [x2 - L * Math.cos(ang + a), y2 - L * Math.sin(ang + a)]];
}
export function rutaFlecha(x1, y1, x2, y2, g) {
  const [a, b] = puntasFlecha(x1, y1, x2, y2, g);
  return `M ${f2(x1)} ${f2(y1)} L ${f2(x2)} ${f2(y2)} M ${f2(a[0])} ${f2(a[1])} L ${f2(x2)} ${f2(y2)} L ${f2(b[0])} ${f2(b[1])}`;
}
// puntos relativos planos [x,y,x,y…] → [[x,y],…] absolutos (con origen ox,oy)
export const paresDe = (flat, ox = 0, oy = 0) => { const r = []; for (let i = 0; i + 1 < flat.length; i += 2) r.push([flat[i] + ox, flat[i + 1] + oy]); return r; };

// Dibuja un elemento de anotación en la página `pg` de pdf-lib. V = viewport de pdf.js a escala 1 de esa página.
// Los tipos que no son de anotación se ignoran (devuelve false).
export function dibujarAnotacion(doc, pg, V, it) {
  const { rgb, PDFHexString, PDFString } = PDFLib;
  const conv = (x, y) => V.convertToPdfPoint(x, y);
  const c = hexARgb(it.color), color = rgb(c[0], c[1], c[2]);
  const caja = () => {
    const [ax, ay] = conv(it.x, it.y), [bx, by] = conv(it.x + it.w, it.y + it.h);
    return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) };
  };
  const trazar = (P, grosor) => { // P: puntos de la vista → ruta en puntos PDF (drawSvgPath invierte Y)
    const Q = P.map(([x, y]) => { const [X, Y] = conv(x, y); return [X, -Y]; });
    pg.drawSvgPath(rutaSuave(Q), { x: 0, y: 0, borderColor: color, borderWidth: grosor, borderLineCap: PDFLib.LineCapStyle.Round });
  };
  switch (it.tipo) {
    case 'resaltar':
      pg.drawRectangle({ ...caja(), color, opacity: OPACIDAD_RESALTE, blendMode: PDFLib.BlendMode.Multiply, borderWidth: 0 });
      return true;
    case 'subrayar': case 'tachar': {
      const y = it.y + it.h * POS_LINEA[it.tipo];
      const [ax, ay] = conv(it.x, y), [bx, by] = conv(it.x + it.w, y);
      pg.drawLine({ start: { x: ax, y: ay }, end: { x: bx, y: by }, thickness: it.g || 2, color, lineCap: PDFLib.LineCapStyle.Butt });
      return true;
    }
    case 'ocultar': // recuadro negro opaco (ver proteger.js: al aplicar, la página se convierte en imagen)
      pg.drawRectangle({ ...caja(), color: rgb(0, 0, 0), borderWidth: 0 });
      return true;
    case 'trazo': trazar(paresDe(it.pts, it.x, it.y), it.g || 3); return true;
    case 'rect':
      pg.drawRectangle({ ...caja(), borderColor: color, borderWidth: it.g || 3 });
      return true;
    case 'flecha': {
      const [x1, y1, x2, y2] = [it.pts[0] + it.x, it.pts[1] + it.y, it.pts[2] + it.x, it.pts[3] + it.y];
      const [a, b] = puntasFlecha(x1, y1, x2, y2, it.g || 3);
      const Q = [[x1, y1], [x2, y2]].map(([x, y]) => { const [X, Y] = conv(x, y); return [X, -Y]; });
      const A = conv(a[0], a[1]), B = conv(b[0], b[1]), P2 = conv(x2, y2);
      const d = `M ${f2(Q[0][0])} ${f2(Q[0][1])} L ${f2(Q[1][0])} ${f2(Q[1][1])} M ${f2(A[0])} ${f2(-A[1])} L ${f2(P2[0])} ${f2(-P2[1])} L ${f2(B[0])} ${f2(-B[1])}`;
      pg.drawSvgPath(d, { x: 0, y: 0, borderColor: color, borderWidth: it.g || 3, borderLineCap: PDFLib.LineCapStyle.Round });
      return true;
    }
    case 'nota': {
      const texto = String(it.texto || '').trim(); if (!texto) return true;
      const r = caja(), w = r.width, h = r.height, ctx = doc.context;
      const cont = `q ${c[0]} ${c[1]} ${c[2]} rg 0 0 ${w} ${h} re f 0.2 0.2 0.2 RG 1 w 0.5 0.5 ${w - 1} ${h - 1} re S `
        + `0.2 0.2 0.2 RG 1.2 w ${w * 0.22} ${h * 0.68} m ${w * 0.78} ${h * 0.68} l S ${w * 0.22} ${h * 0.5} m ${w * 0.78} ${h * 0.5} l S ${w * 0.22} ${h * 0.32} m ${w * 0.55} ${h * 0.32} l S Q`;
      const ap = ctx.register(ctx.stream(cont, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, w, h], Resources: {} }));
      const annot = ctx.obj({
        Type: 'Annot', Subtype: 'Text', Contents: PDFHexString.fromText(texto), Rect: [r.x, r.y, r.x + w, r.y + h],
        C: [c[0], c[1], c[2]], Name: 'Comment', T: PDFHexString.fromText('Firmar PDF'), F: 28, Open: false,
        M: PDFString.fromDate(new Date()), AP: { N: ap },
      });
      pg.node.addAnnot(ctx.register(annot));
      return true;
    }
    default: return false;
  }
}
