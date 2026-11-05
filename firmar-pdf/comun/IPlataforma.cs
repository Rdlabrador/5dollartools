using FirmarPdf.Motor;

namespace FirmarPdf;

/// <summary>Filtro de diálogo de archivos. Extensiones sin punto ni asterisco: { "pdf" }.</summary>
public sealed record FiltroArchivo(string Etiqueta, string[] Extensiones, bool MostrarExtensiones = true);

/// <summary>Qué pasó al intentar imprimir.</summary>
public enum ResultadoImpresion
{
    /// <summary>Se abrió el diálogo de impresión del sistema.</summary>
    Abierto,
    /// <summary>No se pudo abrir: avisar al usuario (mensaje imprimir.ctrlPVentana).</summary>
    Aviso,
    /// <summary>El usuario cerró todo antes: no avisar nada.</summary>
    Cerrado,
}

/// <summary>Estado de las aplicaciones de Office instaladas.</summary>
public sealed record OfficeDisp(bool Word, bool Excel, bool PowerPoint);

/// <summary>Todo lo que depende del sistema operativo. Lo implementa cada programa (Windows, Mac); la lógica común (Puente) solo usa esto.</summary>
public interface IPlataforma
{
    /// <summary>Carpeta de datos del programa (firmas, idioma, última carpeta). En Windows: %LOCALAPPDATA%\FirmarPDF.</summary>
    string CarpetaDatos { get; }

    /// <summary>Carpeta donde abrir los diálogos cuando no hay una anterior (Documentos).</summary>
    string CarpetaPredeterminada { get; }

    /// <summary>Envía un JSON a la interfaz (se llama siempre desde el hilo de la UI).</summary>
    void EnviarJson(string json);

    /// <summary>Ejecuta la acción en el hilo de la UI (puede llamarse desde cualquier hilo; lanza si la ventana ya se cerró).</summary>
    void EnHiloUI(Action accion);

    /// <summary>Diálogo abrir archivos. Devuelve las rutas o null si se cancela.</summary>
    string[]? AbrirArchivos(string titulo, FiltroArchivo filtro, bool multiple, string carpetaInicial);

    /// <summary>Diálogo guardar. Debe preguntar si sobrescribir y agregar la extensión si falta. Devuelve la ruta o null.</summary>
    string? GuardarArchivo(string titulo, string nombreSugerido, FiltroArchivo filtro, string extension, string carpetaInicial);

    /// <summary>Diálogo elegir carpeta. Devuelve la ruta o null.</summary>
    string? ElegirCarpeta(string titulo, string carpetaInicial);

    /// <summary>Abre la carpeta en el explorador del sistema (Explorer, Finder). No lanza.</summary>
    void AbrirCarpetaEnSistema(string ruta);

    /// <summary>Muestra el PDF (ruta temporal) con el diálogo de impresión del sistema y espera el resultado.</summary>
    Task<ResultadoImpresion> ImprimirPdfAsync(string rutaPdf);

    /// <summary>Etiquetas de idioma del OCR instaladas ("es-ES"...). Vacío si no hay OCR.</summary>
    string[] IdiomasOcr();

    /// <summary>Reconoce texto en un PNG. Lanza OcrNoDisponibleException si no hay motor/idioma.</summary>
    Task<ResultadoOcr> ReconocerAsync(byte[] png, string? idioma);

    /// <summary>Qué aplicaciones de Office hay (todo false si no hay o no se soporta).</summary>
    OfficeDisp OfficeDisponible();

    /// <summary>Convierte un documento de Office a PDF. Lanza si no se puede (el puente muestra el mensaje).</summary>
    byte[] OfficeAPdf(byte[] archivo, string extension);

    /// <summary>
    /// Recomprime una imagen de PDF como JPEG RGB de nuevo tamaño. Si esJpeg, datos es un JPEG completo;
    /// si no, son píxeles crudos 8 bits (componentes = 1 gris o 3 RGB, filas seguidas sin relleno).
    /// Devuelve null si no se puede (por ejemplo, el JPEG no mide ancho x alto).
    /// </summary>
    byte[]? RecomprimirJpeg(byte[] datos, bool esJpeg, int ancho, int alto, int componentes, int nuevoAncho, int nuevoAlto, int calidad);
}
