using System.Security.Cryptography;
using PdfSharp.Pdf;
using PdfSharp.Pdf.Advanced;
using PdfSharp.Pdf.Content;
using PdfSharp.Pdf.Content.Objects;
using PdfSharp.Pdf.Filters;
using PdfSharp.Pdf.IO;

namespace FirmarPdf.Motor;

/// <summary>La contraseña indicada no abre el PDF.</summary>
public sealed class ContrasenaIncorrectaException : Exception
{
    public ContrasenaIncorrectaException() : base(Textos.T("pdf.claveIncorrecta")) { }
}

/// <summary>El archivo no es un PDF válido o está dañado.</summary>
public sealed class PdfDanadoException : Exception
{
    public PdfDanadoException(string mensaje, Exception? inner = null) : base(mensaje, inner) { }
}

/// <summary>El PDF ya tiene contraseña de apertura.</summary>
public sealed class YaProtegidoException : Exception
{
    public YaProtegidoException() : base(Textos.T("pdf.yaProtegido")) { }
}

/// <summary>Lo que contiene un PDF y se perdería al quitar contraseña o comprimir.</summary>
public sealed record InfoPdf(bool TieneFormularios, bool TieneMarcadores, bool TieneFirmaDigital, bool RequiereContrasena, int Paginas);

public enum NivelCompresion { Ligera, Media }

public sealed record ResultadoCompresion(byte[] Datos, long Antes, long Despues, int ImagenesRecomprimidas);

/// <summary>Comprimir y proteger PDF. Todo sobre byte[]; sin interfaz.</summary>
public static class OperacionesPdf
{
    static string MensajeDanado => Textos.T("pdf.noEsPdf");

    // ───────────── Contraseña ─────────────

    /// <summary>true si el PDF pide contraseña para abrirse.</summary>
    public static bool RequiereContrasena(byte[] pdf)
    {
        try
        {
            using var ms = new MemoryStream(pdf);
            // Si pide clave, el proveedor se llama; no se la damos.
            using var doc = PdfReader.Open(ms, PdfDocumentOpenMode.Import, a => { a.Abort = true; });
            return doc == null; // Abort devuelve null cuando hacía falta clave
        }
        catch (PdfReaderException ex) when (EsDeClave(ex)) { return true; }
        catch (Exception ex) { throw new PdfDanadoException(MensajeDanado, ex); }
    }

    /// <summary>Cifra con AES-256 (PDF 2.0). Clave de apertura = contrasena; clave de propietario aleatoria.</summary>
    public static byte[] Proteger(byte[] pdf, string contrasena)
    {
        if (string.IsNullOrEmpty(contrasena)) throw new ArgumentException(Textos.T("pdf.pideClave"));
        if (RequiereContrasena(pdf)) throw new YaProtegidoException();
        using var doc = Abrir(pdf, null, PdfDocumentOpenMode.Modify);
        var seg = doc.SecuritySettings;
        doc.SecurityHandler.SetEncryptionToV5(true); // AES-256
        seg.UserPassword = contrasena;
        seg.OwnerPassword = ClaveAleatoria();
        seg.PermitPrint = true;
        seg.PermitFullQualityPrint = true;
        seg.PermitExtractContent = true;
        return Guardar(doc);
    }

    /// <summary>Abre con la contraseña y guarda sin cifrado.</summary>
    public static byte[] QuitarContrasena(byte[] pdf, string contrasena)
    {
        using var doc = Abrir(pdf, contrasena, PdfDocumentOpenMode.Modify);
        doc.SecurityHandler.SetEncryptionToNoneAndResetPasswords();
        return Guardar(doc);
    }

    // ───────────── Análisis y limpieza ─────────────

    /// <summary>Inspecciona el PDF sin modificarlo. Si pide contraseña solo informa eso (no puede leer el resto).</summary>
    public static InfoPdf Analizar(byte[] pdf)
    {
        if (RequiereContrasena(pdf)) return new InfoPdf(false, false, false, true, 0);
        try
        {
            using var ms = new MemoryStream(pdf);
            using var doc = PdfReader.Open(ms, PdfDocumentOpenMode.Import);
            var cat = doc.Internals.Catalog;
            bool formularios = false, firma = false;
            var acro = cat.Elements.GetDictionary("/AcroForm");
            if (acro != null)
            {
                var campos = acro.Elements.GetArray("/Fields");
                formularios = campos != null && campos.Elements.Count > 0;
                if (campos != null) firma = HayFirma(campos, null, 0, new HashSet<PdfDictionary>());
            }
            var marcadores = cat.Elements.GetDictionary("/Outlines");
            bool tieneMarcadores = marcadores != null && marcadores.Elements.ContainsKey("/First");
            return new InfoPdf(formularios, tieneMarcadores, firma, false, doc.PageCount);
        }
        catch (Exception ex) { throw new PdfDanadoException(MensajeDanado, ex); }
    }

    static bool HayFirma(PdfArray campos, string? ftHeredado, int nivel, HashSet<PdfDictionary> vistos)
    {
        if (nivel > 32) return false;
        foreach (var item in campos.Elements)
        {
            var it = item is PdfReference r ? r.Value : item;
            if (it is not PdfDictionary campo || !vistos.Add(campo)) continue;
            var ft = campo.Elements.GetName("/FT");
            if (string.IsNullOrEmpty(ft)) ft = ftHeredado;
            var v = campo.Elements["/V"];
            if (ft == "/Sig" && v != null && v is not PdfNull) return true;
            var hijos = campo.Elements.GetArray("/Kids");
            if (hijos != null && HayFirma(hijos, ft, nivel + 1, vistos)) return true;
        }
        return false;
    }

    /// <summary>Abre con PDFsharp y vuelve a guardar: solo se escriben los objetos alcanzables.</summary>
    public static byte[] Limpiar(byte[] pdf)
    {
        using var doc = Abrir(pdf, null, PdfDocumentOpenMode.Modify);
        return Guardar(doc);
    }

    static string ClaveAleatoria()
    {
        const string abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        var s = new char[32];
        for (int i = 0; i < s.Length; i++) s[i] = abc[RandomNumberGenerator.GetInt32(abc.Length)];
        return new string(s);
    }

    static bool EsDeClave(Exception ex)
    {
        var m = ex.Message.ToLowerInvariant();
        return m.Contains("password") || m.Contains("encrypt");
    }

    /// <summary>
    /// Abre un PDF para modificarlo. PDFsharp exige la clave de propietario para modificar un PDF cifrado;
    /// si solo tenemos la de apertura, se abre para lectura y se copian las páginas a un documento nuevo.
    /// </summary>
    static PdfDocument Abrir(byte[] pdf, string? clave, PdfDocumentOpenMode modo)
    {
        try
        {
            var doc = Leer(pdf, clave, modo);
            if (doc != null) return doc;
            if (modo == PdfDocumentOpenMode.Modify)
            {
                using var lectura = Leer(pdf, clave, PdfDocumentOpenMode.Import);
                if (lectura != null) return Copiar(lectura);
            }
            throw new ContrasenaIncorrectaException();
        }
        catch (ContrasenaIncorrectaException) { throw; }
        catch (PdfReaderException ex) when (EsDeClave(ex)) { throw new ContrasenaIncorrectaException(); }
        catch (Exception ex) { throw new PdfDanadoException(MensajeDanado, ex); }
    }

    static PdfDocument? Leer(byte[] pdf, string? clave, PdfDocumentOpenMode modo)
    {
        var ms = new MemoryStream(pdf);
        bool probada = false;
        try
        {
            return PdfReader.Open(ms, modo, a =>
            {
                // PDFsharp repite la pregunta mientras la clave falle: solo se intenta una vez.
                if (clave is null || probada) a.Abort = true; else { probada = true; a.Password = clave; }
            });
        }
        catch (PdfReaderException ex) when (EsDeClave(ex)) { return null; }
    }

    static PdfDocument Copiar(PdfDocument origen)
    {
        var nuevo = new PdfDocument();
        nuevo.Info.Title = origen.Info.Title;
        nuevo.Info.Author = origen.Info.Author;
        nuevo.Info.Subject = origen.Info.Subject;
        nuevo.Info.Keywords = origen.Info.Keywords;
        foreach (var pagina in origen.Pages) nuevo.AddPage(pagina);
        return nuevo;
    }

    static byte[] Guardar(PdfDocument doc)
    {
        try
        {
            using var salida = new MemoryStream();
            doc.Save(salida, false);
            return salida.ToArray();
        }
        catch (Exception ex) { throw new PdfDanadoException(MensajeDanado, ex); }
    }

    // ───────────── Compresión ─────────────

    public static ResultadoCompresion Comprimir(byte[] pdf, NivelCompresion nivel, IPlataforma plataforma)
    {
        int maxDpi = nivel == NivelCompresion.Ligera ? 200 : 150;
        long calidad = nivel == NivelCompresion.Ligera ? 80 : 65;
        using var doc = Abrir(pdf, null, PdfDocumentOpenMode.Modify);
        int hechas = 0;
        try
        {
            var usos = MedirUsos(doc);
            var vistos = new HashSet<int>();
            foreach (var page in doc.Pages)
                foreach (var (dict, _) in ImagenesDe(page.Resources))
                {
                    int id = dict.Reference?.ObjectNumber ?? 0;
                    if (id != 0 && !vistos.Add(id)) continue;
                    try
                    {
                        usos.TryGetValue(id, out var ancho);
                        double pts = ancho > 0 ? ancho : Math.Max(page.Width.Point, page.Height.Point);
                        if (RecomprimirImagen(dict, pts, maxDpi, calidad, plataforma)) hechas++;
                    }
                    catch { /* imagen rara: se deja como está */ }
                }
        }
        catch { /* si algo falla al recorrer, se guarda igual con la compresión de flujos */ }

        doc.Options.CompressContentStreams = true;
        doc.Options.NoCompression = false;
        doc.Options.FlateEncodeMode = PdfFlateEncodeMode.BestCompression;
        doc.Options.UseFlateDecoderForJpegImages = PdfUseFlateDecoderForJpegImages.Never;
        byte[] datos = Guardar(doc); // PDFsharp solo escribe los objetos alcanzables: los no usados desaparecen
        return datos.Length < pdf.Length
            ? new ResultadoCompresion(datos, pdf.Length, datos.Length, hechas)
            : new ResultadoCompresion(pdf, pdf.Length, pdf.Length, 0);
    }

    static IEnumerable<(PdfDictionary dict, string nombre)> ImagenesDe(PdfDictionary? recursos)
    {
        var xo = recursos?.Elements.GetDictionary("/XObject");
        if (xo == null) yield break;
        foreach (var k in xo.Elements.Keys)
        {
            PdfDictionary? d = xo.Elements.GetDictionary(k);
            if (d != null && d.Elements.GetName("/Subtype") == "/Image" && d.Stream != null)
                yield return (d, k);
        }
    }

    /// <summary>Mayor ancho (en puntos) con que se dibuja cada imagen, leyendo el contenido de las páginas.</summary>
    static Dictionary<int, double> MedirUsos(PdfDocument doc)
    {
        var res = new Dictionary<int, double>();
        foreach (var page in doc.Pages)
        {
            try
            {
                var imgs = ImagenesDe(page.Resources).ToDictionary(t => t.nombre, t => t.dict.Reference?.ObjectNumber ?? 0);
                var pila = new Stack<double[]>();
                double[] m = { 1, 0, 0, 1, 0, 0 };
                foreach (var obj in ContentReader.ReadContent(page))
                {
                    if (obj is not COperator op) continue;
                    switch (op.OpCode.Name)
                    {
                        case "q": pila.Push((double[])m.Clone()); break;
                        case "Q": if (pila.Count > 0) m = pila.Pop(); break;
                        case "cm" when op.Operands.Count == 6:
                            m = Mult(op.Operands.Select(Num).ToArray(), m); break;
                        case "Do" when op.Operands.Count == 1 && op.Operands[0] is CName nom && imgs.TryGetValue(nom.Name, out int id) && id != 0:
                            double w = Math.Max(Math.Sqrt(m[0] * m[0] + m[1] * m[1]), Math.Sqrt(m[2] * m[2] + m[3] * m[3]));
                            if (!res.TryGetValue(id, out var prev) || w > prev) res[id] = w;
                            break;
                    }
                }
            }
            catch { /* esta página usará su propio tamaño */ }
        }
        return res;
    }

    static double Num(CObject o) => o switch { CInteger i => i.Value, CReal r => r.Value, _ => 0 };

    static double[] Mult(double[] n, double[] c) => new[]
    {
        n[0]*c[0]+n[1]*c[2], n[0]*c[1]+n[1]*c[3],
        n[2]*c[0]+n[3]*c[2], n[2]*c[1]+n[3]*c[3],
        n[4]*c[0]+n[5]*c[2]+c[4], n[4]*c[1]+n[5]*c[3]+c[5],
    };

    static bool RecomprimirImagen(PdfDictionary d, double anchoPuntos, int maxDpi, long calidad, IPlataforma plataforma)
    {
        var e = d.Elements;
        if (e.GetBoolean("/ImageMask") || e.ContainsKey("/Mask") || e.ContainsKey("/Decode")) return false;
        int w = e.GetInteger("/Width"), h = e.GetInteger("/Height");
        if (w < 16 || h < 16) return false;
        string filtro = FiltroUnico(d);
        if (filtro is not ("/DCTDecode" or "/FlateDecode")) return false; // CCITT, JBIG2, JPX, LZW: no se tocan
        int comps = Componentes(d);
        if (comps is not (1 or 3)) return false; // CMYK, Indexed, Separation: se saltan
        // /SMask (transparencia) se conserva tal cual: es un objeto aparte con su propio tamaño.

        // Topes contra bombas de descompresión (aritmética long)
        long pixeles = (long)w * h;
        if (pixeles > MaxPixeles || pixeles * comps > MaxBytesImagen) return false;

        byte[] original = d.Stream.Value;
        // Datos para la plataforma: el JPEG tal cual (DCT) o los píxeles crudos (Flate, 1 o 3 componentes)
        byte[] fuente;
        bool esJpeg = filtro == "/DCTDecode";
        if (esJpeg) fuente = original;
        else
        {
            if (e.GetInteger("/BitsPerComponent") != 8) return false;
            if (!ParametrosFlateSeguros(d, w, comps, out int predictor)) return false;
            // Descompresión propia con tope: nunca más de lo que declaran las dimensiones.
            long fila = (long)w * comps;
            long maxSalida = predictor >= 10 ? (fila + 1) * h : fila * h;
            byte[]? crudo = InflarConTope(original, maxSalida);
            if (crudo == null) return false;
            if (predictor >= 10) crudo = DeshacerPredictor(crudo, h, w, comps);
            if (crudo == null || crudo.LongLength < fila * h) return false;
            fuente = crudo;
        }

        double ladoMax = Math.Max(1, anchoPuntos / 72.0 * maxDpi);
        double mayor = Math.Max(w, h);
        double esc = mayor > ladoMax ? ladoMax / mayor : 1.0;
        int nw = Math.Max(1, (int)Math.Round(w * esc)), nh = Math.Max(1, (int)Math.Round(h * esc));

        byte[]? jpg = plataforma.RecomprimirJpeg(fuente, esJpeg, w, h, comps, nw, nh, (int)calidad);
        if (jpg == null || jpg.Length >= original.Length) return false;

        d.Stream.Value = jpg;
        e.SetInteger("/Width", nw);
        e.SetInteger("/Height", nh);
        e.SetName("/ColorSpace", "/DeviceRGB");
        e.SetInteger("/BitsPerComponent", 8);
        e.SetName("/Filter", "/DCTDecode");
        e.Remove("/DecodeParms");
        return true;
    }

    static string FiltroUnico(PdfDictionary d)
    {
        var f = d.Elements["/Filter"];
        if (f is PdfReference r) f = r.Value;
        if (f is PdfName n) return n.Value;
        if (f is PdfArray a && a.Elements.Count == 1) return (a.Elements[0] as PdfName)?.Value ?? "";
        return "";
    }

    static int Componentes(PdfDictionary d)
    {
        var cs = d.Elements["/ColorSpace"];
        if (cs is PdfReference r) cs = r.Value;
        if (cs is PdfName n)
            return n.Value switch { "/DeviceRGB" => 3, "/DeviceGray" => 1, _ => 0 };
        // ICCBased, CalRGB, CalGray, Indexed…: no se tocan (convertir a DeviceRGB cambiaría los colores)
        return 0;
    }

    const long MaxPixeles = 100_000_000;        // 100 Mpx
    const long MaxBytesImagen = 400L * 1024 * 1024; // 400 MB sin comprimir

    /// <summary>/DecodeParms: sin predictor, o predictor PNG (≥ 10) coherente con la imagen. Cualquier otro caso se salta.</summary>
    static bool ParametrosFlateSeguros(PdfDictionary d, int w, int comps, out int predictor)
    {
        predictor = 1;
        var dpItem = d.Elements["/DecodeParms"];
        if (dpItem is PdfReference r) dpItem = r.Value;
        if (dpItem == null || dpItem is PdfNull) return true;
        PdfDictionary? dp = dpItem as PdfDictionary;
        if (dpItem is PdfArray arr)
        {
            if (arr.Elements.Count != 1) return false;
            var x = arr.Elements[0];
            if (x is PdfReference xr) x = xr.Value;
            if (x is PdfNull) return true;
            dp = x as PdfDictionary;
        }
        if (dp == null) return false;
        var e = dp.Elements;
        if (e.ContainsKey("/Predictor"))
        {
            predictor = e.GetInteger("/Predictor");
            if (predictor != 1 && predictor < 10) return false; // TIFF (2) u otro: no recomprimir datos mal deshechos
        }
        if (predictor >= 10)
        {
            if (e.ContainsKey("/Columns") && e.GetInteger("/Columns") != w) return false;
            if (e.ContainsKey("/Colors") && e.GetInteger("/Colors") != comps) return false;
            if (e.ContainsKey("/BitsPerComponent") && e.GetInteger("/BitsPerComponent") != 8) return false;
            if (!e.ContainsKey("/Columns") && w != 1) return false; // por defecto Columns = 1
            if (!e.ContainsKey("/Colors") && comps != 1) return false; // por defecto Colors = 1
        }
        return true;
    }

    /// <summary>Descomprime zlib/Flate leyendo como máximo <paramref name="tope"/> bytes. null si excede el tope o está dañado.</summary>
    static byte[]? InflarConTope(byte[] comprimido, long tope)
    {
        try
        {
            using var entrada = new MemoryStream(comprimido);
            using var z = new System.IO.Compression.ZLibStream(entrada, System.IO.Compression.CompressionMode.Decompress);
            using var salida = new MemoryStream();
            var buf = new byte[81920];
            long total = 0;
            int n;
            while ((n = z.Read(buf, 0, buf.Length)) > 0)
            {
                total += n;
                if (total > tope) return null; // más datos de los declarados: sospechoso
                salida.Write(buf, 0, n);
            }
            return salida.ToArray();
        }
        catch { return null; }
    }

    static byte[]? DeshacerPredictor(byte[] datos, int h, int w, int comps)
    {
        long filaL = (long)w * comps;
        if (datos.LongLength < (filaL + 1) * h) return null;
        int fila = (int)filaL; // acotado por MaxBytesImagen
        var res = new byte[fila * h];
        for (int y = 0; y < h; y++)
        {
            int tipo = datos[y * (fila + 1)], src = y * (fila + 1) + 1, dst = y * fila;
            for (int x = 0; x < fila; x++)
            {
                int a = x >= comps ? res[dst + x - comps] : 0;
                int b = y > 0 ? res[dst - fila + x] : 0;
                int c = (x >= comps && y > 0) ? res[dst - fila + x - comps] : 0;
                int v = datos[src + x];
                switch (tipo)
                {
                    case 1: v += a; break;
                    case 2: v += b; break;
                    case 3: v += (a + b) / 2; break;
                    case 4:
                        int p = a + b - c, pa = Math.Abs(p - a), pb = Math.Abs(p - b), pc = Math.Abs(p - c);
                        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); break;
                }
                res[dst + x] = (byte)v;
            }
        }
        return res;
    }
}
