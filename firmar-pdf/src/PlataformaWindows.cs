using Microsoft.Web.WebView2.WinForms;
using FirmarPdf.Motor;

namespace FirmarPdf;

/// <summary>Implementación de IPlataforma para Windows: WinForms + WebView2, OCR de Windows y COM de Office.</summary>
sealed class PlataformaWindows : IPlataforma
{
    readonly Form ventana;
    readonly WebView2 web;

    public PlataformaWindows(Form ventana, WebView2 web)
    {
        this.ventana = ventana;
        this.web = web;
    }

    /// <summary>Raíz de datos: %LOCALAPPDATA%\FirmarPDF (no cambiar: ahí viven las firmas y el idioma).</summary>
    public static string RaizDatos()
    {
#if DEBUG
        // Solo para pruebas (no existe en Release): FIRMARPDF_DATOS=<carpeta> aísla los datos de la copia de prueba de los del usuario.
        var prueba = Environment.GetEnvironmentVariable("FIRMARPDF_DATOS");
        if (!string.IsNullOrEmpty(prueba)) return prueba;
#endif
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FirmarPDF");
    }

    public string CarpetaDatos => RaizDatos();

    public string CarpetaPredeterminada => Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);

    public void EnviarJson(string json)
    {
        if (web.CoreWebView2 == null) return;
        web.CoreWebView2.PostWebMessageAsJson(json);
    }

    public void EnHiloUI(Action accion) => ventana.BeginInvoke(accion);

    static string Filtro(FiltroArchivo f)
    {
        var patron = string.Join(";", f.Extensiones.Select(e => "*." + e));
        return f.MostrarExtensiones ? $"{f.Etiqueta} ({patron})|{patron}" : $"{f.Etiqueta}|{patron}";
    }

    public string[]? AbrirArchivos(string titulo, FiltroArchivo filtro, bool multiple, string carpetaInicial)
    {
        using var d = new OpenFileDialog
        {
            Title = titulo,
            Filter = Filtro(filtro),
            Multiselect = multiple,
            InitialDirectory = carpetaInicial,
        };
        return d.ShowDialog(ventana) == DialogResult.OK ? d.FileNames : null;
    }

    public string? GuardarArchivo(string titulo, string nombreSugerido, FiltroArchivo filtro, string extension, string carpetaInicial)
    {
        using var d = new SaveFileDialog
        {
            Title = titulo,
            Filter = Filtro(filtro),
            FileName = nombreSugerido,
            InitialDirectory = carpetaInicial,
            OverwritePrompt = true,
            DefaultExt = extension,
            AddExtension = true,
        };
        return d.ShowDialog(ventana) == DialogResult.OK ? d.FileName : null;
    }

    public string? ElegirCarpeta(string titulo, string carpetaInicial)
    {
        using var d = new FolderBrowserDialog { Description = titulo, UseDescriptionForTitle = true, InitialDirectory = carpetaInicial };
        return d.ShowDialog(ventana) == DialogResult.OK ? d.SelectedPath : null;
    }

    public void AbrirCarpetaEnSistema(string ruta)
    {
        try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(ruta) { UseShellExecute = true }); } catch { }
    }

    public async Task<ResultadoImpresion> ImprimirPdfAsync(string rutaPdf)
    {
        var carpeta = Path.Combine(CarpetaDatos, "WebView2-imprimir");
        var v = new Impresion(rutaPdf, carpeta, ventana.Icon);
        v.Show(ventana);
        bool ok = await v.Resultado;
        if (ok) return ResultadoImpresion.Abierto;
        return !v.IsDisposed && v.Visible ? ResultadoImpresion.Aviso : ResultadoImpresion.Cerrado;
    }

    public string[] IdiomasOcr() => Ocr.IdiomasDisponibles();

    public Task<ResultadoOcr> ReconocerAsync(byte[] png, string? idioma) => Ocr.ReconocerAsync(png, idioma);

    public OfficeDisp OfficeDisponible() => new(Office.HayWord, Office.HayExcel, Office.HayPowerPoint);

    public byte[] OfficeAPdf(byte[] archivo, string extension) => Office.OfficeAPdf(archivo, extension);

    public byte[]? RecomprimirJpeg(byte[] datos, bool esJpeg, int ancho, int alto, int componentes, int nuevoAncho, int nuevoAlto, int calidad)
        => RecompresionJpeg.Recomprimir(datos, esJpeg, ancho, alto, componentes, nuevoAncho, nuevoAlto, calidad);
}
