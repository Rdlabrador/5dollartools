using System.Diagnostics;
using System.Runtime.InteropServices;

namespace FirmarPdf.Motor;

/// <summary>Microsoft Office (Word, Excel o PowerPoint) no está instalado en este equipo.</summary>
public sealed class OfficeNoInstaladoException : Exception
{
    public OfficeNoInstaladoException(string app) : base(Textos.T("office.noInstalado", app)) { }
}

/// <summary>El documento está protegido con contraseña y no se puede convertir sin abrirlo en Office.</summary>
public sealed class OfficeConContrasenaException : Exception
{
    public OfficeConContrasenaException() : base(Textos.T("office.contrasena")) { }
}

/// <summary>Convierte documentos de Office a PDF usando el Office instalado (COM, sin referencias a interop).</summary>
public static class Office
{
    static readonly TimeSpan Maximo = TimeSpan.FromMinutes(2);

    // Contraseña falsa: si el archivo está protegido, Open falla al instante en vez de mostrar un diálogo modal.
    const string ClaveFalsa = "x_no_valida";
    const int ForzarSinMacros = 3; // msoAutomationSecurityForceDisable

    // Sin xlsm/docm/pptm a propósito: los archivos con macros no se aceptan.
    static readonly string[] ExtWord = { "doc", "docx", "rtf", "odt", "txt" };
    static readonly string[] ExtExcel = { "xls", "xlsx", "ods", "csv" };
    static readonly string[] ExtPowerPoint = { "ppt", "pptx", "odp", "pps", "ppsx" };

    /// <summary>Extensiones aceptadas (sin punto). Para pruebas.</summary>
    public static IEnumerable<string> ExtensionesAceptadas => ExtWord.Concat(ExtExcel).Concat(ExtPowerPoint);

    static bool Hay(string progId)
    {
        try { return Type.GetTypeFromProgID(progId) != null; } catch { return false; }
    }

    public static bool HayWord => Hay("Word.Application");
    public static bool HayExcel => Hay("Excel.Application");
    public static bool HayPowerPoint => Hay("PowerPoint.Application");

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    /// <summary>Procesos con ese nombre (sin .exe) que hay ahora mismo.</summary>
    static List<int> Procesos(string nombre)
    {
        var l = new List<int>();
        try { foreach (var p in Process.GetProcessesByName(nombre)) { l.Add(p.Id); p.Dispose(); } } catch { }
        return l;
    }

    /// <summary>
    /// Elige el PID de la instancia que acabamos de crear: el único que aparece en "después" y no estaba en "antes".
    /// Si no hay exactamente uno (ambiguo, p. ej. el usuario abrió Office a la vez) devuelve null: mejor no cerrar nada por la fuerza.
    /// </summary>
    public static int? ElegirPidNuevo(IEnumerable<int> antes, IEnumerable<int> despues)
    {
        var previos = new HashSet<int>(antes);
        var nuevos = despues.Where(p => !previos.Contains(p)).Distinct().ToList();
        return nuevos.Count == 1 ? nuevos[0] : null;
    }

    /// <summary>Detecta sin Office archivos cifrados: un OOXML (docx/xlsx/pptx) cifrado es un contenedor OLE con "EncryptedPackage".</summary>
    public static bool EstaCifrado(byte[] datos, string ext)
    {
        bool ole = datos.Length > 8 && datos[0] == 0xD0 && datos[1] == 0xCF && datos[2] == 0x11 && datos[3] == 0xE0;
        if (!ole) return false;
        if (ext is "docx" or "xlsx" or "pptx" or "ppsx") return true; // OOXML normal es un ZIP, nunca OLE
        var aguja = System.Text.Encoding.Unicode.GetBytes("EncryptedPackage");
        return datos.AsSpan().IndexOf(aguja) >= 0;
    }

    /// <summary>Estado compartido con el hilo de trabajo, para poder cerrar por la fuerza solo lo que creamos.</summary>
    sealed class Estado
    {
        public volatile object? App;      // objeto COM de la aplicación
        public Process? Proceso;          // proceso de la instancia que creamos (nunca uno del usuario)
        public bool PuedeCerrar = true;   // false si PowerPoint ya estaba abierto (es instancia única)
    }

    /// <summary>Convierte el archivo a PDF. extension: con o sin punto (doc, docx, rtf, odt, xls, xlsx, ods, ppt, pptx, odp).</summary>
    public static byte[] OfficeAPdf(byte[] archivo, string extension)
    {
        var ext = extension.Trim().TrimStart('.').ToLowerInvariant();
        string app, progId;
        if (ExtWord.Contains(ext)) { app = "Word"; progId = "Word.Application"; }
        else if (ExtExcel.Contains(ext)) { app = "Excel"; progId = "Excel.Application"; }
        else if (ExtPowerPoint.Contains(ext)) { app = "PowerPoint"; progId = "PowerPoint.Application"; }
        else throw new NotSupportedException(Textos.T("office.tipoNoAdmitido", ext));

        var tipo = Type.GetTypeFromProgID(progId);
        if (tipo == null) throw new OfficeNoInstaladoException(app);

        var carpeta = Path.Combine(Path.GetTempPath(), "FirmarPDF-office-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(carpeta);
        try
        {
            var entrada = Path.Combine(carpeta, "entrada." + ext);
            var salida = Path.Combine(carpeta, "salida.pdf");
            File.WriteAllBytes(entrada, archivo);
            bool cifrado = EstaCifrado(archivo, ext);

            byte[]? resultado = null;
            Exception? falla = null;
            var estado = new Estado();
            var hilo = new Thread(() =>
            {
                try { resultado = Convertir(app, tipo, entrada, salida, cifrado, estado); }
                catch (Exception ex) { falla = ex; }
            });
            hilo.SetApartmentState(ApartmentState.STA);
            hilo.IsBackground = true;
            hilo.Start();

            if (!hilo.Join(Maximo))
            {
                CerrarPorLaFuerza(estado);
                hilo.Join(TimeSpan.FromSeconds(5));
                throw new TimeoutException(Textos.T("office.tardo"));
            }
            if (falla != null)
            {
                if (falla is OfficeConContrasenaException) throw falla;
                if (falla is COMException) throw new InvalidOperationException(Textos.T("office.noPudoAbrir", falla.Message), falla);
                throw falla;
            }
            return resultado ?? throw new InvalidOperationException(Textos.T("office.sinPdf"));
        }
        finally
        {
            // Los temporales se borran siempre; si Office aún los tiene tomados, se reintenta un momento.
            for (int i = 0; i < 5; i++)
            {
                try { Directory.Delete(carpeta, true); break; }
                catch { Thread.Sleep(300); }
            }
        }
    }

    /// <summary>Tras el tiempo máximo: intenta Quit; si el proceso sigue vivo 5 s después, lo mata. Solo el PID registrado.</summary>
    static void CerrarPorLaFuerza(Estado e)
    {
        var a = e.App;
        if (a != null && e.PuedeCerrar)
        {
            // Quit en otro hilo: si Office está colgado, la llamada podría no volver nunca.
            var q = new Thread(() => { try { ((dynamic)a).Quit(); } catch { } }) { IsBackground = true };
            q.Start();
            q.Join(TimeSpan.FromSeconds(5));
        }
        var p = e.Proceso;
        if (p == null) return; // no sabemos cuál es el nuestro: no se mata nada
        try
        {
            // El objeto Process está ligado al PID original: no hay riesgo de matar un PID reutilizado.
            if (!p.WaitForExit(5000)) p.Kill();
        }
        catch { }
    }

    static byte[] Convertir(string app, Type tipo, string entrada, string salida, bool cifrado, Estado e)
    {
        dynamic? aplicacion = null;
        dynamic? documento = null;
        dynamic? coleccion = null;
        bool quitar = true;
        try
        {
            string nombreProc = app == "Word" ? "WINWORD" : app == "Excel" ? "EXCEL" : "POWERPNT";
            var antes = Procesos(nombreProc);
            // PowerPoint es de instancia única: si ya estaba abierto es el del usuario y no se cierra.
            if (app == "PowerPoint" && antes.Count > 0) { quitar = false; e.PuedeCerrar = false; }

            aplicacion = Activator.CreateInstance(tipo)!; // Word y Excel: instancia nueva
            e.App = (object)aplicacion;
            if (e.PuedeCerrar)
            {
                int? pid = null;
                if (app == "Excel")
                {
                    try
                    {
                        GetWindowThreadProcessId(new IntPtr((int)aplicacion.Hwnd), out uint u);
                        if (u != 0) pid = (int)u;
                    }
                    catch { }
                }
                pid ??= ElegirPidNuevo(antes, Procesos(nombreProc));
                if (pid != null) { try { e.Proceso = Process.GetProcessById(pid.Value); } catch { } }
            }

            // Antes de abrir nada: macros desactivadas a la fuerza.
            aplicacion.AutomationSecurity = ForzarSinMacros;

            try
            {
                switch (app)
                {
                    case "Word":
                        aplicacion.Visible = false;
                        aplicacion.DisplayAlerts = 0; // wdAlertsNone
                        aplicacion.Options.UpdateLinksAtOpen = false;
                        coleccion = aplicacion.Documents;
                        // ConfirmConversions, ReadOnly, AddToRecentFiles, PasswordDocument, PasswordTemplate, Revert,
                        // WritePasswordDocument, WritePasswordTemplate, Format, Encoding, Visible, OpenAndRepair, DocumentDirection, NoEncodingDialog
                        documento = coleccion.Open(entrada, false, true, false, ClaveFalsa, Type.Missing, Type.Missing,
                            Type.Missing, Type.Missing, Type.Missing, Type.Missing, false, Type.Missing, Type.Missing, true);
                        documento.ExportAsFixedFormat(salida, 17); // wdExportFormatPDF
                        break;
                    case "Excel":
                        aplicacion.Visible = false;
                        aplicacion.DisplayAlerts = false;
                        aplicacion.AskToUpdateLinks = false;
                        aplicacion.EnableEvents = false;
                        coleccion = aplicacion.Workbooks;
                        // Filename, UpdateLinks, ReadOnly, Format, Password, WriteResPassword, IgnoreReadOnlyRecommended, Origin,
                        // Delimiter, Editable, Notify, Converter, AddToMru
                        documento = coleccion.Open(entrada, 0, true, Type.Missing, ClaveFalsa, Type.Missing, true,
                            Type.Missing, Type.Missing, Type.Missing, Type.Missing, Type.Missing, false);
                        documento.ExportAsFixedFormat(0, salida); // xlTypePDF
                        break;
                    default: // PowerPoint
                        coleccion = aplicacion.Presentations;
                        // Sintaxis de contraseña de PowerPoint: "ruta::clave::"; si no tiene contraseña, la ignora.
                        documento = coleccion.Open(entrada + "::" + ClaveFalsa + "::", -1, 0, 0); // ReadOnly=msoTrue, Untitled=msoFalse, WithWindow=msoFalse
                        documento.SaveAs(salida, 32); // ppSaveAsPDF
                        break;
                }
            }
            catch (COMException) when (cifrado && documento == null)
            {
                // Open falló y el archivo está cifrado: es la contraseña, no un error cualquiera.
                throw new OfficeConContrasenaException();
            }
            if (!File.Exists(salida)) throw new InvalidOperationException(Textos.T("office.sinPdf"));
            return File.ReadAllBytes(salida);
        }
        finally
        {
            // Orden inverso: documento, colección, aplicación.
            try
            {
                if (documento != null)
                {
                    if (app == "PowerPoint") documento.Close();
                    else documento.Close(false); // sin guardar
                }
            }
            catch { }
            Liberar(documento); Liberar(coleccion);
            try { if (aplicacion is object ap && quitar) { dynamic d = ap; if (app == "Word") d.Quit(0); else d.Quit(); } } catch { }
            Liberar(aplicacion);
            e.App = null;
            GC.Collect(); GC.WaitForPendingFinalizers();
        }
    }

    static void Liberar(object? o)
    {
        try { if (o != null && Marshal.IsComObject(o)) Marshal.FinalReleaseComObject(o); } catch { }
    }
}
