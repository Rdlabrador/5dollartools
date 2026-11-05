using System.Runtime.InteropServices;

namespace FirmarPdf;

/// <summary>
/// Puente mínimo con Objective-C (libobjc) para lo que Photino no ofrece en macOS:
/// confirmar al cerrar, abrir PDF desde el Finder (application:openFiles:), menú mínimo y diálogo Guardar con nombre sugerido.
/// Si algo falla, el programa sigue funcionando sin esa función.
/// </summary>
static unsafe class NativoMac
{
    const string Objc = "/usr/lib/libobjc.A.dylib";
    const string AppKit = "/System/Library/Frameworks/AppKit.framework/AppKit";

    [DllImport(Objc)] static extern IntPtr objc_getClass(string nombre);
    [DllImport(Objc)] static extern IntPtr sel_registerName(string nombre);
    [DllImport(Objc)] static extern IntPtr object_getClass(IntPtr obj);
    [DllImport(Objc)] static extern byte class_addMethod(IntPtr cls, IntPtr sel, IntPtr imp, string tipos);
    [DllImport(Objc)] static extern IntPtr class_replaceMethod(IntPtr cls, IntPtr sel, IntPtr imp, string tipos);

    [DllImport(Objc, EntryPoint = "objc_msgSend")] static extern IntPtr Msg(IntPtr o, IntPtr s);
    [DllImport(Objc, EntryPoint = "objc_msgSend")] static extern IntPtr Msg(IntPtr o, IntPtr s, IntPtr a);
    [DllImport(Objc, EntryPoint = "objc_msgSend")] static extern IntPtr Msg(IntPtr o, IntPtr s, IntPtr a, IntPtr b);
    [DllImport(Objc, EntryPoint = "objc_msgSend")] static extern IntPtr Msg(IntPtr o, IntPtr s, IntPtr a, IntPtr b, IntPtr c);
    [DllImport(Objc, EntryPoint = "objc_msgSend")] static extern IntPtr MsgN(IntPtr o, IntPtr s, nint n);
    [DllImport(Objc, EntryPoint = "objc_msgSend")] static extern nint MsgInt(IntPtr o, IntPtr s);
    [DllImport(Objc, EntryPoint = "objc_msgSend")] static extern void MsgBoolArg(IntPtr o, IntPtr s, byte v);
    [DllImport(Objc, EntryPoint = "objc_msgSend")] static extern IntPtr MsgStr(IntPtr o, IntPtr s, string a);

    static IntPtr Sel(string n) => sel_registerName(n);
    static IntPtr Cls(string n) => objc_getClass(n);
    static IntPtr NSStr(string s) => MsgStr(Cls("NSString"), Sel("stringWithUTF8String:"), s);
    static string? Texto(IntPtr nsstring) => nsstring == IntPtr.Zero ? null : Marshal.PtrToStringUTF8(Msg(nsstring, Sel("UTF8String")));
    static IntPtr App => Msg(Cls("NSApplication"), Sel("sharedApplication"));

    static bool cargado;
    static void Cargar()
    {
        if (cargado) return;
        NativeLibrary.TryLoad(AppKit, out _); // asegura que NSApplication, NSAlert y NSSavePanel existan
        cargado = true;
    }

    // ---- datos de los ganchos (campos estáticos: nadie los libera) ----
    static Func<bool>? hayCambios;
    static Action<string>? alAbrirArchivo;
    static string textoCambios = "", btnSalir = "", btnCancelar = "", titulo = "";

    /// <summary>true si no hay cambios o el usuario confirma salir sin guardar.</summary>
    static bool salidaConfirmada; // el usuario ya dijo "salir": no se vuelve a preguntar (ventana + app)

    static bool ConfirmarSalida()
    {
        try
        {
            if (salidaConfirmada) return true;
            if (hayCambios == null || !hayCambios()) return true;
            var alerta = Msg(Msg(Cls("NSAlert"), Sel("alloc")), Sel("init"));
            MsgN(alerta, Sel("setAlertStyle:"), 2); // advertencia crítica
            Msg(alerta, Sel("setMessageText:"), NSStr(titulo));
            Msg(alerta, Sel("setInformativeText:"), NSStr(textoCambios));
            Msg(alerta, Sel("addButtonWithTitle:"), NSStr(btnCancelar)); // primero = predeterminado (1000)
            Msg(alerta, Sel("addButtonWithTitle:"), NSStr(btnSalir));    // segundo (1001)
            return salidaConfirmada = MsgInt(alerta, Sel("runModal")) == 1001;
        }
        catch { return true; }
    }

    [UnmanagedCallersOnly(CallConvs = new[] { typeof(System.Runtime.CompilerServices.CallConvCdecl) })]
    static byte VentanaDebeCerrar(IntPtr self, IntPtr sel, IntPtr ventana) => ConfirmarSalida() ? (byte)1 : (byte)0;

    // NSTerminateCancel = 0, NSTerminateNow = 1
    [UnmanagedCallersOnly(CallConvs = new[] { typeof(System.Runtime.CompilerServices.CallConvCdecl) })]
    static nint AppDebeTerminar(IntPtr self, IntPtr sel, IntPtr app) => ConfirmarSalida() ? 1 : 0;

    [UnmanagedCallersOnly(CallConvs = new[] { typeof(System.Runtime.CompilerServices.CallConvCdecl) })]
    static void AbrirArchivos(IntPtr self, IntPtr sel, IntPtr app, IntPtr archivos)
    {
        try
        {
            nint n = MsgInt(archivos, Sel("count"));
            for (nint i = 0; i < n; i++)
            {
                var ruta = Texto(Msg(archivos, Sel("objectAtIndex:"), (IntPtr)i));
                if (ruta != null && ruta.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) { alAbrirArchivo?.Invoke(ruta); break; }
            }
        }
        catch { }
        try { MsgN(app, Sel("replyToOpenOrPrint:"), 0); } catch { } // NSApplicationDelegateReplySuccess
    }

    static void PonerMetodo(IntPtr clase, string selector, void* imp, string tipos)
    {
        var s = Sel(selector);
        if (class_addMethod(clase, s, (IntPtr)imp, tipos) == 0) class_replaceMethod(clase, s, (IntPtr)imp, tipos);
    }

    /// <summary>
    /// Instala los ganchos nativos. Hilo principal, con la ventana ya creada. Devuelve false si todavía no existe
    /// el delegate de la app o de la ventana (se puede reintentar).
    /// </summary>
    public static bool Instalar(string tituloApp, string mensajeCambios, string textoSalir, string textoCancelar,
        Func<bool> hayCambiosFn, Action<string> abrirArchivoFn)
    {
        try
        {
            Cargar();
            hayCambios = hayCambiosFn; alAbrirArchivo = abrirArchivoFn;
            titulo = tituloApp; textoCambios = mensajeCambios; btnSalir = textoSalir; btnCancelar = textoCancelar;

            var app = App;
            var delegadoApp = Msg(app, Sel("delegate"));
            var ventanas = Msg(app, Sel("windows"));
            var ventana = MsgInt(ventanas, Sel("count")) > 0 ? Msg(ventanas, Sel("objectAtIndex:"), IntPtr.Zero) : IntPtr.Zero;
            var delegadoVentana = ventana != IntPtr.Zero ? Msg(ventana, Sel("delegate")) : IntPtr.Zero;
            if (delegadoApp == IntPtr.Zero || delegadoVentana == IntPtr.Zero) return false;

            // cerrar con el botón rojo
            PonerMetodo(object_getClass(delegadoVentana), "windowShouldClose:",
                (delegate* unmanaged[Cdecl]<IntPtr, IntPtr, IntPtr, byte>)&VentanaDebeCerrar, "c@:@");
            // ⌘Q o Salir del menú
            PonerMetodo(object_getClass(delegadoApp), "applicationShouldTerminate:",
                (delegate* unmanaged[Cdecl]<IntPtr, IntPtr, IntPtr, nint>)&AppDebeTerminar, "q@:@");
            // doble clic en un PDF del Finder (evento 'odoc')
            PonerMetodo(object_getClass(delegadoApp), "application:openFiles:",
                (delegate* unmanaged[Cdecl]<IntPtr, IntPtr, IntPtr, IntPtr, void>)&AbrirArchivos, "v@:@@");

            CrearMenuMinimo(app, textoSalir);
            return true;
        }
        catch { return false; }
    }

    /// <summary>Si Photino no puso menú: crea uno mínimo con Salir (⌘Q) y Edición (para que copiar/pegar funcionen en la interfaz).</summary>
    static void CrearMenuMinimo(IntPtr app, string textoSalir)
    {
        if (Msg(app, Sel("mainMenu")) != IntPtr.Zero) return;
        IntPtr NuevoMenu(string t) => Msg(Msg(Cls("NSMenu"), Sel("alloc")), Sel("initWithTitle:"), NSStr(t));
        IntPtr Item(IntPtr menu, string t, string accion, string tecla)
            => Msg(menu, Sel("addItemWithTitle:action:keyEquivalent:"), NSStr(t), accion == "" ? IntPtr.Zero : Sel(accion), NSStr(tecla));

        var barra = NuevoMenu("");
        var itemApp = Item(barra, "", "", "");
        var menuApp = NuevoMenu(titulo);
        Item(menuApp, textoSalir + " " + titulo, "terminate:", "q"); // ⌘Q por defecto
        Msg(itemApp, Sel("setSubmenu:"), menuApp);

        var itemEd = Item(barra, "", "", "");
        var menuEd = NuevoMenu("Edit");
        Item(menuEd, "Undo", "undo:", "z");
        Item(menuEd, "Cut", "cut:", "x");
        Item(menuEd, "Copy", "copy:", "c");
        Item(menuEd, "Paste", "paste:", "v");
        Item(menuEd, "Select All", "selectAll:", "a");
        Msg(itemEd, Sel("setSubmenu:"), menuEd);

        Msg(app, Sel("setMainMenu:"), barra);
    }

    /// <summary>Diálogo Guardar nativo con nombre sugerido y aviso de sobrescribir. Disponible=false si falló (usar otro método).</summary>
    public static (bool Disponible, string? Ruta) GuardarComo(string tituloDlg, string nombre, string extension, string carpeta)
    {
        try
        {
            Cargar();
            var panel = Msg(Cls("NSSavePanel"), Sel("savePanel"));
            Msg(panel, Sel("setMessage:"), NSStr(tituloDlg));
            Msg(panel, Sel("setNameFieldStringValue:"), NSStr(nombre));
            Msg(panel, Sel("setAllowedFileTypes:"), Msg(Cls("NSArray"), Sel("arrayWithObject:"), NSStr(extension)));
            MsgBoolArg(panel, Sel("setCanCreateDirectories:"), 1);
            if (Directory.Exists(carpeta))
                Msg(panel, Sel("setDirectoryURL:"), Msg(Cls("NSURL"), Sel("fileURLWithPath:isDirectory:"), NSStr(carpeta), (IntPtr)1));
            if (MsgInt(panel, Sel("runModal")) != 1) return (true, null); // NSModalResponseOK = 1
            return (true, Texto(Msg(Msg(panel, Sel("URL")), Sel("path"))));
        }
        catch { return (false, null); }
    }
}
