using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

namespace FirmarPdf.Motor;

/// <summary>Recompresión de imágenes de PDF a JPEG con System.Drawing (solo Windows). La usa PlataformaWindows.RecomprimirJpeg.</summary>
static class RecompresionJpeg
{
    /// <summary>Devuelve el JPEG redimensionado, o null si el JPEG no mide ancho x alto.</summary>
    public static byte[]? Recomprimir(byte[] datos, bool esJpeg, int w, int h, int comps, int nw, int nh, long calidad)
    {
        Bitmap? origen = null;
        try
        {
            if (esJpeg)
            {
                using var ms = new MemoryStream(datos);
                using var img = Image.FromStream(ms, false, false);
                if (img.Width != w || img.Height != h) return null;
                origen = new Bitmap(img);
            }
            else origen = DesdeCrudo(datos, w, h, comps);
            return CodificarJpeg(origen, nw, nh, calidad);
        }
        finally { origen?.Dispose(); }
    }

    static Bitmap DesdeCrudo(byte[] crudo, int w, int h, int comps)
    {
        var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb);
        BitmapData? bd = null;
        try
        {
            bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
            var fila = new byte[w * 3];
            for (int y = 0; y < h; y++)
            {
                int s = y * w * comps;
                for (int x = 0; x < w; x++)
                {
                    if (comps == 3) { fila[x * 3] = crudo[s + x * 3 + 2]; fila[x * 3 + 1] = crudo[s + x * 3 + 1]; fila[x * 3 + 2] = crudo[s + x * 3]; }
                    else fila[x * 3] = fila[x * 3 + 1] = fila[x * 3 + 2] = crudo[s + x];
                }
                System.Runtime.InteropServices.Marshal.Copy(fila, 0, bd.Scan0 + y * bd.Stride, w * 3);
            }
        }
        catch { bmp.Dispose(); throw; }
        finally { if (bd != null && bmp != null) { try { bmp.UnlockBits(bd); } catch { } } }
        return bmp;
    }

    static byte[] CodificarJpeg(Bitmap origen, int nw, int nh, long calidad)
    {
        using var destino = new Bitmap(nw, nh, PixelFormat.Format24bppRgb);
        using (var g = Graphics.FromImage(destino))
        {
            g.Clear(Color.White);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.DrawImage(origen, new Rectangle(0, 0, nw, nh), 0, 0, origen.Width, origen.Height, GraphicsUnit.Pixel);
        }
        var codec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
        using var ps = new EncoderParameters(1);
        ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, calidad);
        using var ms = new MemoryStream();
        destino.Save(ms, codec, ps);
        return ms.ToArray();
    }
}
