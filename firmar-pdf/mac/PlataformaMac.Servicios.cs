using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using FirmarPdf.Motor;
using SkiaSharp;

namespace FirmarPdf;

/// <summary>Servicios de sistema de la plataforma Mac: imprimir (PDFKit), OCR (Vision), Office a PDF y JPEG (SkiaSharp).</summary>
public partial class PlataformaMac
{
    const string Osascript = "/usr/bin/osascript";
    static readonly TimeSpan MaximoOffice = TimeSpan.FromMinutes(2);

    // ---- utilidades: scripts incrustados y procesos ----

    /// <summary>Escribe un script incrustado (mac\scripts\*) en la carpeta dada y devuelve su ruta.</summary>
    static string ExtraerScript(string nombre, string carpeta)
    {
        var asm = typeof(PlataformaMac).Assembly;
        var recurso = asm.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith("." + nombre, StringComparison.Ordinal) || n == nombre)
            ?? throw new FileNotFoundException("Falta el script incrustado " + nombre);
        var destino = Path.Combine(carpeta, nombre);
        using var origen = asm.GetManifestResourceStream(recurso)!;
        using var f = File.Create(destino);
        origen.CopyTo(f);
        return destino;
    }

    static string CarpetaTemporal(string prefijo)
    {
        var c = Path.Combine(Path.GetTempPath(), prefijo + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(c);
        return c;
    }

    static void BorrarCarpeta(string c)
    {
        for (int i = 0; i < 5; i++)
        {
            try { Directory.Delete(c, true); return; }
            catch { Thread.Sleep(200); }
        }
    }

    /// <summary>Ejecuta un programa con argumentos (sin cadenas de comando), leyendo stdout y stderr sin bloquear. Mata el árbol si pasa el tiempo.</summary>
    static (int Codigo, string Salida, string Error, bool TiempoAgotado) Ejecutar(string programa, IEnumerable<string> argumentos, TimeSpan maximo)
    {
        var psi = new ProcessStartInfo(programa)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        foreach (var a in argumentos) psi.ArgumentList.Add(a);
        using var p = Process.Start(psi) ?? throw new InvalidOperationException("No se pudo iniciar " + programa);
        try { p.StandardInput.Close(); } catch { }
        var salida = p.StandardOutput.ReadToEndAsync();
        var error = p.StandardError.ReadToEndAsync();
        if (!p.WaitForExit((int)Math.Min(maximo.TotalMilliseconds, int.MaxValue)))
        {
            try { p.Kill(true); } catch { }
            p.WaitForExit(3000);
            return (-1, "", "", true);
        }
        p.WaitForExit(); // espera a que terminen las lecturas
        return (p.ExitCode, salida.GetAwaiter().GetResult(), error.GetAwaiter().GetResult(), false);
    }

    // ---- imprimir ----

    public async Task<ResultadoImpresion> ImprimirPdfAsync(string rutaPdf)
    {
        return await Task.Run(() =>
        {
            var carpeta = CarpetaTemporal("PepePDF-imprimir-");
            try
            {
                var script = ExtraerScript("imprimir.js", carpeta);
                // El panel puede quedar abierto mucho rato: tiempo largo.
                var r = Ejecutar(Osascript, new[] { "-l", "JavaScript", script, rutaPdf }, TimeSpan.FromMinutes(30));
                if (!r.TiempoAgotado && r.Codigo == 0)
                {
                    var linea = r.Salida.Trim();
                    if (linea == "ok") return ResultadoImpresion.Abierto;
                    if (linea == "cancelado") return ResultadoImpresion.Cerrado;
                }
            }
            catch { /* se prueba la alternativa */ }
            finally { BorrarCarpeta(carpeta); }

            // Alternativa: Vista Previa (el usuario imprime con ⌘P). La interfaz avisa con el mensaje de "Aviso".
            try
            {
                var r = Ejecutar("/usr/bin/open", new[] { "-a", "Preview", rutaPdf }, TimeSpan.FromSeconds(20));
                _ = r;
            }
            catch { }
            return ResultadoImpresion.Aviso;
        });
    }

    // ---- OCR (Vision) ----

    static bool EsVisionNoDisponible(string error) => error.Contains("VISION_NO_DISPONIBLE", StringComparison.Ordinal);

    public string[] IdiomasOcr()
    {
        var carpeta = CarpetaTemporal("PepePDF-ocr-");
        try
        {
            var script = ExtraerScript("ocr.js", carpeta);
            var r = Ejecutar(Osascript, new[] { "-l", "JavaScript", script, "--idiomas" }, TimeSpan.FromSeconds(30));
            if (r.TiempoAgotado || r.Codigo != 0) return Array.Empty<string>();
            return JsonSerializer.Deserialize<string[]>(r.Salida.Trim()) ?? Array.Empty<string>();
        }
        catch { return Array.Empty<string>(); }
        finally { BorrarCarpeta(carpeta); }
    }

    public Task<ResultadoOcr> ReconocerAsync(byte[] png, string? idioma) => Task.Run(() =>
    {
        var carpeta = CarpetaTemporal("PepePDF-ocr-");
        try
        {
            var script = ExtraerScript("ocr.js", carpeta);
            var imagen = Path.Combine(carpeta, "imagen.png");
            File.WriteAllBytes(imagen, png);
            var args = new List<string> { "-l", "JavaScript", script, imagen };
            if (!string.IsNullOrWhiteSpace(idioma)) args.Add(idioma);
            var r = Ejecutar(Osascript, args, TimeSpan.FromMinutes(3));
            if (r.TiempoAgotado) throw new TimeoutException("El reconocimiento de texto tardó demasiado.");
            if (r.Codigo != 0)
            {
                if (EsVisionNoDisponible(r.Error)) throw new OcrNoDisponibleException();
                throw new InvalidOperationException(UltimaLinea(r.Error));
            }
            return LeerResultadoOcr(r.Salida);
        }
        finally { BorrarCarpeta(carpeta); }
    });

    static string UltimaLinea(string texto)
    {
        var l = texto.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return l.Length > 0 ? l[^1] : "error desconocido";
    }

    static ResultadoOcr LeerResultadoOcr(string json)
    {
        using var doc = JsonDocument.Parse(json.Trim());
        var raiz = doc.RootElement;
        var res = new ResultadoOcr
        {
            Idioma = raiz.GetProperty("idioma").GetString() ?? "",
            AnchoImg = raiz.GetProperty("anchoImg").GetInt32(),
            AltoImg = raiz.GetProperty("altoImg").GetInt32(),
        };
        foreach (var l in raiz.GetProperty("lineas").EnumerateArray())
        {
            var linea = new LineaOcr
            {
                Texto = l.GetProperty("texto").GetString() ?? "",
                X = l.GetProperty("x").GetDouble(), Y = l.GetProperty("y").GetDouble(),
                Ancho = l.GetProperty("ancho").GetDouble(), Alto = l.GetProperty("alto").GetDouble(),
            };
            foreach (var w in l.GetProperty("palabras").EnumerateArray())
                linea.Palabras.Add(new PalabraOcr
                {
                    Texto = w.GetProperty("texto").GetString() ?? "",
                    X = w.GetProperty("x").GetDouble(), Y = w.GetProperty("y").GetDouble(),
                    Ancho = w.GetProperty("ancho").GetDouble(), Alto = w.GetProperty("alto").GetDouble(),
                });
            if (linea.Palabras.Count > 0) res.Lineas.Add(linea);
        }
        return res;
    }

    // ---- Office a PDF ----

    // Sin macros a propósito (xlsm/docm/pptm no se aceptan), igual que en Windows.
    static readonly string[] ExtWord = { "doc", "docx", "rtf", "odt", "txt" };
    static readonly string[] ExtExcel = { "xls", "xlsx", "ods", "csv" };
    static readonly string[] ExtPowerPoint = { "ppt", "pptx", "odp", "pps", "ppsx" };

    const string RutaSoffice = "/Applications/LibreOffice.app/Contents/MacOS/soffice";

    static bool ExisteApp(string nombre)
    {
        try
        {
            return Directory.Exists("/Applications/" + nombre + ".app")
                || Directory.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Applications", nombre + ".app"));
        }
        catch { return false; }
    }

    /// <summary>true si hay un proceso con ese nombre exacto en marcha (pgrep -x).</summary>
    static bool ProcesoActivo(string nombre)
    {
        try { return Ejecutar("/usr/bin/pgrep", new[] { "-x", nombre }, TimeSpan.FromSeconds(5)).Codigo == 0; }
        catch { return false; }
    }

    static bool HayLibreOffice() => File.Exists(RutaSoffice);

    public OfficeDisp OfficeDisponible()
    {
        // LibreOffice convierte los tres tipos; Microsoft Office, cada uno el suyo.
        bool lo = HayLibreOffice();
        return new OfficeDisp(
            lo || ExisteApp("Microsoft Word"),
            lo || ExisteApp("Microsoft Excel"),
            lo || ExisteApp("Microsoft PowerPoint"));
    }

    public byte[] OfficeAPdf(byte[] archivo, string extension)
    {
        var ext = extension.Trim().TrimStart('.').ToLowerInvariant();
        string app, script, contenedor;
        if (ExtWord.Contains(ext)) { app = "Microsoft Word"; script = "office-word.applescript"; contenedor = "com.microsoft.Word"; }
        else if (ExtExcel.Contains(ext)) { app = "Microsoft Excel"; script = "office-excel.applescript"; contenedor = "com.microsoft.Excel"; }
        else if (ExtPowerPoint.Contains(ext)) { app = "Microsoft PowerPoint"; script = "office-powerpoint.applescript"; contenedor = "com.microsoft.Powerpoint"; }
        else throw new NotSupportedException(Textos.T("office.tipoNoAdmitido", ext));

        bool hayMs = ExisteApp(app), hayLo = HayLibreOffice();
        if (!hayMs && !hayLo) throw new InvalidOperationException(Textos.T("office.noInstalado", app.Replace("Microsoft ", "")));

        Exception? falloMs = null;
        if (hayMs)
        {
            try { return ConvertirConMicrosoft(archivo, ext, script, contenedor, app); }
            catch (TimeoutException) { throw; }
            catch (Exception ex) { falloMs = ex; if (!hayLo) throw; }
        }
        try { return ConvertirConLibreOffice(archivo, ext); }
        catch when (falloMs != null) { throw falloMs; } // si Office ya falló, ese es el mensaje útil
    }

    static byte[] ConvertirConMicrosoft(byte[] archivo, string ext, string nombreScript, string contenedor, string nombreApp)
    {
        // Office para Mac está en sandbox: dentro de su contenedor no pide permiso de carpeta.
        var raizContenedor = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Library", "Containers", contenedor, "Data");
        var baseTrabajo = Directory.Exists(raizContenedor) ? raizContenedor : Path.GetTempPath();
        var trabajo = Path.Combine(baseTrabajo, "PepePDF-office-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(trabajo);
        var scripts = CarpetaTemporal("PepePDF-scripts-");
        try
        {
            var entrada = Path.Combine(trabajo, "entrada." + ext);
            var salida = Path.Combine(trabajo, "salida.pdf");
            File.WriteAllBytes(entrada, archivo);
            var script = ExtraerScript(nombreScript, scripts);
            bool estabaAbierta = ProcesoActivo(nombreApp);
            var r = Ejecutar(Osascript, new[] { script, entrada, salida }, MaximoOffice);
            if (r.TiempoAgotado)
            {
                // Si Office no estaba abierto antes, se cierra para no dejarlo colgado detrás del usuario.
                if (!estabaAbierta)
                {
                    try { Ejecutar(Osascript, new[] { "-e", "tell application id \"" + contenedor + "\" to quit saving no" }, TimeSpan.FromSeconds(15)); } catch { }
                }
                throw new TimeoutException(Textos.T("office.tardo"));
            }
            if (r.Codigo != 0) throw new InvalidOperationException(Textos.T("office.noPudoAbrir", UltimaLinea(r.Error)));
            if (!File.Exists(salida)) throw new InvalidOperationException(Textos.T("office.sinPdf"));
            return File.ReadAllBytes(salida);
        }
        finally { BorrarCarpeta(trabajo); BorrarCarpeta(scripts); }
    }

    static byte[] ConvertirConLibreOffice(byte[] archivo, string ext)
    {
        var trabajo = CarpetaTemporal("PepePDF-lo-");
        try
        {
            var entrada = Path.Combine(trabajo, "entrada." + ext);
            var salidaDir = Path.Combine(trabajo, "salida");
            Directory.CreateDirectory(salidaDir);
            File.WriteAllBytes(entrada, archivo);
            // Perfil propio: no choca con un LibreOffice abierto por el usuario.
            var perfil = new Uri(Path.Combine(trabajo, "perfil")).AbsoluteUri;
            var args = new[] { "-env:UserInstallation=" + perfil, "--headless", "--norestore", "--nolockcheck",
                "--convert-to", "pdf", "--outdir", salidaDir, entrada };
            var r = Ejecutar(RutaSoffice, args, MaximoOffice);
            if (r.TiempoAgotado) throw new TimeoutException(Textos.T("office.tardo"));
            var pdf = Path.Combine(salidaDir, "entrada.pdf");
            if (r.Codigo != 0 || !File.Exists(pdf))
                throw new InvalidOperationException(File.Exists(pdf) ? Textos.T("office.noPudoAbrir", UltimaLinea(r.Error)) : Textos.T("office.sinPdf"));
            return File.ReadAllBytes(pdf);
        }
        finally { BorrarCarpeta(trabajo); }
    }

    // ---- recompresión de JPEG (SkiaSharp) ----

    public byte[]? RecomprimirJpeg(byte[] datos, bool esJpeg, int ancho, int alto, int componentes, int nuevoAncho, int nuevoAlto, int calidad)
    {
        if (nuevoAncho < 1 || nuevoAlto < 1) return null;
        SKBitmap? origen = null;
        try
        {
            if (esJpeg)
            {
                origen = SKBitmap.Decode(datos);
                if (origen == null || origen.Width != ancho || origen.Height != alto) return null;
            }
            else
            {
                if (componentes != 1 && componentes != 3) return null;
                if (datos.LongLength < (long)ancho * alto * componentes) return null;
                origen = DesdeCrudo(datos, ancho, alto, componentes);
            }

            using var destino = new SKBitmap(new SKImageInfo(nuevoAncho, nuevoAlto, SKColorType.Rgba8888, SKAlphaType.Opaque));
            using (var lienzo = new SKCanvas(destino))
            using (var imagen = SKImage.FromBitmap(origen))
            {
                lienzo.Clear(SKColors.White);
                // Linear + mipmap lineal: buena reducción sin recortes ni dientes de sierra.
                var muestreo = new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear);
                lienzo.DrawImage(imagen, new SKRect(0, 0, nuevoAncho, nuevoAlto), muestreo);
            }
            using var salida = SKImage.FromBitmap(destino);
            using var codificado = salida.Encode(SKEncodedImageFormat.Jpeg, Math.Clamp(calidad, 1, 100));
            return codificado?.ToArray();
        }
        catch { return null; }
        finally { origen?.Dispose(); }
    }

    static SKBitmap DesdeCrudo(byte[] crudo, int w, int h, int comps)
    {
        var bmp = new SKBitmap(new SKImageInfo(w, h, SKColorType.Rgba8888, SKAlphaType.Opaque));
        try
        {
            var fila = new byte[w * 4];
            int paso = bmp.RowBytes;
            IntPtr pix = bmp.GetPixels();
            for (int y = 0; y < h; y++)
            {
                int s = y * w * comps;
                for (int x = 0; x < w; x++)
                {
                    if (comps == 3) { fila[x * 4] = crudo[s + x * 3]; fila[x * 4 + 1] = crudo[s + x * 3 + 1]; fila[x * 4 + 2] = crudo[s + x * 3 + 2]; }
                    else fila[x * 4] = fila[x * 4 + 1] = fila[x * 4 + 2] = crudo[s + x];
                    fila[x * 4 + 3] = 255;
                }
                Marshal.Copy(fila, 0, pix + y * paso, w * 4);
            }
            return bmp;
        }
        catch { bmp.Dispose(); throw; }
    }
}
