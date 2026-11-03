using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage.Streams;

namespace FirmarPdf.Motor;

public sealed class PalabraOcr
{
    public string Texto { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double Ancho { get; set; }
    public double Alto { get; set; }
}

public sealed class LineaOcr
{
    public string Texto { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double Ancho { get; set; }
    public double Alto { get; set; }
    public List<PalabraOcr> Palabras { get; set; } = new();
}

/// <summary>Coordenadas en píxeles de la imagen original enviada (anchoImg x altoImg).</summary>
public sealed class ResultadoOcr
{
    public string Idioma { get; set; } = "";
    public List<LineaOcr> Lineas { get; set; } = new();
    public int AnchoImg { get; set; }
    public int AltoImg { get; set; }
}

public sealed class OcrNoDisponibleException : Exception
{
    public OcrNoDisponibleException() : base(Textos.T("ocr.noDisponible")) { }
}

/// <summary>Reconocimiento de texto con el motor propio de Windows (Windows.Media.Ocr).</summary>
public static class Ocr
{
    public static string[] IdiomasDisponibles()
    {
        try { return OcrEngine.AvailableRecognizerLanguages.Select(l => l.LanguageTag).ToArray(); }
        catch { return Array.Empty<string>(); }
    }

    static OcrEngine? CrearMotor(string? idioma)
    {
        OcrEngine? motor = null;
        try { motor = OcrEngine.TryCreateFromLanguage(new Language(string.IsNullOrWhiteSpace(idioma) ? "es" : idioma)); }
        catch { /* etiqueta de idioma inválida */ }
        return motor ?? OcrEngine.TryCreateFromUserProfileLanguages();
    }

    public static async Task<ResultadoOcr> ReconocerAsync(byte[] png, string? idioma)
    {
        var motor = CrearMotor(idioma) ?? throw new OcrNoDisponibleException();

        using var flujo = new InMemoryRandomAccessStream();
        using (var escritor = new DataWriter(flujo))
        {
            escritor.WriteBytes(png);
            await escritor.StoreAsync();
            await escritor.FlushAsync();
            escritor.DetachStream();
        }
        flujo.Seek(0);
        var decodificador = await BitmapDecoder.CreateAsync(flujo);
        int anchoImg = (int)decodificador.PixelWidth, altoImg = (int)decodificador.PixelHeight;

        double escala = 1;
        uint max = OcrEngine.MaxImageDimension;
        if (anchoImg > max || altoImg > max) escala = (double)max / Math.Max(anchoImg, altoImg);

        SoftwareBitmap bmp;
        if (escala < 1)
        {
            var transformacion = new BitmapTransform
            {
                ScaledWidth = (uint)Math.Max(1, Math.Floor(anchoImg * escala)),
                ScaledHeight = (uint)Math.Max(1, Math.Floor(altoImg * escala)),
                InterpolationMode = BitmapInterpolationMode.Fant,
            };
            bmp = await decodificador.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied,
                transformacion, ExifOrientationMode.IgnoreExifOrientation, ColorManagementMode.DoNotColorManage);
        }
        else
        {
            bmp = await decodificador.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);
        }

        using (bmp)
        {
            var res = await motor.RecognizeAsync(bmp);
            double k = 1 / escala; // de vuelta a píxeles de la imagen original
            var r = new ResultadoOcr { Idioma = motor.RecognizerLanguage.LanguageTag, AnchoImg = anchoImg, AltoImg = altoImg };
            foreach (var l in res.Lines)
            {
                var linea = new LineaOcr { Texto = l.Text };
                double x0 = double.MaxValue, y0 = double.MaxValue, x1 = 0, y1 = 0;
                foreach (var w in l.Words)
                {
                    var b = w.BoundingRect;
                    linea.Palabras.Add(new PalabraOcr { Texto = w.Text, X = b.X * k, Y = b.Y * k, Ancho = b.Width * k, Alto = b.Height * k });
                    x0 = Math.Min(x0, b.X); y0 = Math.Min(y0, b.Y);
                    x1 = Math.Max(x1, b.X + b.Width); y1 = Math.Max(y1, b.Y + b.Height);
                }
                if (linea.Palabras.Count == 0) continue;
                linea.X = x0 * k; linea.Y = y0 * k; linea.Ancho = (x1 - x0) * k; linea.Alto = (y1 - y0) * k;
                r.Lineas.Add(linea);
            }
            return r;
        }
    }
}
