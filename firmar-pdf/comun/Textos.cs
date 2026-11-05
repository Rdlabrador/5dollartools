using System.Globalization;

namespace FirmarPdf;

/// <summary>
/// Todos los textos visibles del lado C# (diálogos, filtros, errores, Office, OCR, Word), en español e inglés.
/// Uso: Textos.T("clave") o Textos.T("clave", arg0, arg1) (formato con {0}, {1}).
/// El idioma actual es "es" o "en": se lee de %LOCALAPPDATA%\FirmarPDF\idioma.txt (o del idioma de Windows) y cambia con Textos.Cambiar.
/// </summary>
public static class Textos
{
    public const string Es = "es";
    public const string En = "en";

    static volatile string idioma = Es;
    static string? archivo;

    /// <summary>Idioma actual: "es" o "en".</summary>
    public static string Idioma => idioma;

    /// <summary>Lee el idioma guardado; si no hay, usa el de Windows. Se llama una vez al arrancar.</summary>
    public static void Iniciar(string carpetaRaiz)
    {
        archivo = Path.Combine(carpetaRaiz, "idioma.txt");
        string? guardado = null;
        try { if (File.Exists(archivo)) guardado = File.ReadAllText(archivo).Trim().ToLowerInvariant(); } catch { }
        if (guardado == Es || guardado == En) { idioma = guardado; return; }
        idioma = CultureInfo.CurrentUICulture.Name.StartsWith("es", StringComparison.OrdinalIgnoreCase) ? Es : En;
    }

    /// <summary>Cambia el idioma y lo guarda. Devuelve false si el valor no es "es" ni "en".</summary>
    public static bool Cambiar(string? nuevo)
    {
        nuevo = nuevo?.Trim().ToLowerInvariant();
        if (nuevo != Es && nuevo != En) return false;
        idioma = nuevo;
        try
        {
            if (archivo != null)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(archivo)!);
                File.WriteAllText(archivo, nuevo);
            }
        }
        catch { }
        return true;
    }

    /// <summary>Texto en el idioma actual. Si la clave falta devuelve la clave (se nota enseguida).</summary>
    public static string T(string clave, params object?[] args)
    {
        var d = idioma == En ? EnTextos : EsTextos;
        string? t = null;
        // En Mac, una clave "<clave>.mac" reemplaza al texto que habla de Windows
        if (OperatingSystem.IsMacOS()) { d.TryGetValue(clave + ".mac", out t); if (t == null) EsTextos.TryGetValue(clave + ".mac", out t); }
        if (t == null && !d.TryGetValue(clave, out t) && !EsTextos.TryGetValue(clave, out t)) return clave;
        return args.Length == 0 ? t : string.Format(CultureInfo.CurrentCulture, t, args);
    }

    /// <summary>Cantidad de claves (para pruebas).</summary>
    public static int Cantidad => EsTextos.Count;

    /// <summary>Arma un filtro de diálogo: "Etiqueta (ext)|ext".</summary>
    public static string Filtro(string claveEtiqueta, string extensiones) => $"{T(claveEtiqueta)} ({extensiones})|{extensiones}";

    static readonly Dictionary<string, string> EsTextos = new()
    {
        ["app.nombre"] = "PepePDF",

        // arranque
        ["webview.falta"] = "Falta un componente de Windows (WebView2) para mostrar el programa.\n\nDescárguelo gratis desde:\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703\n\nInstálelo y vuelva a abrir {0}.",
        ["inicio.error"] = "No se pudo iniciar el programa.\n\n{0}\n\nSi el problema continúa, instale WebView2 desde:\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703",
        ["salir.cambios"] = "Tiene cambios sin guardar. ¿Salir sin guardar?",

        // errores generales
        ["error.problema"] = "Ocurrió un problema: {0}",
        ["error.abrirUno"] = "No se pudo abrir el archivo: {0}",
        ["error.abrirVarios"] = "No se pudo abrir los archivos: {0}",
        ["error.guardarUno"] = "No se pudo guardar el archivo. Elija otra carpeta. {0}",
        ["error.guardarVarios"] = "No se pudo guardar los archivos. Elija otra carpeta. {0}",
        ["error.guardarLote"] = "No se pudo guardar los archivos. {0}",
        ["error.nadaGuardar"] = "No hay nada que guardar.",
        ["error.carpetaNoPermitida"] = "Esa carpeta no está permitida. Elija la carpeta de nuevo.",
        ["error.nombreInvalido"] = "Nombre de archivo no válido.",
        ["error.archivoVacio"] = "El archivo \"{0}\" está vacío.",
        ["error.nombreLibre"] = "No se encontró un nombre libre para {0}",

        // diálogos
        ["dlg.abrirPdf"] = "Abrir PDF",
        ["dlg.guardarPdfFirmado"] = "Guardar PDF firmado",
        ["dlg.abrirArchivos"] = "Abrir archivos",
        ["dlg.guardarArchivo"] = "Guardar archivo",
        ["dlg.elegirCarpeta"] = "Elija la carpeta donde guardar",
        ["dlg.guardarWord"] = "Guardar documento de Word",
        ["dlg.abrirOffice"] = "Abrir documento de Office",

        // filtros (etiqueta; las extensiones las pone el código)
        ["filtro.pdf"] = "Documentos PDF",
        ["filtro.imagenes"] = "Imágenes",
        ["filtro.pdfImagenes"] = "PDF e imágenes",
        ["filtro.office"] = "Documentos de Office",
        ["filtro.png"] = "Imagen PNG",
        ["filtro.jpg"] = "Imagen JPG",
        ["filtro.docx"] = "Documento de Word",
        ["filtro.zip"] = "Archivo comprimido",
        ["filtro.txt"] = "Texto",

        // nombres por defecto
        ["nombre.firmado"] = "documento-firmado.pdf",
        ["nombre.documento"] = "documento",

        // Word
        ["word.invalido"] = "El documento no es válido: {0}",
        ["word.fallo"] = "No se pudo crear el documento de Word: {0}",

        // OCR
        ["ocr.sinImagen"] = "No hay imagen para reconocer.",
        ["ocr.fallo"] = "No se pudo reconocer el texto: {0}",
        ["ocr.idiomasFallo"] = "No se pudo consultar los idiomas: {0}",
        ["ocr.noDisponible"] = "Este equipo no tiene un idioma de reconocimiento de texto instalado. Agréguelo en Configuración de Windows > Hora e idioma > Idioma.",

        // Office
        ["office.consultaFallo"] = "No se pudo consultar Office: {0}",
        ["office.sinOffice"] = "Para convertir documentos a PDF se necesita Microsoft Office (Word, Excel o PowerPoint) instalado en el equipo.",
        ["office.noInstalado"] = "Para convertir este archivo se necesita Microsoft {0} instalado en el equipo.",
        ["office.contrasena"] = "Este documento tiene contraseña. Ábralo en Office, quítela y vuelva a intentar.",
        ["office.tipoNoAdmitido"] = "Tipo de archivo no admitido: .{0}",
        ["office.tardo"] = "Office tardó demasiado en convertir el archivo (más de 2 minutos).",
        ["office.noPudoAbrir"] = "Office no pudo abrir el archivo (si tiene contraseña, quítela en Office): {0}",
        ["office.sinPdf"] = "Office no generó el PDF.",
        ["office.convertirFallo"] = "No se pudo convertir el documento: {0}",

        // PDF (comprimir, proteger, limpiar)
        ["pdf.nadaLimpiar"] = "No hay nada que limpiar.",
        ["pdf.limpiarFallo"] = "No se pudo limpiar el PDF: {0}",
        ["pdf.nadaRevisar"] = "No hay nada que revisar.",
        ["pdf.nadaComprimir"] = "No hay nada que comprimir.",
        ["pdf.nadaProteger"] = "No hay nada que proteger.",
        ["pdf.nadaAbrir"] = "No hay nada que abrir.",
        ["pdf.pideClave"] = "Escriba una contraseña.",
        ["pdf.claveIncorrecta"] = "La contraseña no es correcta.",
        ["pdf.yaProtegido"] = "Este PDF ya tiene contraseña.",
        ["pdf.danado"] = "No se pudo leer el PDF. El archivo parece dañado.",
        ["pdf.noEsPdf"] = "No se pudo leer el PDF: el archivo parece dañado o no es un PDF.",
        ["pdf.otro"] = "No se pudo completar la operación.",

        // impresión
        ["imprimir.titulo"] = "Imprimir - {0}",
        ["imprimir.nada"] = "No hay nada que imprimir.",
        ["imprimir.ctrlP"] = "Para imprimir, presione Ctrl + P.",
        ["imprimir.ctrlPVentana"] = "Para imprimir, presione Ctrl + P en la ventana del documento.",
        ["imprimir.noMostrar"] = "No se pudo mostrar el documento.",
        ["imprimir.preparar"] = "No se pudo preparar la impresión: {0}",

        // celular
        ["movil.sinRed"] = "No se encontró una conexión Wi-Fi o de red. Conecte el computador a la misma red que el celular.",
        ["movil.noEncendio"] = "No se pudo encender la conexión con el celular. Puede que el Firewall de Windows la esté bloqueando. ({0})",
        ["movil.paginaInvalida"] = "Este código ya no sirve. Pida uno nuevo en el computador.",

        // solo Mac (reemplazan a los de Windows)
        ["imprimir.ctrlPVentana.mac"] = "El documento se abrió en Vista Previa. Para imprimir, presione ⌘ + P en esa ventana.",
        ["ocr.noDisponible.mac"] = "Este Mac no puede reconocer texto en ese idioma. Actualice macOS en Ajustes del Sistema > General > Actualización de software y vuelva a intentarlo.",
        ["movil.noEncendio.mac"] = "No se pudo encender la conexión con el celular. Puede que el firewall de macOS la esté bloqueando (Ajustes del Sistema > Red > Firewall). ({0})",
    };

    static readonly Dictionary<string, string> EnTextos = new()
    {
        ["app.nombre"] = "PepePDF",

        ["webview.falta"] = "A Windows component (WebView2) is missing, and the program needs it to show its screen.\n\nYou can download it for free from:\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703\n\nInstall it, then open {0} again.",
        ["inicio.error"] = "The program could not start.\n\n{0}\n\nIf the problem continues, please install WebView2 from:\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703",
        ["salir.cambios"] = "You have changes that are not saved. Do you want to leave without saving?",

        ["error.problema"] = "Something went wrong: {0}",
        ["error.abrirUno"] = "The file could not be opened: {0}",
        ["error.abrirVarios"] = "The files could not be opened: {0}",
        ["error.guardarUno"] = "The file could not be saved. Please choose another folder. {0}",
        ["error.guardarVarios"] = "The files could not be saved. Please choose another folder. {0}",
        ["error.guardarLote"] = "The files could not be saved. {0}",
        ["error.nadaGuardar"] = "There is nothing to save.",
        ["error.carpetaNoPermitida"] = "That folder is not allowed. Please choose the folder again.",
        ["error.nombreInvalido"] = "That file name is not valid.",
        ["error.archivoVacio"] = "The file \"{0}\" is empty.",
        ["error.nombreLibre"] = "Could not find an available name for {0}",

        ["dlg.abrirPdf"] = "Open PDF",
        ["dlg.guardarPdfFirmado"] = "Save signed PDF",
        ["dlg.abrirArchivos"] = "Open files",
        ["dlg.guardarArchivo"] = "Save file",
        ["dlg.elegirCarpeta"] = "Choose the folder where you want to save",
        ["dlg.guardarWord"] = "Save Word document",
        ["dlg.abrirOffice"] = "Open Office document",

        ["filtro.pdf"] = "PDF documents",
        ["filtro.imagenes"] = "Images",
        ["filtro.pdfImagenes"] = "PDF and images",
        ["filtro.office"] = "Office documents",
        ["filtro.png"] = "PNG image",
        ["filtro.jpg"] = "JPG image",
        ["filtro.docx"] = "Word document",
        ["filtro.zip"] = "Compressed file",
        ["filtro.txt"] = "Text",

        ["nombre.firmado"] = "signed-document.pdf",
        ["nombre.documento"] = "document",

        ["word.invalido"] = "The document is not valid: {0}",
        ["word.fallo"] = "The Word document could not be created: {0}",

        ["ocr.sinImagen"] = "There is no image to read.",
        ["ocr.fallo"] = "The text could not be recognized: {0}",
        ["ocr.idiomasFallo"] = "The available languages could not be checked: {0}",
        ["ocr.noDisponible"] = "This computer does not have a text recognition language installed. You can add one in Windows Settings > Time & Language > Language.",

        ["office.consultaFallo"] = "Office could not be checked: {0}",
        ["office.sinOffice"] = "To convert documents to PDF, Microsoft Office (Word, Excel or PowerPoint) must be installed on this computer.",
        ["office.noInstalado"] = "To convert this file, Microsoft {0} must be installed on this computer.",
        ["office.contrasena"] = "This document has a password. Please open it in Office, remove the password, and try again.",
        ["office.tipoNoAdmitido"] = "This type of file is not supported: .{0}",
        ["office.tardo"] = "Office took too long to convert the file (more than 2 minutes).",
        ["office.noPudoAbrir"] = "Office could not open the file (if it has a password, please remove it in Office): {0}",
        ["office.sinPdf"] = "Office did not create the PDF.",
        ["office.convertirFallo"] = "The document could not be converted: {0}",

        ["pdf.nadaLimpiar"] = "There is nothing to clean.",
        ["pdf.limpiarFallo"] = "The PDF could not be cleaned: {0}",
        ["pdf.nadaRevisar"] = "There is nothing to check.",
        ["pdf.nadaComprimir"] = "There is nothing to compress.",
        ["pdf.nadaProteger"] = "There is nothing to protect.",
        ["pdf.nadaAbrir"] = "There is nothing to open.",
        ["pdf.pideClave"] = "Please type a password.",
        ["pdf.claveIncorrecta"] = "The password is not correct.",
        ["pdf.yaProtegido"] = "This PDF already has a password.",
        ["pdf.danado"] = "The PDF could not be read. The file seems to be damaged.",
        ["pdf.noEsPdf"] = "The PDF could not be read: the file seems to be damaged or is not a PDF.",
        ["pdf.otro"] = "The operation could not be completed.",

        ["imprimir.titulo"] = "Print - {0}",
        ["imprimir.nada"] = "There is nothing to print.",
        ["imprimir.ctrlP"] = "To print, press Ctrl + P.",
        ["imprimir.ctrlPVentana"] = "To print, press Ctrl + P in the document window.",
        ["imprimir.noMostrar"] = "The document could not be shown.",
        ["imprimir.preparar"] = "Printing could not be prepared: {0}",

        ["movil.sinRed"] = "No Wi-Fi or network connection was found. Please connect the computer to the same network as the phone.",
        ["movil.noEncendio"] = "The connection with the phone could not be started. Windows Firewall may be blocking it. ({0})",
        ["movil.paginaInvalida"] = "This code no longer works. Please ask for a new one on the computer.",

        // Mac only (replace the Windows texts)
        ["imprimir.ctrlPVentana.mac"] = "The document opened in Preview. To print, press ⌘ + P in that window.",
        ["ocr.noDisponible.mac"] = "This Mac cannot recognize text in that language. Update macOS in System Settings > General > Software Update, then try again.",
        ["movil.noEncendio.mac"] = "The connection with the phone could not be started. The macOS firewall may be blocking it (System Settings > Network > Firewall). ({0})",
    };
}
