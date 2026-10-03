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
  function extractPalette(p, f, bg) {
    const pts = [], step = Math.max(1, Math.floor(f.length / 40000));
    for (let k = 0; k < f.length; k += step) if (f[k] > 0.7) { const i = k * 4; pts.push([p[i], p[i + 1], p[i + 2]]); }
    if (!pts.length) return [];
    // farthest-point seeds, then k-means
    let cs = [pts.reduce((m, c) => lumRGB(c) < lumRGB(m) ? c : m, pts[0])];
    while (cs.length < 6) {
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
    // merge near-duplicates (JPEG noise, antialiasing) and drop specks
    let pal = cs.map((rgb, j) => ({ rgb, share: counts[j] / pts.length })).filter(c => c.share > 0);
    for (let merged = true; merged;) {
      merged = false;
      outer: for (let a = 0; a < pal.length; a++) for (let b = a + 1; b < pal.length; b++) {
        if (d2rgb(pal[a].rgb, pal[b].rgb) < 45 * 45) {
          const t = pal[a].share + pal[b].share;
          pal[a] = { rgb: pal[a].rgb.map((v, i) => (v * pal[a].share + pal[b].rgb[i] * pal[b].share) / t), share: t };
          pal.splice(b, 1); merged = true; break outer;
        }
      }
    }
    pal = pal.filter(c => c.share >= 0.015).sort((a, b) => b.share - a.share);
    const segDist = (c, a, b) => {
      const ab = [0, 1, 2].map(i => b[i] - a[i]), ac = [0, 1, 2].map(i => c[i] - a[i]);
      const t = clamp((ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2]) / (d2rgb(a, b) || 1), 0, 1);
      return Math.sqrt(d2rgb(c, a.map((v, i) => v + ab[i] * t)));
    };
    // a "colour" lying between two real ones (or between a real one and the removed background)
    // is just the soft edge where they meet
    const anchors = bg ? [...pal, { rgb: bg, share: 1 }] : pal;
    pal = pal.filter(c => !(c.share < 0.12 && anchors.some(a => a !== c && a.share > c.share &&
      anchors.some(b => b !== c && b !== a && b.share > c.share && segDist(c.rgb, a.rgb, b.rgb) < 28))));
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
  // o = { mode: 'color' | 'ink' | 'ink2', thr, removeBg, invert, ink, ink2, ink2Auto, palette, paletteDirty, fondo: [r,g,b], max: longest side in px }
  // o.palette is filled in here. With sep = 'ink' | 'ink2' | 'trama' it returns that ink alone
  // as a solid mask with the same size/crop (used for layered print files).
  function limpiarImagen(img, o, sep) {
    let w = img.naturalWidth || img.width || 1000, h = img.naturalHeight || img.height || 1000;
    // cap huge images, upscale tiny ones (e.g. small SVGs) so they stay crisp
    const max = Math.max(w, h), cap = o.max || 1600, kk = max > cap ? cap / max : max < 600 ? 600 / max : 1;
    w = Math.round(w * kk); h = Math.round(h * kk);
    const c = newCanvas(w, h), x = c.getContext('2d');
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

    if (o.mode !== 'color') {
      if (o.paletteDirty || !o.palette) {
        // keep the user's choices for colours that are still there after re-cleaning
        const old = o.palette || [], pal = extractPalette(p, f, bgInfo.transparent ? null : bgInfo.rgb);
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
      for (let k = 0, i = 0; k < n; k++, i += 4) {
        let a = 0, col = ink1;
        if (f[k] > 0.01 && pal.length) {
          let bi = 0, bd = Infinity;
          for (let j = 0; j < pal.length; j++) {
            const q = pal[j].rgb, dd = (p[i] - q[0]) ** 2 + (p[i + 1] - q[1]) ** 2 + (p[i + 2] - q[2]) ** 2;
            if (dd < bd) { bd = dd; bi = j; }
          }
          const role = pal[bi][roleKey], xx = k % w;
          if (sep) a = role === sep ? f[k] : 0;
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
    return out;
  }
  const ROLE_NAMES = { ink: 'Tinta', trama: 'Trama', paper: 'Papel', ink2: 'Tinta 2' };

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
    const app = { cliente: null, n: null, db };
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
        : app.cliente ? (app.n ? `Versión ${app.n}` : 'Nuevo diseño') : 'Prueba rápida';
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
          + `<div><b>${esc(c.nombre)}</b><div class="meta">${ds.length ? `${ds.length} ${ds.length === 1 ? 'versión' : 'versiones'} · ${fmtDate(c.actualizado)}` : 'Sin diseños aún'}</div></div>`;
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

    async function renderVersions() {
      $('clientName').textContent = app.cliente.nombre;
      const ds = (await designsOf(app.cliente.id)).sort((a, b) => b.n - a.n);
      const box = $('versionList'); box.innerHTML = '';
      if (!ds.length) { box.innerHTML = '<div class="empty">Todavía no hay diseños para este cliente. Toca “+ Nuevo diseño”.</div>'; return; }
      ds.forEach(d => {
        const el = document.createElement('div'); el.className = 'vcard';
        el.innerHTML = `<img class="thumb" src="${d.thumb}" alt="">
          <b>Versión ${d.n}</b><div class="meta">${fmtDate(d.fecha)}${d.etiqueta ? ' · ' + esc(d.etiqueta) : ''}</div>
          ${d.nota ? `<div class="nota">“${esc(d.nota)}”</div>` : ''}
          <div class="btns"><button class="btn primary">Abrir</button><button class="btn">Eliminar</button></div>`;
        const [open, del] = el.querySelectorAll('button');
        open.onclick = el.querySelector('img').onclick = () => openDesign(d);
        del.onclick = async () => {
          if (!confirm(`¿Eliminar la versión ${d.n} de ${app.cliente.nombre}?`)) return;
          await db.run('disenos', 'readwrite', st => st.delete(d.id));
          await pruneImages();
          renderVersions();
          toast(`Versión ${d.n} eliminada`);
        };
        box.append(el);
      });
    }

    async function newDesign() {
      app.n = null;
      showView('editor');
      await H.nuevo();
      H.limpio(); updateHeader();
    }
    async function openDesign(d) {
      showView('editor');
      await H.abrir(d);
      app.n = d.n;
      H.limpio(); updateHeader();
    }

    $('saveVersion').onclick = async () => {
      if (!app.cliente) return;
      const nota = prompt('¿Qué cambió en esta versión? (opcional)', '');
      if (nota === null) return;
      try {
        const g = await H.guardar();
        const n = (await designsOf(app.cliente.id)).reduce((m, d) => Math.max(m, d.n), 0) + 1;
        await db.run('disenos', 'readwrite', st => st.put({
          id: newId(), clienteId: app.cliente.id, n, nota: nota.trim(), fecha: Date.now(), thumb: g.thumb,
          estado: g.estado, imgIds: g.imgIds || [], etiqueta: g.etiqueta || '',
        }));
        const c = (await db.all('clientes')).find(x => x.id === app.cliente.id);
        if (c) { c.actualizado = Date.now(); await db.run('clientes', 'readwrite', st => st.put(c)); }
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
        app.n = n; H.limpio(); updateHeader();
        toast(`Guardado como versión ${n} de ${app.cliente.nombre}`);
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
    openDB, fondoUniforme, limpiarImagen, ROLE_NAMES, CONTACT_KEYS, CONTACT_LABELS, dibujarContacto,
    descargar, puedeCompartir, compartir, nombreArchivo, pngConDpi, shell,
  };
})();
