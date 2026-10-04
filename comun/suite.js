// Núcleo común de la suite 5dollartools (extraído de MyBags).
// Lo que todas las herramientas comparten: utilidades, datos en el dispositivo, limpieza de
// imágenes y separación de colores, franja de contacto, pantallas de clientes y versiones,
// respaldo y salida de archivos. Cada app pone solo su editor y lo conecta con Suite.shell().
window.Suite = (() => {
  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const d2rgb = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const lumRGB = c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  function roundRect(p, x, y, w, h, r) {
    p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); p.closePath();
  }
  const esc = t => String(t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fmtDate = t => new Date(t).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  const imgFrom = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  function loadImage(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => imgFrom(r.result).then(res, rej);
      r.onerror = rej; r.readAsDataURL(file);
    });
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  // ---------- data saved on this device (IndexedDB: survives closing the app) ----------
  function openDB(name, version = 1) {
    const db = new Promise(res => {
      try {
        const r = indexedDB.open(name, version);
        r.onupgradeneeded = () => ['modelos', 'clientes', 'disenos', 'logos'].forEach(n => {
          if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'id' });
        });
        r.onsuccess = () => res(r.result); r.onerror = () => res(null);
      } catch { res(null); }
    });
    async function run(store, mode, fn) {
      const d = await db; if (!d) throw new Error('este navegador no permite guardar datos');
      return new Promise((res, rej) => {
        const tx = d.transaction(store, mode), r = fn(tx.objectStore(store));
        tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error);
      });
    }
    const all = async store => { try { return (await run(store, 'readonly', st => st.getAll())) || []; } catch { return []; } };
    return { run, all };
  }

  // ---------- image cleaning ----------
  // Images arrive any way (PNG, JPG from WhatsApp, screenshots, colour or B/W):
  // detect the background, remove it, trim margins, then turn it into 1 ink, 2 inks or keep colours.
  function detectBg(p, w, h) {
    const px = [];
    const take = (x, y) => { const i = (y * w + x) * 4; px.push([p[i], p[i + 1], p[i + 2], p[i + 3]]); };
    const sx = Math.max(1, Math.floor(w / 80)), sy = Math.max(1, Math.floor(h / 80));
    for (let x = 0; x < w; x += sx) { take(x, 0); take(x, 1); take(x, h - 1); take(x, h - 2); }
    for (let y = 0; y < h; y += sy) { take(0, y); take(1, y); take(w - 1, y); take(w - 2, y); }
    const clear = px.filter(c => c[3] < 30).length;
    if (clear > px.length * 0.4) return { transparent: true, uniform: true };
    const solid = px.filter(c => c[3] >= 30), med = k => solid.map(c => c[k]).sort((a, b) => a - b)[solid.length >> 1];
    const rgb = [med(0), med(1), med(2)];
    // a photo has no flat border: most border pixels are far from the median colour
    const near = solid.filter(c => d2rgb(c, rgb) < 45 * 45).length;
    return { transparent: false, rgb, uniform: near > solid.length * 0.7 };
  }
  // true when the image looks like a logo on a flat (or transparent) background; false for photos
  function fondoUniforme(img) {
    const w = Math.min(300, img.naturalWidth || 300), h = Math.max(4, Math.round(w * (img.naturalHeight || 300) / (img.naturalWidth || 300)));
    const c = newCanvas(w, h), x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    return detectBg(x.getImageData(0, 0, w, h).data, w, h).uniform;
  }

  // colour separation (what a print shop does by hand): the image's main colours are found
  // automatically; each one is then printed as ink, halftone ("trama") or left as bare paper.
  // k-means with farthest-point seeds: the main colours of a list of [r, g, b] points
  function kmeans(pts, maxColors) {
    let cs = [pts.reduce((m, c) => lumRGB(c) < lumRGB(m) ? c : m, pts[0])];
    while (cs.length < maxColors) {
      let best = null, bd = 0;
      for (const c of pts) { const d = Math.min(...cs.map(q => d2rgb(c, q))); if (d > bd) { bd = d; best = c; } }
      if (!best || bd < 50 * 50) break;
      cs.push(best);
    }
    let counts = [];
    for (let it = 0; it < 12; it++) {
      const sums = cs.map(() => [0, 0, 0]); counts = cs.map(() => 0);
      for (const c of pts) {
        let bi = 0, bd = Infinity;
        cs.forEach((q, j) => { const d = d2rgb(c, q); if (d < bd) { bd = d; bi = j; } });
        sums[bi][0] += c[0]; sums[bi][1] += c[1]; sums[bi][2] += c[2]; counts[bi]++;
      }
      cs = cs.map((q, j) => counts[j] ? sums[j].map(v => v / counts[j]) : q);
    }
    return cs.map((rgb, j) => ({ rgb, n: counts[j] })).filter(c => c.n > 0);
  }
  const segDist = (c, a, b) => {
    const ab = [0, 1, 2].map(i => b[i] - a[i]), ac = [0, 1, 2].map(i => c[i] - a[i]);
    const t = clamp((ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2]) / (d2rgb(a, b) || 1), 0, 1);
    return Math.sqrt(d2rgb(c, a.map((v, i) => v + ab[i] * t)));
  };
  // flatAt(k) says whether pixel k sits in a flat area. The colours are taken from flat areas only:
  // edges are blends, and JPG compression smears them with colours the logo never had.
  function extractPalette(p, f, bg, maxColors = 6, flatAt) {
    const all = [], flat = [], step = Math.max(1, Math.floor(f.length / 40000));
    for (let k = 0; k < f.length; k += step) if (f[k] > 0.7) {
      const i = k * 4, c = [p[i], p[i + 1], p[i + 2]];
      all.push(c); if (flatAt && flatAt(k)) flat.push(c);
    }
    if (!all.length) return [];
    const clean = flat.length >= 300;
    const km = kmeans(clean ? flat : all, maxColors), cs = km.map(c => c.rgb), base = clean ? flat.length : all.length;
    // (a colour used only in lines thinner than 3 pixels has no flat area and is not found: on a
    // compressed image it cannot be told apart from compression smear, which is far more common)
    const counts = cs.map(() => 0);
    for (const c of all) { let bi = 0, bd = Infinity; cs.forEach((q, j) => { const d = d2rgb(c, q); if (d < bd) { bd = d; bi = j; } }); counts[bi]++; }
    // merge near-duplicates (JPEG noise, antialiasing) and drop specks
    // share = of every pixel (edges included, they go to the nearest colour); solid = of the flat
    // areas only, which is what tells a real colour from an edge tint
    let pal = cs.map((rgb, j) => ({ rgb, share: counts[j] / all.length, solid: km[j].n / base })).filter(c => c.share > 0);
    for (let merged = true; merged;) {
      merged = false;
      outer: for (let a = 0; a < pal.length; a++) for (let b = a + 1; b < pal.length; b++) {
        if (d2rgb(pal[a].rgb, pal[b].rgb) < 45 * 45) {
          const t = pal[a].share + pal[b].share;
          pal[a] = { rgb: pal[a].rgb.map((v, i) => (v * pal[a].share + pal[b].rgb[i] * pal[b].share) / t), share: t, solid: pal[a].solid + pal[b].solid };
          pal.splice(b, 1); merged = true; break outer;
        }
      }
    }
    pal = pal.filter(c => c.solid >= 0.015).sort((a, b) => b.share - a.share);
    // a faint tint of the removed background covering little is compression noise on that background
    if (bg) pal = pal.filter(c => !(c.solid < 0.08 && d2rgb(c.rgb, bg) < 75 * 75));
    // a "colour" lying between two real ones (or between a real one and the removed background)
    // is just the soft edge where they meet
    const anchors = bg ? [...pal, { rgb: bg, solid: 1 }] : pal;
    pal = pal.filter(c => !(c.solid < 0.2 && anchors.some(a => a !== c && a.solid > c.solid &&
      anchors.some(b => b !== c && b !== a && b.solid > c.solid && segDist(c.rgb, a.rgb, b.rgb) < 28))));
    return pal.map(c => ({ rgb: c.rgb, share: c.share, hex: toHex(c.rgb) }));
  }

  // default roles: split colours into a "dark" and a "light" group (Otsu on luminance);
  // the group that contrasts with the product gets ink, the other stays bare
  function defaultRoles(pal, fondo) {
    if (!pal.length) return;
    if (pal.length === 1) { pal[0].role1 = 'ink'; pal[0].role2 = 'ink'; return; }
    const bagL = lumRGB(fondo), sorted = [...pal].sort((a, b) => lumRGB(a.rgb) - lumRGB(b.rgb));
    let bestK = 1, bestV = -1;
    for (let k = 1; k < sorted.length; k++) {
      const g1 = sorted.slice(0, k), g2 = sorted.slice(k);
      const w1 = g1.reduce((s, c) => s + c.share, 0), w2 = g2.reduce((s, c) => s + c.share, 0);
      const m1 = g1.reduce((s, c) => s + lumRGB(c.rgb) * c.share, 0) / w1, m2 = g2.reduce((s, c) => s + lumRGB(c.rgb) * c.share, 0) / w2;
      const v = w1 * w2 * (m1 - m2) ** 2;
      if (v > bestV) { bestV = v; bestK = k; }
    }
    const dark = new Set(sorted.slice(0, bestK)), lightBag = bagL >= 0.5;
    pal.forEach(c => {
      const inkSide = lightBag ? dark.has(c) : !dark.has(c);
      c.role1 = inkSide ? 'ink' : 'paper';
      // 2 inks: the other group also prints if it stands out from the product
      c.role2 = inkSide ? 'ink' : d2rgb(c.rgb, fondo) > 70 * 70 ? 'ink2' : 'paper';
    });
  }

  // limpiarImagen(img, o) returns the cleaned image as a canvas (background removed, margins trimmed).
  // o = { mode: 'color' | 'ink' | 'ink2', thr, removeBg, invert, ink, ink2, ink2Auto, palette, paletteDirty, fondo: [r,g,b], max / min: longest side in px (big images are shrunk to max, small ones enlarged to min) }
  // o.palette is filled in here. With sep = 'ink' | 'ink2' | 'trama' it returns that ink alone
  // as a solid mask with the same size/crop (used for layered print files).
  // o.vector (with mode 'color'): the image is reduced to its flat colours, as it will be once
  // vectorised; sep = { stack: k } then returns the mask of colour k plus every colour above it.
  function limpiarImagen(img, o, sep) {
    let w = img.naturalWidth || img.width || 1000, h = img.naturalHeight || img.height || 1000;
    // cap huge images, upscale tiny ones (e.g. small SVGs) so they stay crisp
    const max = Math.max(w, h), cap = o.max || 1600, lo = o.min || 600, kk = max > cap ? cap / max : max < lo ? lo / max : 1;
    w = Math.round(w * kk); h = Math.round(h * kk);
    const c = newCanvas(w, h), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h), p = d.data, n = w * h;

    // f = how much each pixel belongs to the image (0 = background, 1 = image)
    const bgInfo = detectBg(p, w, h), f = new Float32Array(n);
    const t = 0.03 + o.thr / 100 * 0.45, soft = 0.06;
    const step = v => clamp((v - t + soft) / (2 * soft), 0, 1);
    if (bgInfo.transparent) {
      for (let k = 0, i = 3; k < n; k++, i += 4) f[k] = p[i] / 255;
    } else {
      const [br, bgc, bb] = bgInfo.rgb;
      for (let k = 0, i = 0; k < n; k++, i += 4) {
        const a = p[i + 3] / 255;
        if (o.mode === 'color' && !o.removeBg) { f[k] = a; continue; }
        const dist = Math.max(Math.abs(p[i] - br), Math.abs(p[i + 1] - bgc), Math.abs(p[i + 2] - bb)) / 255;
        f[k] = a * step(dist);
      }
    }

    // trim empty margins
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (f[y * w + xx] > 0.1) {
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }

    const flat = o.mode === 'color' && !!o.vector;
    if (o.mode !== 'color' || flat) {
      if (o.paletteDirty || !o.palette) {
        // keep the user's choices for colours that are still there after re-cleaning
        // flat = no colour jump towards any neighbour one original pixel away
        const ds = Math.max(1, Math.round(kk)), offs = [-ds * 4, ds * 4, -ds * w * 4, ds * w * 4];
        const flatAt = k => {
          const xx = k % w, y = (k - xx) / w, i = k * 4;
          if (xx < ds || xx >= w - ds || y < ds || y >= h - ds) return false;
          for (const q of offs) if (Math.max(Math.abs(p[i] - p[i + q]), Math.abs(p[i + 1] - p[i + 1 + q]), Math.abs(p[i + 2] - p[i + 2 + q])) > 36) return false;
          return true;
        };
        const old = o.palette || [], pal = extractPalette(p, f, bgInfo.transparent ? null : bgInfo.rgb, flat ? 12 : 6, flatAt);
        defaultRoles(pal, o.fondo || [255, 255, 255]);
        pal.forEach(q => {
          const prev = old.find(v => d2rgb(v.rgb, q.rgb) < 40 * 40);
          if (prev && prev.manual) { q.role1 = prev.role1; q.role2 = prev.role2; q.manual = true; }
        });
        o.palette = pal; o.paletteDirty = false;
        const second = pal.find(q => q.role2 === 'ink2');
        if (second && o.ink2Auto) o.ink2 = second.hex;
      }
      const pal = o.palette, roleKey = o.mode === 'ink2' ? 'role2' : 'role1';
      const ink1 = hexToRgb(o.ink), ink2 = hexToRgb(o.ink2);
      // halftone dots at 45°, ~50% coverage
      const period = Math.max(5, Math.round(Math.max(w, h) / 110)), R2 = 0.4;
      const dot = (xx, y) => {
        const u = (xx + y) / (period * Math.SQRT2), v = (xx - y) / (period * Math.SQRT2);
        const du = u - Math.round(u), dv = v - Math.round(v), dist = Math.hypot(du, dv);
        return clamp((R2 - dist) * period * 0.9 + 0.5, 0, 1);
      };
      // an edge pixel is the colour mixed with the removed background: it belongs to the colour it
      // fades from (the one whose line to the background passes closest), not to whichever palette
      // colour it happens to resemble (light blue on white is blue, not yellow)
      const bgc = bgInfo.transparent ? null : bgInfo.rgb;
      for (let k = 0, i = 0; k < n; k++, i += 4) {
        let a = 0, col = ink1;
        if (f[k] > 0.01 && pal.length) {
          let bi = 0, bd = Infinity;
          const edge = bgc && f[k] < 0.98, r0 = p[i], g0 = p[i + 1], b0 = p[i + 2];
          for (let j = 0; j < pal.length; j++) {
            const q = pal[j].rgb;
            let dd = (r0 - q[0]) ** 2 + (g0 - q[1]) ** 2 + (b0 - q[2]) ** 2;
            if (edge) {
              const vx = q[0] - bgc[0], vy = q[1] - bgc[1], vz = q[2] - bgc[2], wx = r0 - bgc[0], wy = g0 - bgc[1], wz = b0 - bgc[2];
              const t = clamp((wx * vx + wy * vy + wz * vz) / (vx * vx + vy * vy + vz * vz || 1), 0, 1);
              dd = (wx - vx * t) ** 2 + (wy - vy * t) ** 2 + (wz - vz * t) ** 2 + 0.03 * dd;
            }
            if (dd < bd) { bd = dd; bi = j; }
          }
          const role = pal[bi][roleKey], xx = k % w;
          if (flat) { col = pal[bi].rgb; a = sep ? (bi >= sep.stack ? f[k] : 0) : f[k]; }
          else if (sep) a = role === sep ? f[k] : 0;
          else if (role === 'ink') a = f[k];
          else if (role === 'ink2') { a = f[k]; col = ink2; }
          else if (role === 'trama') a = f[k] * dot(xx, (k - xx) / w);
          if (sep === 'ink' && o.mode === 'ink' && o.invert && role === 'trama') a = f[k];
        }
        if (o.mode === 'ink' && o.invert && sep !== 'trama') {
          const xx = k % w, y = (k - xx) / w;
          a = xx >= x0 && xx <= x1 && y >= y0 && y <= y1 ? 1 - a : 0;
        } else if (o.mode === 'ink' && o.invert) a = 0;
        p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = Math.round(a * 255);
      }
    } else {
      for (let k = 0, i = 0; k < n; k++, i += 4) p[i + 3] = Math.round(f[k] * 255);
    }

    const pad = Math.round(Math.max(w, h) * 0.01);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const out = newCanvas(x1 - x0 + 1, y1 - y0 + 1);
    out.getContext('2d').putImageData(d, -x0, -y0);
    out._px = Math.max(1, kk);   // how much the image was enlarged: the vectoriser works in original pixels
    out._k = kk; out._x0 = x0; out._y0 = y0;   // and where this crop sits in the enlarged image
    return out;
  }
  const ROLE_NAMES = { ink: 'Tinta', trama: 'Trama', paper: 'Papel', ink2: 'Tinta 2' };

  // ---------- vectoriser ----------
  // Turns a canvas (alpha = where there is ink) into smooth SVG path data, in the canvas' pixel units.
  // 1) the edge is found *between* pixels (marching squares on the soft alpha, lightly smoothed),
  //    so it does not copy the pixel staircase; 2) corners are kept sharp; 3) everything between
  //    two corners is fitted with as few Bézier curves as the tolerance allows.
  // o.px = how many pixels of `src` one pixel of the original image takes (images enlarged before
  // cleaning): smoothing, corner size and tolerance are all measured in original pixels, so the
  // curves ignore pixel steps and JPG wobble instead of copying them.
  function vectorizar(src, o = {}) {
    const px = Math.max(1, o.px || src._px || 1);
    // work on a grid of about 3 cells per original pixel (never coarser than the source, never huge)
    const u = clamp(Math.min(3 / px, (o.max || 3200) / Math.max(src.width, src.height)), 1, 3), g = px * u;   // g = grid cells per original pixel
    const soft = o.soft || 1;   // user's "suavizado": 1 = normal, more = calmer edges, less = more detail
    const sigma = 0.6 * g * soft, B = Math.ceil(sigma * 3) + 2;
    const W = Math.round(src.width * u) + 2 * B, H = Math.round(src.height * u) + 2 * B, n = W * H;
    const c = newCanvas(W, H), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(src, B, B, W - 2 * B, H - 2 * B);
    const im = x.getImageData(0, 0, W, H).data, a = new Float32Array(n), t = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = im[i * 4 + 3] / 255;
    // light passes (1-2-1, each adds 0.5 of variance) melt pixel steps and JPG wobble into a clean
    // gradient about 0.6 original pixels wide; corners rounded by this are rebuilt sharp later
    for (let pass = 0, n2 = clamp(Math.round(2 * sigma * sigma), 2, 40); pass < n2; pass++) {
      for (let i = 1; i < n - 1; i++) t[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4;
      for (let i = W; i < n - W; i++) a[i] = (t[i - W] + 2 * t[i] + t[i + W]) / 4;
    }
    // marching squares: every grid edge the outline crosses is linked to the next one
    const iso = 0.5, links = new Map();
    const link = (e1, e2) => {
      let l = links.get(e1); if (!l) links.set(e1, l = []); l.push(e2);
      l = links.get(e2); if (!l) links.set(e2, l = []); l.push(e1);
    };
    for (let y = 0; y < H - 1; y++) for (let xx = 0; xx < W - 1; xx++) {
      const i = y * W + xx;
      const k = (a[i] >= iso ? 8 : 0) | (a[i + 1] >= iso ? 4 : 0) | (a[i + W + 1] >= iso ? 2 : 0) | (a[i + W] >= iso ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const T = i, Bo = i + W, L = n + i, R = n + i + 1;   // top / bottom edges, left / right edges
      switch (k) {
        case 1: case 14: link(L, Bo); break;
        case 2: case 13: link(Bo, R); break;
        case 3: case 12: link(L, R); break;
        case 4: case 11: link(T, R); break;
        case 6: case 9: link(T, Bo); break;
        case 7: case 8: link(T, L); break;
        default: {   // 5, 10: two opposite corners inside; the centre decides if they touch
          const cen = (a[i] + a[i + 1] + a[i + W] + a[i + W + 1]) / 4 >= iso;
          if ((k === 5) === cen) { link(T, L); link(Bo, R); } else { link(T, R); link(L, Bo); }
        }
      }
    }
    const pt = e => {
      if (e < n) { const v0 = a[e], v1 = a[e + 1]; return [e % W + (iso - v0) / (v1 - v0), (e / W) | 0]; }
      const i = e - n, v0 = a[i], v1 = a[i + W]; return [i % W, ((i / W) | 0) + (iso - v0) / (v1 - v0)];
    };
    const seen = new Set(), minArea = (o.minArea || 3) * g * g, tol = (o.tol || 0.25) * g * soft, parts = [];
    // o.scale / o.dx / o.dy: write the curves in another canvas' coordinates
    const sc = o.scale || 1, fx = v => +((v - B) / u * sc + (o.dx || 0)).toFixed(2), fy = v => +((v - B) / u * sc + (o.dy || 0)).toFixed(2);
    for (const start of links.keys()) {
      if (seen.has(start)) continue;
      const P = []; let prev = -1, cur = start;
      while (cur !== undefined && !seen.has(cur)) {
        seen.add(cur); P.push(pt(cur));
        const l = links.get(cur), nx = l[0] !== prev ? l[0] : l[1];
        prev = cur; cur = nx;
      }
      let area = 0;
      for (let i = 0, N = P.length; i < N; i++) { const p = P[i], q = P[(i + 1) % N]; area += p[0] * q[1] - q[0] * p[1]; }
      if (P.length < 6 || Math.abs(area) / 2 < minArea) continue;
      const bez = fitLoop(P, Math.max(3, Math.round(2.2 * g * Math.max(1, soft))), tol);
      if (!bez.length) continue;
      let d = `M${fx(bez[0][0][0])} ${fy(bez[0][0][1])}`;
      for (const b of bez) d += `C${fx(b[1][0])} ${fy(b[1][1])} ${fx(b[2][0])} ${fy(b[2][1])} ${fx(b[3][0])} ${fy(b[3][1])}`;
      parts.push(d + 'Z');
    }
    return parts.length ? parts.join(' ') : null;
  }
  const vSub = (p, q) => [p[0] - q[0], p[1] - q[1]], vDot = (p, q) => p[0] * q[0] + p[1] * q[1];
  const vNorm = p => { const l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l]; };
  const bezAt = (b, t) => { const m = 1 - t, c0 = m * m * m, c1 = 3 * m * m * t, c2 = 3 * m * t * t, c3 = t * t * t; return [c0 * b[0][0] + c1 * b[1][0] + c2 * b[2][0] + c3 * b[3][0], c0 * b[0][1] + c1 * b[1][1] + c2 * b[2][1] + c3 * b[3][1]]; };
  // closed outline → list of cubic Béziers; K = how many points to look along when measuring a turn
  function fitLoop(P, K, tol) {
    const N = P.length, out = [], corners = [], at = j => P[((j % N) + N) % N];
    if (N >= 6 * K) {
      const turn = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const p0 = at(i - K), p1 = P[i], p2 = at(i + K);
        const ax = p1[0] - p0[0], ay = p1[1] - p0[1], bx = p2[0] - p1[0], by = p2[1] - p1[1];
        turn[i] = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
      }
      for (let i = 0; i < N; i++) {
        if (turn[i] < 1) continue;   // ~57°: sharper than that is a corner, not a curve
        let top = true;
        for (let j = 1; j <= K && top; j++) if (turn[(i - j + N) % N] > turn[i] || turn[(i + j) % N] >= turn[i]) top = false;
        if (top) corners.push(i);
      }
    }
    if (!corners.length) {
      const Q = P.concat([P[0]]), tc = vNorm(vSub(P[1], P[N - 1]));
      fitCubic(Q, 0, N, tc, [-tc[0], -tc[1]], tol * tol, out);
      return out;
    }
    // pixels and smoothing round every corner off: rebuild the sharp point where the two
    // edges that reach it would meet, and drop the rounded bit in between
    const gap = (c0, c1) => ((c1 - c0 + N) % N) || N, M = corners.length;
    const V = corners.map((c, k) => {
      // each edge needs a straight-ish stretch between this corner's rounding and the next one's
      const g0 = gap(corners[(k - 1 + M) % M], c), g1 = gap(c, corners[(k + 1) % M]);
      if (g0 < 2 * K + 2 || g1 < 2 * K + 2) return { p: P[c], cut: 1 };
      const a = at(c - K), da = vNorm(vSub(a, at(c - Math.min(2 * K, g0 - K)))), b = at(c + K), db = vNorm(vSub(b, at(c + Math.min(2 * K, g1 - K))));
      const den = da[0] * db[1] - da[1] * db[0];
      if (Math.abs(den) > 0.2) {
        const s = ((b[0] - a[0]) * db[1] - (b[1] - a[1]) * db[0]) / den, t = ((b[0] - a[0]) * da[1] - (b[1] - a[1]) * da[0]) / den;
        if (s > 0 && t > 0 && s < 3 * K && t < 3 * K) return { p: [a[0] + da[0] * s, a[1] + da[1] * s], cut: K };
      }
      return { p: P[c], cut: 1 };
    });
    corners.forEach((c0, k) => {
      const k1 = (k + 1) % M, len = gap(c0, corners[k1]), Q = [V[k].p];
      for (let j = V[k].cut; j <= len - V[k1].cut; j++) Q.push(at(c0 + j));
      Q.push(V[k1].p);
      const n = Q.length - 1, e0 = V[k].cut > 1 ? 1 : Math.min(K, n), e1 = V[k1].cut > 1 ? 1 : Math.min(K, n);
      fitCubic(Q, 0, n, vNorm(vSub(Q[e0], Q[0])), vNorm(vSub(Q[n - e1], Q[n])), tol * tol, out);
    });
    return out;
  }
  // Schneider's curve fitting: one Bézier through P[a..b] with the given end tangents; split where it fits worst
  function fitCubic(P, a, b, t1, t2, err, out) {
    if (b - a === 1) {
      const d = Math.hypot(P[b][0] - P[a][0], P[b][1] - P[a][1]) / 3;
      out.push([P[a], [P[a][0] + t1[0] * d, P[a][1] + t1[1] * d], [P[b][0] + t2[0] * d, P[b][1] + t2[1] * d], P[b]]); return;
    }
    let u = [0];
    for (let i = a + 1; i <= b; i++) u.push(u[i - a - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const total = u[u.length - 1] || 1; u = u.map(v => v / total);
    const gen = () => {
      let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
      for (let i = a; i <= b; i++) {
        const t = u[i - a], m = 1 - t, b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t;
        const a1 = [t1[0] * b1, t1[1] * b1], a2 = [t2[0] * b2, t2[1] * b2];
        const tmp = [P[i][0] - (P[a][0] * (b0 + b1) + P[b][0] * (b2 + b3)), P[i][1] - (P[a][1] * (b0 + b1) + P[b][1] * (b2 + b3))];
        c00 += vDot(a1, a1); c01 += vDot(a1, a2); c11 += vDot(a2, a2); x0 += vDot(a1, tmp); x1 += vDot(a2, tmp);
      }
      const det = c00 * c11 - c01 * c01, seg = Math.hypot(P[b][0] - P[a][0], P[b][1] - P[a][1]);
      let al = det ? (x0 * c11 - x1 * c01) / det : 0, ar = det ? (c00 * x1 - c01 * x0) / det : 0;
      if (al < seg * 1e-6 || ar < seg * 1e-6) al = ar = seg / 3;
      return [P[a], [P[a][0] + t1[0] * al, P[a][1] + t1[1] * al], [P[b][0] + t2[0] * ar, P[b][1] + t2[1] * ar], P[b]];
    };
    const worst = bz => {
      let max = 0, at = (a + b) >> 1;
      for (let i = a + 1; i < b; i++) { const q = bezAt(bz, u[i - a]), d = (q[0] - P[i][0]) ** 2 + (q[1] - P[i][1]) ** 2; if (d >= max) { max = d; at = i; } }
      return [max, at];
    };
    let bz = gen(), [max, at] = worst(bz);
    if (max < err) { out.push(bz); return; }
    if (max < err * 16) for (let it = 0; it < 4; it++) {
      // Newton step: slide each point's parameter to where the curve is really closest
      u = u.map((t, k) => {
        const p = P[a + k], q = bezAt(bz, t), m = 1 - t;
        const d1 = [0, 1].map(j => 3 * (m * m * (bz[1][j] - bz[0][j]) + 2 * m * t * (bz[2][j] - bz[1][j]) + t * t * (bz[3][j] - bz[2][j])));
        const d2 = [0, 1].map(j => 6 * (m * (bz[2][j] - 2 * bz[1][j] + bz[0][j]) + t * (bz[3][j] - 2 * bz[2][j] + bz[1][j])));
        const num = (q[0] - p[0]) * d1[0] + (q[1] - p[1]) * d1[1], den = d1[0] * d1[0] + d1[1] * d1[1] + (q[0] - p[0]) * d2[0] + (q[1] - p[1]) * d2[1];
        return den ? clamp(t - num / den, 0, 1) : t;
      });
      bz = gen(); [max, at] = worst(bz);
      if (max < err) { out.push(bz); return; }
    }
    const tc = vNorm(vSub(P[at - 1], P[at + 1]));
    fitCubic(P, a, at, t1, tc, err, out);
    fitCubic(P, at, b, [-tc[0], -tc[1]], t2, err, out);
  }

  // Every pixel of a flat-colour image is either one of the palette colours or, on an edge, a blend
  // of two of them (or of one and the background). mezcla() works that out for the whole image:
  // for each pixel, the two colours involved and how much of the second one. From that, the exact
  // coverage of any set of colours follows, which puts each edge where it really is (between
  // pixels), with no fringe of a third colour and no "colours" invented by JPG compression.
  function mezcla(img, o) {
    const ref = limpiarImagen(img, o), pal = o.palette || [];   // palette + how the cleaned image is cropped
    if (!pal.length) return null;
    const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height, sN = Math.min(1, 1600 / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * sN)), h = Math.max(1, Math.round(nh * sN)), c = newCanvas(w, h), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
    const p = x.getImageData(0, 0, w, h).data, bgI = detectBg(p, w, h), N = w * h;
    const nodes = pal.map(q => q.rgb), nc = nodes.length;
    if (!bgI.transparent && (o.mode !== 'color' || o.removeBg)) nodes.push(bgI.rgb);   // the background is one more "colour", worth nothing
    const pairs = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const v = [nodes[j][0] - nodes[i][0], nodes[j][1] - nodes[i][1], nodes[j][2] - nodes[i][2]];
      pairs.push([i, j, v[0], v[1], v[2], v[0] * v[0] + v[1] * v[1] + v[2] * v[2] || 1]);
    }
    const iA = new Uint8Array(N), iB = new Uint8Array(N), tB = new Float32Array(N), al = new Float32Array(N);
    for (let k = 0, i = 0; k < N; k++, i += 4) {
      const a = p[i + 3] / 255; al[k] = a;
      if (a < 0.02) { iA[k] = iB[k] = 255; continue; }
      const r = p[i], g = p[i + 1], b = p[i + 2];
      let n1 = 0, d1 = Infinity;
      for (let j = 0; j < nodes.length; j++) { const q = nodes[j], d = (r - q[0]) ** 2 + (g - q[1]) ** 2 + (b - q[2]) ** 2; if (d < d1) { d1 = d; n1 = j; } }
      let ba = n1, bb = n1, bt = 0;
      if (d1 > 24 * 24) {   // not one of the colours: find the pair whose blend explains it best
        let bd = d1;
        for (const q of pairs) {
          const A = nodes[q[0]], wx = r - A[0], wy = g - A[1], wz = b - A[2];
          const t = clamp((wx * q[2] + wy * q[3] + wz * q[4]) / q[5], 0, 1), d = (wx - q[2] * t) ** 2 + (wy - q[3] * t) ** 2 + (wz - q[4] * t) ** 2;
          if (d < bd - 1) { bd = d; ba = q[0]; bb = q[1]; bt = t; }
        }
      }
      iA[k] = ba; iB[k] = bb; tB[k] = bt;
    }
    return { w, h, nc, iA, iB, tB, al, pal, scale: ref._k / sN, dx: -ref._x0, dy: -ref._y0 };
  }
  // mask (alpha = coverage) of the palette colours that pass `test`
  function maskOf(M, test) {
    const m = newCanvas(M.w, M.h), mx = m.getContext('2d'), id = mx.createImageData(M.w, M.h), q = id.data;
    const on = new Uint8Array(256); for (let j = 0; j < M.nc; j++) on[j] = test(j) ? 1 : 0;
    for (let k = 0, N = M.w * M.h; k < N; k++) {
      const a = M.iA[k]; if (a === 255) continue;
      const t = M.tB[k], v = M.al[k] * (on[a] * (1 - t) + on[M.iB[k]] * t);
      if (v > 0) q[k * 4 + 3] = Math.round(v * 255);
    }
    mx.putImageData(id, 0, 0);
    return m;
  }

  // an image as flat vector layers, ready for an SVG: [{ id, label, fill, d }] in the cleaned image's pixels.
  // 1 / 2 inks: one layer per ink (halftone becomes a 50 % tint). Colours: one layer per colour, stacked
  // from the largest up, each one also covering what goes above it so no hairline gaps show between colours.
  // o.suave (0-100, 50 = normal): how much the edges are calmed
  function capasVector(img, o) {
    const out = [], tint = (hex, t) => toHex(hexToRgb(hex).map(v => v + (255 - v) * t));
    const s = o.suave == null ? 50 : o.suave, soft = s <= 50 ? 0.5 + s / 100 : 1 + (s - 50) / 50 * 1.6;
    const seps = o.mode === 'ink2' ? [['ink', 'Tinta_1', o.ink, ''], ['ink2', 'Tinta_2', o.ink2, '']]
      : [['ink', 'Tinta_1', o.ink, ''], ['trama', 'Tinta_1_TRAMA', tint(o.ink, 0.5), ' - trama 50 %']];
    if (o.mode === 'ink' && o.invert) {   // "print the background instead": straight from the cleaned image
      for (const [role, id, fill, extra] of seps) {
        const d = vectorizar(limpiarImagen(img, o, role), { soft });
        if (d) out.push({ id, label: id.replace(/_/g, ' ') + extra, fill, d });
      }
      return out;
    }
    const M = mezcla(img, o);
    if (!M) return out;
    const trace = test => vectorizar(maskOf(M, test), { soft, scale: M.scale, dx: M.dx, dy: M.dy });
    if (o.mode === 'color') M.pal.forEach((c, k) => {
      const d = trace(j => j >= k);
      if (d) out.push({ id: 'Color_' + (k + 1), label: 'Color ' + c.hex, fill: c.hex, d });
    });
    else {
      const key = o.mode === 'ink2' ? 'role2' : 'role1';
      for (const [role, id, fill, extra] of seps) {
        const d = trace(j => M.pal[j][key] === role);
        if (d) out.push({ id, label: id.replace(/_/g, ' ') + extra, fill, d });
      }
    }
    return out;
  }

  // ---------- contact strip ----------
  const ICONS = {
    ig(c, x, y, s) {
      c.lineWidth = s * 0.11;
      const r = new Path2D(); roundRect(r, x - s * 0.42, y - s * 0.42, s * 0.84, s * 0.84, s * 0.24); c.stroke(r);
      c.beginPath(); c.arc(x, y, s * 0.19, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(x + s * 0.23, y - s * 0.23, s * 0.06, 0, Math.PI * 2); c.fill();
    },
    wa(c, x, y, s) {
      c.lineWidth = s * 0.1;
      c.beginPath(); c.arc(x, y, s * 0.4, Math.PI * 0.8, Math.PI * 2.62); c.lineTo(x - s * 0.47, y + s * 0.47); c.closePath(); c.stroke();
      c.save(); c.translate(x, y); c.rotate(-Math.PI / 4);
      const ph = new Path2D(); roundRect(ph, -s * 0.07, -s * 0.21, s * 0.14, s * 0.42, s * 0.06); c.fill(ph);
      c.fillRect(-s * 0.12, -s * 0.24, s * 0.24, s * 0.1); c.fillRect(-s * 0.12, s * 0.14, s * 0.24, s * 0.1);
      c.restore();
    },
    web(c, x, y, s) {
      c.lineWidth = s * 0.09;
      c.beginPath(); c.arc(x, y, s * 0.42, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(x, y, s * 0.18, s * 0.42, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(x - s * 0.42, y); c.lineTo(x + s * 0.42, y);
      c.moveTo(x - s * 0.36, y - s * 0.2); c.lineTo(x + s * 0.36, y - s * 0.2);
      c.moveTo(x - s * 0.36, y + s * 0.2); c.lineTo(x + s * 0.36, y + s * 0.2); c.stroke();
    },
    dir(c, x, y, s) {
      const p = new Path2D();
      p.moveTo(x, y + s * 0.48);
      p.bezierCurveTo(x - s * 0.1, y + s * 0.3, x - s * 0.36, y + s * 0.05, x - s * 0.36, y - s * 0.14);
      p.arc(x, y - s * 0.14, s * 0.36, Math.PI, 0);
      p.bezierCurveTo(x + s * 0.36, y + s * 0.05, x + s * 0.1, y + s * 0.3, x, y + s * 0.48);
      p.moveTo(x + s * 0.13, y - s * 0.14); p.arc(x, y - s * 0.14, s * 0.13, 0, Math.PI * 2);
      c.fill(p, 'evenodd');
    },
    mail(c, x, y, s) {
      c.lineWidth = s * 0.09; c.lineJoin = 'round';
      c.strokeRect(x - s * 0.44, y - s * 0.3, s * 0.88, s * 0.6);
      c.beginPath(); c.moveTo(x - s * 0.44, y - s * 0.3); c.lineTo(x, y + s * 0.05); c.lineTo(x + s * 0.44, y - s * 0.3); c.stroke();
    },
    fb(c, x, y, s) {
      c.font = `700 ${s * 1.05}px Arial, Helvetica, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('f', x, y + s * 0.04); c.textAlign = 'left';
    },
  };
  const CONTACT_KEYS = ['ig', 'wa', 'web', 'dir', 'mail', 'fb'];
  const CONTACT_LABELS = { ig: ['Instagram', '@tumarca'], wa: ['WhatsApp', '+56 9 1234 5678'], web: ['Web', 'www.tumarca.cl'], dir: ['Dirección', 'Calle 123, Ciudad'], mail: ['Correo', 'hola@tumarca.cl'], fb: ['Facebook', 'TuMarca'] };
  const CONTACT_FONT = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // lays the strip out centred on (cx, cy); returns its bounding box, or null when there is nothing to draw
  // data = { ig, wa, web, dir, mail, fb }; o = { fs, color, lines, maxW, cx, cy }
  function dibujarContacto(c, data, o) {
    const items = CONTACT_KEYS.filter(k => (data[k] || '').trim()).map(k => ({ k, text: data[k].trim() }));
    if (!items.length) return null;
    const fs = o.fs, icon = fs * 1.15, gap = fs * 0.45, sep = fs * 0.9, lineH = fs * 2;
    const font = `600 ${fs}px ${CONTACT_FONT}`;
    c.font = font;
    const width = it => icon + gap + c.measureText(it.text).width;
    // pack items into rows that fit the available width
    const rows = [[]];
    for (const it of items) {
      const row = rows[rows.length - 1];
      const rw = row.reduce((s, r) => s + width(r) + sep * 2, 0) + width(it);
      if (row.length && (rw > o.maxW || row.length >= 3)) rows.push([it]); else row.push(it);
    }
    const col = o.color, cx = o.cx, cy = o.cy;
    c.save();
    c.fillStyle = col; c.strokeStyle = col; c.textBaseline = 'middle';
    const top = cy - (rows.length * lineH) / 2;
    let bw = 0;
    rows.forEach((row, r) => {
      const rw = row.reduce((s, it) => s + width(it), 0) + sep * 2 * (row.length - 1);
      bw = Math.max(bw, rw);
      let x = cx - rw / 2; const y = top + lineH * (r + 0.5);
      row.forEach((it, i) => {
        if (i) {
          if (o.lines) { c.fillRect(x + sep - fs * 0.04, y - fs * 0.8, fs * 0.08, fs * 1.6); }
          x += sep * 2;
        }
        c.save(); ICONS[it.k](c, x + icon / 2, y, icon); c.restore();
        c.fillStyle = col; c.font = font; c.textBaseline = 'middle';
        c.fillText(it.text, x + icon + gap, y + fs * 0.04);
        x += width(it);
      });
    });
    c.restore();
    return { x: cx - bw / 2 - fs * 0.45, y: top - fs * 0.27, w: bw + fs * 0.9, h: rows.length * lineH + fs * 0.54 };
  }

  // ---------- files out ----------
  function descargar(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // phones: share straight to WhatsApp & co.
  const puedeCompartir = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })); } catch { return false; } };
  async function compartir(blob, name) {
    try { await navigator.share({ files: [new File([blob], name, { type: blob.type })] }); } catch { }
  }
  const nombreArchivo = t => String(t || '').trim().replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, '').replace(/\s+/g, '-');

  // canvas PNGs carry no physical size; print programs then open them at 72/96 dpi.
  // This writes the resolution into the file (pHYs chunk) so it opens at real size.
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  async function pngConDpi(blob, dpi) {
    const src = new Uint8Array(await blob.arrayBuffer());
    const ppm = Math.round(dpi / 0.0254), ch = new Uint8Array(21), dv = new DataView(ch.buffer);
    dv.setUint32(0, 9); ch.set([112, 72, 89, 115], 4);   // length, "pHYs"
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); ch[16] = 1;   // pixels per metre
    let crc = 0xffffffff;
    for (let i = 4; i < 17; i++) crc = CRC[(crc ^ ch[i]) & 255] ^ (crc >>> 8);
    dv.setUint32(17, (crc ^ 0xffffffff) >>> 0);
    const out = new Uint8Array(src.length + 21);   // right after the 8-byte signature + 25-byte IHDR
    out.set(src.subarray(0, 33)); out.set(ch, 33); out.set(src.subarray(33), 54);
    return new Blob([out], { type: 'image/png' });
  }

  // ---------- shell: header + clients → versions → editor ----------
  // cfg = { nombre, id, db, sufijo, hooks }
  //   hooks.nuevo()            start a blank design in the editor
  //   hooks.abrir(diseno)      rebuild a saved design
  //   hooks.guardar()          → { estado, imgIds, etiqueta, thumb }  (the editor stores its own images in 'logos')
  //   hooks.sucio() / hooks.limpio()   unsaved changes?
  //   hooks.alEditor()         the editor just became visible
  //   hooks.respaldo() / hooks.restaurar(extra)   app-specific data for the backup file
  //   hooks.deshacer() / hooks.rehacer()   optional: shows the undo / redo arrows; report with app.historial(canUndo, canRedo)
  function shell(cfg) {
    const H = cfg.hooks, db = cfg.db;
    const app = { cliente: null, diseno: null, n: null, db };
    document.body.insertAdjacentHTML('afterbegin', `
<header>
  <button class="btn hidden" id="toClients">‹ Clientes</button>
  <h1 id="title">${esc(cfg.nombre)}</h1>
  <button class="btn hidden" id="undoBtn" title="Deshacer (Ctrl + Z)" aria-label="Deshacer">↶</button>
  <button class="btn hidden" id="redoBtn" title="Rehacer (Ctrl + Y)" aria-label="Rehacer">↷</button>
  <button class="btn primary hidden" id="saveVersion">Guardar versión</button>
</header>
<section class="view" id="clientsView">
  <div class="view-in">
    <div class="view-head">
      <h2 class="big">Mis clientes</h2>
      <button class="btn primary" id="newClient">+ Nuevo cliente</button>
    </div>
    <button class="quick" id="quickTry">
      <span class="qi"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#111"/></svg></span>
      <span><b>Probar sin cliente</b><small>Diseña rápido, sin guardar nada</small></span>
      <span class="qa">›</span>
    </button>
    <input type="search" id="clientSearch" placeholder="Buscar cliente…">
    <div class="clist" id="clientList"></div>
    <div class="view-foot">
      <button class="link" id="backupBtn">Respaldar</button> ·
      <label class="link">Restaurar<input type="file" id="restoreFile" accept=".json,application/json" class="hidden"></label>
      <div class="note">Los clientes y diseños se guardan en este teléfono. Usa “Respaldar” para pasarlos a otro teléfono o a tu socio.</div>
      <div class="note" id="storageInfo"></div>
    </div>
  </div>
</section>
<section class="view" id="clientView">
  <div class="view-in">
    <button class="link" id="backToClients">‹ Mis clientes</button>
    <div class="view-head">
      <h2 class="big" id="clientName"></h2>
      <button class="btn primary" id="newDesign">+ Nuevo diseño</button>
    </div>
    <div class="note" style="margin-bottom:14px"><button class="link" id="renameClient">Cambiar nombre</button> · <button class="link" id="deleteClient">Eliminar cliente</button></div>
    <div class="vlist" id="versionList"></div>
  </div>
</section>
<div class="toast" id="toast"></div>`);

    const designsOf = async cid => (await db.all('disenos')).filter(d => d.clienteId === cid);
    const imgsOf = d => [...(d.imgIds || []), d.logoId].filter(Boolean);

    function showView(v) {
      document.body.dataset.view = v;
      updateHeader();
      window.scrollTo(0, 0);
      if (v === 'editor' && H.alEditor) H.alEditor();
    }
    function updateHeader() {
      const ed = document.body.dataset.view === 'editor';
      $('toClients').classList.toggle('hidden', !ed);
      $('saveVersion').classList.toggle('hidden', !ed || !app.cliente);
      $('undoBtn').classList.toggle('hidden', !ed || !H.deshacer);
      $('redoBtn').classList.toggle('hidden', !ed || !H.deshacer);
      $('toClients').textContent = '‹ ' + (app.cliente ? app.cliente.nombre : 'Clientes');
      $('title').textContent = !ed ? cfg.nombre
        : app.cliente ? (app.diseno ? `${app.diseno.nombre} · v${app.n}` : 'Nuevo diseño') : 'Prueba rápida';
    }

    // images are stored once and shared by versions: drop the ones no version uses anymore
    async function pruneImages() {
      const used = new Set((await db.all('disenos')).flatMap(imgsOf));
      const orphans = (await db.all('logos')).filter(l => !used.has(l.id));
      if (orphans.length) await db.run('logos', 'readwrite', st => orphans.forEach(l => st.delete(l.id)));
    }
    async function showStorage() {
      if (!navigator.storage || !navigator.storage.estimate) return;
      try {
        const { usage } = await navigator.storage.estimate();
        const mb = usage / 1048576;
        $('storageInfo').textContent = 'Espacio usado por la app en este teléfono: '
          + (mb < 0.1 ? 'menos de 0,1 MB' : mb.toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' MB');
      } catch { }
    }

    async function renderClients() {
      showStorage();
      const q = $('clientSearch').value.trim().toLowerCase();
      const designs = await db.all('disenos');
      const clients = (await db.all('clientes'))
        .filter(c => c.nombre.toLowerCase().includes(q))
        .sort((a, b) => (b.actualizado || 0) - (a.actualizado || 0));
      const box = $('clientList'); box.innerHTML = '';
      if (!clients.length) {
        box.innerHTML = `<div class="empty">${q ? 'No hay clientes con ese nombre.' : 'Aún no tienes clientes. Crea el primero con “+ Nuevo cliente”.'}</div>`;
        return;
      }
      clients.forEach(c => {
        const ds = designs.filter(d => d.clienteId === c.id).sort((a, b) => b.n - a.n);
        const b = document.createElement('button'); b.className = 'ccard';
        b.innerHTML = (ds[0] ? `<img class="thumb" src="${ds[0].thumb}" alt="">` : '<div class="thumb"></div>')
          + `<div><b>${esc(c.nombre)}</b><div class="meta">${ds.length ? (n => `${n} ${n === 1 ? 'diseño' : 'diseños'}`)(new Set(ds.map(groupKey)).size) + ` · ${fmtDate(c.actualizado)}` : 'Sin diseños aún'}</div></div>`;
        b.onclick = () => openClient(c.id);
        box.append(b);
      });
    }

    async function openClient(id) {
      const c = (await db.all('clientes')).find(x => x.id === id);
      if (!c) { app.cliente = null; showView('clients'); renderClients(); return; }
      app.cliente = { id: c.id, nombre: c.nombre };
      await renderVersions();
      showView('client');
    }

    // one card per design (named by the user); its saved versions live inside, in a drop-down
    const groupKey = d => d.disenoId || d.id;
    const designName = d => d.nombre || d.etiqueta || 'Diseño';
    async function renderVersions() {
      $('clientName').textContent = app.cliente.nombre;
      const groups = new Map();
      (await designsOf(app.cliente.id)).forEach(d => { const k = groupKey(d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); });
      const list = [...groups.values()].map(vs => vs.sort((a, b) => b.n - a.n)).sort((a, b) => b[0].fecha - a[0].fecha);
      const box = $('versionList'); box.innerHTML = '';
      if (!list.length) { box.innerHTML = '<div class="empty">Todavía no hay diseños para este cliente. Toca “+ Nuevo diseño”.</div>'; return; }
      list.forEach(vs => {
        const name = designName(vs[0]), el = document.createElement('div'); el.className = 'vcard';
        el.innerHTML = `<img class="thumb" alt=""><button class="dname" title="Toca para cambiar el nombre"></button><div class="meta"></div><div class="nota"></div>
          <select class="vsel" title="Versiones guardadas de este diseño"></select><button class="link vdel">Eliminar esta versión</button>
          <div class="btns"><button class="btn primary">Abrir</button><button class="btn">Eliminar</button></div>`;
        const img = el.querySelector('img'), title = el.querySelector('.dname'), meta = el.querySelector('.meta'), nota = el.querySelector('.nota');
        const sel = el.querySelector('.vsel'), vdel = el.querySelector('.vdel'), [open, del] = el.querySelectorAll('.btns button');
        title.textContent = name;
        vs.forEach(d => sel.add(new Option(`Versión ${d.n}${d.nota ? ' · ' + d.nota : ''} · ${fmtDate(d.fecha)}`, d.id)));
        sel.classList.toggle('hidden', vs.length < 2); vdel.classList.toggle('hidden', vs.length < 2);
        const cur = () => vs.find(d => d.id === sel.value) || vs[0];
        const show = () => {
          const d = cur(), et = d.etiqueta;
          img.src = d.thumb; meta.textContent = `Versión ${d.n}${vs.length > 1 ? ' de ' + vs.length : ''} · ${fmtDate(d.fecha)}${et ? ' · ' + et : ''}`;
          nota.textContent = d.nota ? `“${d.nota}”` : ''; nota.classList.toggle('hidden', !d.nota);
        };
        sel.onchange = show; show();
        open.onclick = img.onclick = () => openDesign(cur());
        title.onclick = async () => {
          const nuevo = (prompt('Nombre de este diseño:', name) || '').trim(); if (!nuevo || nuevo === name) return;
          await db.run('disenos', 'readwrite', st => vs.forEach(d => st.put({ ...d, nombre: nuevo })));
          renderVersions();
        };
        del.onclick = async () => {
          if (!confirm(`¿Eliminar “${name}”${vs.length > 1 ? ` con sus ${vs.length} versiones` : ''}? No se puede deshacer.`)) return;
          await db.run('disenos', 'readwrite', st => vs.forEach(d => st.delete(d.id)));
          await pruneImages(); renderVersions(); toast(`“${name}” eliminado`);
        };
        vdel.onclick = async () => {
          const d = cur();
          if (!confirm(`¿Eliminar solo la versión ${d.n} de “${name}”?`)) return;
          await db.run('disenos', 'readwrite', st => st.delete(d.id));
          await pruneImages(); renderVersions(); toast(`Versión ${d.n} eliminada`);
        };
        box.append(el);
      });
    }

    async function newDesign() {
      app.n = null; app.diseno = null;
      showView('editor');
      await H.nuevo();
      H.limpio(); updateHeader();
    }
    async function openDesign(d) {
      showView('editor');
      await H.abrir(d);
      app.n = d.n; app.diseno = { id: groupKey(d), nombre: designName(d) };
      H.limpio(); updateHeader();
    }

    $('saveVersion').onclick = async () => {
      if (!app.cliente) return;
      try {
        const g = await H.guardar();
        // a new design asks for its name; saving it again adds a version inside the same design
        let nombre, nota = '';
        if (!app.diseno) {
          nombre = prompt('Nombre de este diseño (para reconocerlo después):', g.etiqueta || 'Mi diseño');
          if (nombre === null) return;
          nombre = nombre.trim() || g.etiqueta || 'Mi diseño';
        } else {
          nombre = app.diseno.nombre;
          nota = prompt(`Nueva versión de “${nombre}”. ¿Qué cambió? (opcional)`, '');
          if (nota === null) return;
        }
        const disenoId = app.diseno ? app.diseno.id : newId();
        const n = (await designsOf(app.cliente.id)).filter(d => groupKey(d) === disenoId).reduce((m, d) => Math.max(m, d.n), 0) + 1;
        await db.run('disenos', 'readwrite', st => st.put({
          id: newId(), clienteId: app.cliente.id, disenoId, nombre, n, nota: nota.trim(), fecha: Date.now(), thumb: g.thumb,
          estado: g.estado, imgIds: g.imgIds || [], etiqueta: g.etiqueta || '',
        }));
        app.diseno = { id: disenoId, nombre };
        const c = (await db.all('clientes')).find(x => x.id === app.cliente.id);
        if (c) { c.actualizado = Date.now(); await db.run('clientes', 'readwrite', st => st.put(c)); }
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
        app.n = n; H.limpio(); updateHeader();
        toast(`Guardado: ${nombre} · versión ${n}`);
      } catch (err) { alert('No se pudo guardar: ' + err.message); }
    };

    // undo / redo: arrows in the header (phone) and Ctrl+Z / Ctrl+Y (PC). The editor keeps the history.
    $('undoBtn').onclick = () => H.deshacer && H.deshacer();
    $('redoBtn').onclick = () => H.rehacer && H.rehacer();
    document.addEventListener('keydown', e => {
      if (!H.deshacer || document.body.dataset.view !== 'editor' || !(e.ctrlKey || e.metaKey)) return;
      // while typing, Ctrl+Z belongs to the text field
      if (e.target.matches && e.target.matches('textarea, input[type=text], input[type=search], input:not([type])')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); H.deshacer(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); H.rehacer(); }
    });
    app.historial = (canUndo, canRedo) => { $('undoBtn').disabled = !canUndo; $('redoBtn').disabled = !canRedo; };

    $('toClients').onclick = async () => {
      if (H.sucio() && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
      if (app.cliente) openClient(app.cliente.id); else { showView('clients'); renderClients(); }
    };
    $('backToClients').onclick = () => { app.cliente = null; showView('clients'); renderClients(); };
    $('clientSearch').oninput = () => renderClients();
    $('newClient').onclick = async () => {
      const nombre = (prompt('Nombre del cliente (ej. Pepemarket):', '') || '').trim();
      if (!nombre) return;
      const existing = (await db.all('clientes')).find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      if (existing) { openClient(existing.id); return; }
      const c = { id: newId(), nombre, creado: Date.now(), actualizado: Date.now() };
      try { await db.run('clientes', 'readwrite', st => st.put(c)); } catch (err) { alert('No se pudo crear el cliente: ' + err.message); return; }
      $('clientSearch').value = '';
      openClient(c.id);
    };
    $('newDesign').onclick = () => newDesign();
    $('quickTry').onclick = () => { app.cliente = null; newDesign(); };
    $('renameClient').onclick = async () => {
      const c = (await db.all('clientes')).find(x => x.id === app.cliente.id); if (!c) return;
      const nombre = (prompt('Nuevo nombre del cliente:', c.nombre) || '').trim(); if (!nombre) return;
      c.nombre = nombre; await db.run('clientes', 'readwrite', st => st.put(c));
      app.cliente.nombre = nombre; renderVersions();
    };
    $('deleteClient').onclick = async () => {
      const ds = await designsOf(app.cliente.id), nombre = app.cliente.nombre;
      if (!confirm(`¿Eliminar a ${nombre}${ds.length ? ` y sus ${ds.length} versiones` : ''}? No se puede deshacer.`)) return;
      await db.run('disenos', 'readwrite', st => ds.forEach(d => st.delete(d.id)));
      await db.run('clientes', 'readwrite', st => st.delete(app.cliente.id));
      await pruneImages();
      toast(`${nombre} eliminado`);
      app.cliente = null; showView('clients'); renderClients();
    };

    // ---------- backup: move everything to another phone / share with your partner ----------
    $('backupBtn').onclick = async () => {
      const data = {
        app: cfg.id, formato: 1, fecha: new Date().toISOString(),
        clientes: await db.all('clientes'), disenos: await db.all('disenos'), logos: await db.all('logos'), modelos: await db.all('modelos'),
        extra: H.respaldo ? H.respaldo() : {},
      };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const name = `respaldo-${cfg.sufijo}-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Respaldo ' + cfg.nombre }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      descargar(blob, name);
    };
    $('restoreFile').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      let data;
      try { data = JSON.parse(await f.text()); } catch { alert('Ese archivo no es un respaldo válido.'); return; }
      if (data.app !== cfg.id) { alert('Ese archivo no es un respaldo de esta app.'); return; }
      if (!confirm(`Restaurar ${(data.clientes || []).length} clientes y ${(data.disenos || []).length} versiones? Lo que ya tienes se mantiene.`)) return;
      try {
        for (const store of ['clientes', 'disenos', 'logos', 'modelos']) {
          const list = data[store] || [];
          if (list.length) await db.run(store, 'readwrite', st => list.forEach(r => st.put(r)));
        }
        if (H.restaurar) H.restaurar(data.extra || {});
        alert('Respaldo restaurado.');
        location.reload();
      } catch (err) { alert('No se pudo restaurar: ' + err.message); }
    };

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }

    app.mostrar = showView; app.cabecera = updateHeader;
    app.iniciar = () => { showView('clients'); renderClients(); };
    return app;
  }

  return {
    $, clamp, newCanvas, hexToRgb, toHex, d2rgb, lumRGB, roundRect, esc, newId, fmtDate, imgFrom, loadImage, toast,
    openDB, fondoUniforme, limpiarImagen, vectorizar, capasVector, ROLE_NAMES, CONTACT_KEYS, CONTACT_LABELS, dibujarContacto,
    descargar, puedeCompartir, compartir, nombreArchivo, pngConDpi, shell,
  };
})();
