using System.Reflection;

namespace FirmarPdf;

/// <summary>Recursos incrustados (carpeta wwwroot) con su tipo MIME.</summary>
static class Recursos
{
    static readonly Assembly Ensamblado = typeof(Recursos).Assembly;
    static readonly Dictionary<string, string> Nombres = Ensamblado.GetManifestResourceNames()
        .Where(n => n.StartsWith("wwwroot", StringComparison.OrdinalIgnoreCase))
        .ToDictionary(n => n.Replace('\\', '/'), n => n, StringComparer.OrdinalIgnoreCase);

    public static Stream? Abrir(string ruta)
    {
        ruta = ruta.TrimStart('/');
        if (!Nombres.TryGetValue("wwwroot/" + ruta, out var nombre)) return null;
        return Ensamblado.GetManifestResourceStream(nombre);
    }

    public static byte[]? Leer(string ruta)
    {
        using var s = Abrir(ruta);
        if (s == null) return null;
        using var ms = new MemoryStream();
        s.CopyTo(ms);
        return ms.ToArray();
    }

    public static string Mime(string ruta) => Path.GetExtension(ruta).ToLowerInvariant() switch
    {
        ".html" or ".htm" => "text/html; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".js" or ".mjs" => "text/javascript; charset=utf-8",
        ".json" or ".webmanifest" => "application/json; charset=utf-8",
        ".wasm" => "application/wasm",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".svg" => "image/svg+xml",
        ".ico" => "image/x-icon",
        ".woff2" => "font/woff2",
        ".woff" => "font/woff",
        ".ttf" => "font/ttf",
        ".map" => "application/json",
        _ => "application/octet-stream", // .bcmap, .pfb, etc.
    };
}
