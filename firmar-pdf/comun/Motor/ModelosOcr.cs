namespace FirmarPdf.Motor;

// Resultado del OCR (lo produce cada plataforma; el puente lo serializa tal cual hacia la interfaz).
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
