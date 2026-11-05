using System.Globalization;
using System.Text;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using A = DocumentFormat.OpenXml.Drawing;
using DW = DocumentFormat.OpenXml.Drawing.Wordprocessing;
using PIC = DocumentFormat.OpenXml.Drawing.Pictures;

namespace FirmarPdf.Motor;

/// <summary>Estructura del documento Word (es también el JSON que envía la interfaz, en camelCase).</summary>
public sealed class DocumentoWord
{
    public string? Titulo { get; set; }
    public List<PaginaWord> Paginas { get; set; } = new();
}

public sealed class PaginaWord
{
    public double AnchoPt { get; set; } = 595.3;
    public double AltoPt { get; set; } = 841.9;
    public List<BloqueWord> Bloques { get; set; } = new();
}

public sealed class BloqueWord
{
    /// <summary>"parrafo" | "imagen" | "saltoPagina"</summary>
    public string Tipo { get; set; } = "parrafo";
    /// <summary>"izq" | "centro" | "der" | "just"</summary>
    public string? Alineacion { get; set; }
    public double SangriaPt { get; set; }
    public double EspacioAntesPt { get; set; }
    public List<RunWord> Runs { get; set; } = new();
    /// <summary>PNG en base64 (con o sin prefijo data:).</summary>
    public string? ImagenPng { get; set; }
    public double AnchoImgPt { get; set; }
    public double AltoImgPt { get; set; }
}

public sealed class RunWord
{
    public string? Texto { get; set; }
    public double TamPt { get; set; } = 11;
    public bool Negrita { get; set; }
    public bool Cursiva { get; set; }
    public bool Subrayado { get; set; }
    public string? Fuente { get; set; }
    /// <summary>"#rrggbb"</summary>
    public string? Color { get; set; }
}

public static class Word
{
    const double MargenPt = 2 / 2.54 * 72; // 2 cm

    public static byte[] CrearDocx(DocumentoWord d)
    {
        using var ms = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document))
        {
            var main = doc.AddMainDocumentPart();
            var body = new Body();
            main.Document = new Document(body);
            uint idImg = 1;

            var paginas = d.Paginas.Count > 0 ? d.Paginas : new List<PaginaWord> { new() };
            for (int i = 0; i < paginas.Count; i++)
            {
                var pag = paginas[i];
                bool ultima = i == paginas.Count - 1;
                double ancho = Math.Clamp(pag.AnchoPt > 0 ? pag.AnchoPt : 595.3, 72, 1584);
                double alto = Math.Clamp(pag.AltoPt > 0 ? pag.AltoPt : 841.9, 72, 1584);
                double margen = Math.Min(MargenPt, Math.Min(ancho, alto) / 4);
                double util = ancho - 2 * margen;

                var sect = new SectionProperties();
                if (!ultima) sect.Append(new SectionType { Val = SectionMarkValues.NextPage });
                sect.Append(new PageSize { Width = Tw(ancho), Height = Tw(alto), Orient = ancho > alto ? PageOrientationValues.Landscape : PageOrientationValues.Portrait });
                sect.Append(new PageMargin { Top = (int)Tw(margen), Bottom = (int)Tw(margen), Left = Tw(margen), Right = Tw(margen), Header = 709, Footer = 709, Gutter = 0 });

                var parrafos = new List<Paragraph>();
                foreach (var b in pag.Bloques)
                {
                    switch ((b.Tipo ?? "parrafo").ToLowerInvariant())
                    {
                        case "imagen":
                            var pi = ParrafoImagen(main, b, util, ref idImg);
                            if (pi != null) parrafos.Add(pi);
                            break;
                        case "saltopagina":
                            parrafos.Add(new Paragraph(new Run(new Break { Type = BreakValues.Page })));
                            break;
                        default:
                            parrafos.Add(ParrafoTexto(b));
                            break;
                    }
                }

                if (!ultima)
                {
                    // El salto de sección va en el último párrafo de la sección (uno mínimo si no sirve ninguno)
                    Paragraph cierre;
                    if (parrafos.Count > 0 && parrafos[^1].Descendants<Break>().All(x => x.Type?.Value != BreakValues.Page))
                        cierre = parrafos[^1];
                    else
                    {
                        cierre = new Paragraph(new ParagraphProperties(
                            new SpacingBetweenLines { Before = "0", After = "0", Line = "20", LineRule = LineSpacingRuleValues.Exact }));
                        parrafos.Add(cierre);
                    }
                    var pp = cierre.GetFirstChild<ParagraphProperties>();
                    if (pp == null) { pp = new ParagraphProperties(); cierre.PrependChild(pp); }
                    pp.Append(sect);
                }
                foreach (var p in parrafos) body.Append(p);
                if (ultima) body.Append(sect);
            }

            doc.PackageProperties.Title = Limpiar(d.Titulo ?? "");
            doc.PackageProperties.Creator = "PepePDF";
            main.Document.Save();
        }
        return ms.ToArray();
    }

    static uint Tw(double pt) => (uint)Math.Round(pt * 20);

    static string Num(double v) => Math.Round(v).ToString(CultureInfo.InvariantCulture);

    static Paragraph ParrafoTexto(BloqueWord b)
    {
        var props = new ParagraphProperties();
        props.Append(new SpacingBetweenLines { Before = Num(Math.Max(0, b.EspacioAntesPt) * 20), After = "0" });
        if (b.SangriaPt > 0) props.Append(new Indentation { Left = Num(b.SangriaPt * 20) });
        var jc = (b.Alineacion ?? "izq").ToLowerInvariant() switch
        {
            "centro" => JustificationValues.Center,
            "der" => JustificationValues.Right,
            "just" => JustificationValues.Both,
            _ => (JustificationValues?)null,
        };
        if (jc != null) props.Append(new Justification { Val = jc });

        var p = new Paragraph(props);
        foreach (var r in b.Runs ?? new())
        {
            var texto = Limpiar(r.Texto ?? "");
            if (texto.Length == 0) continue;
            var fuente = Fuente(r.Fuente);
            var rp = new RunProperties();
            rp.Append(new RunFonts { Ascii = fuente, HighAnsi = fuente, ComplexScript = fuente, EastAsia = fuente });
            if (r.Negrita) rp.Append(new Bold());
            if (r.Cursiva) rp.Append(new Italic());
            var col = Color(r.Color);
            if (col != null) rp.Append(new DocumentFormat.OpenXml.Wordprocessing.Color { Val = col });
            var medio = Math.Clamp((int)Math.Round((r.TamPt > 0 ? r.TamPt : 11) * 2), 2, 3276).ToString(CultureInfo.InvariantCulture);
            rp.Append(new FontSize { Val = medio });
            rp.Append(new FontSizeComplexScript { Val = medio });
            if (r.Subrayado) rp.Append(new Underline { Val = UnderlineValues.Single });

            var run = new Run(rp);
            var lineas = texto.Split('\n');
            for (int i = 0; i < lineas.Length; i++)
            {
                if (i > 0) run.Append(new Break());
                var partes = lineas[i].Split('\t');
                for (int j = 0; j < partes.Length; j++)
                {
                    if (j > 0) run.Append(new TabChar());
                    if (partes[j].Length > 0) run.Append(new Text(partes[j]) { Space = SpaceProcessingModeValues.Preserve });
                }
            }
            p.Append(run);
        }
        return p;
    }

    static Paragraph? ParrafoImagen(MainDocumentPart main, BloqueWord b, double util, ref uint id)
    {
        if (string.IsNullOrEmpty(b.ImagenPng)) return null;
        var b64 = b.ImagenPng;
        int coma = b64.IndexOf("base64,", StringComparison.Ordinal);
        if (coma >= 0) b64 = b64[(coma + 7)..];
        byte[] png = Convert.FromBase64String(b64);

        double w = b.AnchoImgPt, h = b.AltoImgPt;
        if ((w <= 0 || h <= 0) && png.Length > 24)
        {
            // Tamaño del PNG (px → pt a 96 ppp) leído de la cabecera IHDR
            int pw = (png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19];
            int ph = (png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23];
            if (pw > 0 && ph > 0) { w = pw * 0.75; h = ph * 0.75; }
        }
        if (w <= 0 || h <= 0) return null;
        if (w > util) { h *= util / w; w = util; }

        var part = main.AddImagePart(ImagePartType.Png);
        using (var s = new MemoryStream(png)) part.FeedData(s);
        string rid = main.GetIdOfPart(part);
        long cx = (long)Math.Round(w * 12700), cy = (long)Math.Round(h * 12700);
        uint n = id++;

        var inline = new DW.Inline(
            new DW.Extent { Cx = cx, Cy = cy },
            new DW.EffectExtent { LeftEdge = 0, TopEdge = 0, RightEdge = 0, BottomEdge = 0 },
            new DW.DocProperties { Id = n, Name = "Imagen " + n },
            new DW.NonVisualGraphicFrameDrawingProperties(new A.GraphicFrameLocks { NoChangeAspect = true }),
            new A.Graphic(new A.GraphicData(
                new PIC.Picture(
                    new PIC.NonVisualPictureProperties(
                        new PIC.NonVisualDrawingProperties { Id = 0, Name = "imagen" + n + ".png" },
                        new PIC.NonVisualPictureDrawingProperties()),
                    new PIC.BlipFill(new A.Blip { Embed = rid }, new A.Stretch(new A.FillRectangle())),
                    new PIC.ShapeProperties(
                        new A.Transform2D(new A.Offset { X = 0, Y = 0 }, new A.Extents { Cx = cx, Cy = cy }),
                        new A.PresetGeometry(new A.AdjustValueList()) { Preset = A.ShapeTypeValues.Rectangle }))
            ) { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" }))
        { DistanceFromTop = 0U, DistanceFromBottom = 0U, DistanceFromLeft = 0U, DistanceFromRight = 0U };

        var props = new ParagraphProperties(new SpacingBetweenLines { Before = Num(Math.Max(0, b.EspacioAntesPt) * 20), After = "0" });
        var jc = (b.Alineacion ?? "izq").ToLowerInvariant() switch
        {
            "centro" => JustificationValues.Center,
            "der" => JustificationValues.Right,
            _ => (JustificationValues?)null,
        };
        if (jc != null) props.Append(new Justification { Val = jc });
        return new Paragraph(props, new Run(new Drawing(inline)));
    }

    static string Fuente(string? f)
    {
        var n = (f ?? "").ToLowerInvariant();
        if (n.Contains("arial") || n.Contains("helvetica")) return "Arial";
        if (n.Contains("times")) return "Times New Roman";
        if (n.Contains("courier")) return "Courier New";
        return "Calibri";
    }

    static string? Color(string? c)
    {
        if (string.IsNullOrWhiteSpace(c)) return null;
        c = c.Trim().TrimStart('#');
        if (c.Length == 3) c = string.Concat(c.Select(ch => new string(ch, 2)));
        return c.Length == 6 && c.All(Uri.IsHexDigit) ? c.ToUpperInvariant() : null;
    }

    /// <summary>Quita los caracteres de control que XML no admite (conserva tab y salto de línea).</summary>
    static string Limpiar(string s)
    {
        var sb = new StringBuilder(s.Length);
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c == '\r') { if (i + 1 < s.Length && s[i + 1] == '\n') continue; sb.Append('\n'); continue; }
            if (c == '\t' || c == '\n') { sb.Append(c); continue; }
            if (c < 0x20 || c == 0xFFFE || c == 0xFFFF) continue;
            if (char.IsHighSurrogate(c) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1])) { sb.Append(c).Append(s[++i]); continue; }
            if (char.IsSurrogate(c)) continue;
            sb.Append(c);
        }
        return sb.ToString();
    }
}
