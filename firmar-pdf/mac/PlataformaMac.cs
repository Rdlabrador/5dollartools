using System.Diagnostics;
using Photino.NET;

namespace FirmarPdf;

/// <summary>Implementación de IPlataforma para Mac: ventana Photino (WKWebView), diálogos nativos y carpetas del sistema. Imprimir, OCR, Office y JPEG están en PlataformaMac.Servicios.cs.</summary>
public partial class PlataformaMac : IPlataforma
{
    readonly PhotinoWindow ventana;

    public PlataformaMac(PhotinoWindow ventana) => this.ventana = ventana;

    /// <summary>Raíz de datos: ~/Library/Application Support/PepePDF (firmas, idioma, última carpeta).</summary>
    public static string RaizDatos()
    {
#if DEBUG
        // Solo para pruebas (no existe en Release): FIRMARPDF_DATOS=<carpeta> aísla los datos de los del usuario.
        var prueba = Environment.GetEnvironmentVariable("FIRMARPDF_DATOS");
        if (!string.IsNullOrEmpty(prueba)) return prueba;
#endif
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Library", "Application Support", "PepePDF");
    }

    public string CarpetaDatos => RaizDatos();

    public string CarpetaPredeterminada => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Documents");

    public void EnviarJson(string json) => ventana.SendWebMessage(json);

    public void EnHiloUI(Action accion) => ventana.Invoke(accion);

    static (string, string[])[] Filtros(FiltroArchivo f) => new[] { (f.Etiqueta, f.Extensiones) };

    static string? CarpetaValida(string carpeta) => Directory.Exists(carpeta) ? carpeta : null;

    public string[]? AbrirArchivos(string titulo, FiltroArchivo filtro, bool multiple, string carpetaInicial)
    {
        var r = ventana.ShowOpenFile(titulo, CarpetaValida(carpetaInicial), multiple, Filtros(filtro));
        return r is { Length: > 0 } ? r : null;
    }

    public string? GuardarArchivo(string titulo, string nombreSugerido, FiltroArchivo filtro, string extension, string carpetaInicial)
    {
        string? ruta;
        var (ok, nativo) = NativoMac.GuardarComo(titulo, nombreSugerido, extension, carpetaInicial);
        if (ok) ruta = nativo;
        else ruta = ventana.ShowSaveFile(titulo, CarpetaValida(carpetaInicial), Filtros(filtro)); // plan B si falla el diálogo nativo
        if (string.IsNullOrEmpty(ruta)) return null;
        if (!ruta.EndsWith("." + extension, StringComparison.OrdinalIgnoreCase)) ruta += "." + extension;
        return ruta;
    }

    public string? ElegirCarpeta(string titulo, string carpetaInicial)
    {
        var r = ventana.ShowOpenFolder(titulo, CarpetaValida(carpetaInicial), false);
        return r is { Length: > 0 } ? r[0] : null;
    }

    public void AbrirCarpetaEnSistema(string ruta)
    {
        try
        {
            var p = new ProcessStartInfo("/usr/bin/open") { UseShellExecute = false };
            p.ArgumentList.Add("--");
            p.ArgumentList.Add(ruta);
            Process.Start(p);
        }
        catch { }
    }
}
