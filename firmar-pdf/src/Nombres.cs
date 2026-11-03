namespace FirmarPdf;

/// <summary>Saneado de nombres de archivo que llegan desde la interfaz.</summary>
public static class Nombres
{
    public const int LargoMaximo = 150;

    static readonly HashSet<string> Reservados = new(StringComparer.OrdinalIgnoreCase)
    {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    };

    /// <summary>
    /// Devuelve un nombre seguro (sin rutas, sin caracteres inválidos, sin nombres reservados de Windows,
    /// sin espacios/puntos finales, de máximo 150 caracteres) o null si no hay forma de salvarlo.
    /// </summary>
    public static string? Sanear(string? nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre)) return null;
        // quitar cualquier ruta (se aceptan ambos separadores)
        int corte = nombre.LastIndexOfAny(new[] { '\\', '/' });
        if (corte >= 0) nombre = nombre[(corte + 1)..];

        var invalidos = Path.GetInvalidFileNameChars();
        var sb = new System.Text.StringBuilder(nombre.Length);
        foreach (var c in nombre) sb.Append(c < 32 || Array.IndexOf(invalidos, c) >= 0 ? '_' : c);
        nombre = sb.ToString().Trim().TrimEnd('.', ' ').TrimStart();

        if (nombre.Length == 0 || nombre == "." || nombre == "..") return null;

        if (nombre.Length > LargoMaximo)
        {
            var ext = Path.GetExtension(nombre);
            if (ext.Length > 16) ext = ext[..16];
            nombre = nombre[..(LargoMaximo - ext.Length)] + ext;
            nombre = nombre.TrimEnd('.', ' ');
            if (nombre.Length == 0) return null;
        }

        // nombre reservado, con o sin extensión (CON, con.txt, NUL.tar.gz)
        var primero = nombre;
        int punto = primero.IndexOf('.');
        if (punto >= 0) primero = primero[..punto];
        if (Reservados.Contains(primero.TrimEnd(' '))) nombre = "_" + nombre;

        return nombre;
    }

    /// <summary>Crea el archivo sin sobrescribir nunca: si existe agrega " (2)", " (3)"… (CreateNew, sin carrera).</summary>
    public static string EscribirSinSobrescribir(string carpeta, string nombre, byte[] datos)
    {
        var baseN = Path.GetFileNameWithoutExtension(nombre);
        var ext = Path.GetExtension(nombre);
        for (int i = 1; i < 10000; i++)
        {
            var candidato = i == 1 ? nombre : $"{baseN} ({i}){ext}";
            var ruta = Path.Combine(carpeta, candidato);
            try
            {
                using var fs = new FileStream(ruta, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                fs.Write(datos, 0, datos.Length);
                return candidato;
            }
            catch (IOException) when (File.Exists(ruta)) { /* ocupado: probar el siguiente */ }
        }
        throw new IOException(Textos.T("error.nombreLibre", nombre));
    }
}
