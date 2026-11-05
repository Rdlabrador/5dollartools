using Photino.NET;

namespace FirmarPdf;

static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        var raiz = PlataformaMac.RaizDatos();
        Directory.CreateDirectory(raiz);
        Textos.Iniciar(raiz);

        // PDF pasado por argumento (el doble clic del Finder llega como evento de Apple y se atiende en NativoMac)
        string? pdfInicial = args.FirstOrDefault(a => a.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) && File.Exists(a));

        var servidor = new ServidorInterfaz();
        string url;
        try { url = servidor.IniciarAsync(raiz).GetAwaiter().GetResult(); }
        catch (Exception ex)
        {
            Console.Error.WriteLine(Textos.T("inicio.error", ex.Message));
            return 1;
        }

        // Solo para la prueba de humo del CI: muestra la URL completa (con token) para comprobar que el servidor responde.
        if (Environment.GetEnvironmentVariable("PEPEPDF_PRUEBA") == "1") { Console.Out.WriteLine("PEPEPDF_URL=" + url); Console.Out.Flush(); }

        Puente? puente = null;
        var ventana = new PhotinoWindow()
            .SetTitle(Textos.T("app.nombre"))
            .SetMinSize(900, 600)
            .SetMaximized(true)
            .SetContextMenuEnabled(false)
#if DEBUG
            .SetDevToolsEnabled(true)
#else
            .SetDevToolsEnabled(false)
#endif
            .RegisterWebMessageReceivedHandler((_, mensaje) => puente?.Recibir(mensaje))
            .Load(url);

        puente = new Puente(new PlataformaMac(ventana), pdfInicial);

        // Ganchos nativos (cerrar con confirmación, abrir PDF del Finder, menú). Se reintenta si la ventana aún no está lista.
        bool es = Textos.Idioma == "es";
        void Instalar(int intentos)
        {
            bool ok = NativoMac.Instalar(Textos.T("app.nombre"), Textos.T("salir.cambios"),
                es ? "Salir" : "Quit", es ? "Cancelar" : "Cancel",
                () => puente.HayCambios, ruta => puente.AbrirPdf(ruta));
            if (ok || intentos <= 0) return;
            Task.Delay(300).ContinueWith(_ => { try { ventana.Invoke(() => Instalar(intentos - 1)); } catch { } });
        }
        ventana.RegisterWindowCreatedHandler((_, _) => Instalar(10));

        ventana.WaitForClose();

        puente.Cerrar();
        servidor.DisposeAsync().AsTask().Wait(2000);
        return 0;
    }
}
