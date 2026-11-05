using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace FirmarPdf;

/// <summary>Ventana principal: aloja la interfaz (WebView2) y atiende los mensajes del contrato.</summary>
sealed class VentanaPrincipal : Form
{
    const string Origen = "https://app.local/";

    readonly WebView2 web = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(12, 13, 16) };
    readonly string carpetaDatos = Path.Combine(PlataformaWindows.RaizDatos(), "WebView2");
    readonly Puente puente;

    public VentanaPrincipal(string? pdfInicial)
    {
        Text = Textos.T("app.nombre");
        try { Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath ?? Application.ExecutablePath); } catch { }
        MinimumSize = new Size(900, 600);
        WindowState = FormWindowState.Maximized;
        BackColor = Color.FromArgb(12, 13, 16);
        Controls.Add(web);

        puente = new Puente(new PlataformaWindows(this, web), pdfInicial);

        Load += async (_, _) => await IniciarAsync();
        FormClosing += (_, e) =>
        {
            if (!puente.HayCambios) return;
            var r = MessageBox.Show(this, Textos.T("salir.cambios"), Textos.T("app.nombre"),
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2);
            if (r != DialogResult.Yes) e.Cancel = true;
        };
        FormClosed += (_, _) =>
        {
            puente.Cerrar();
            try { web.Dispose(); } catch { }
        };
    }

    async Task IniciarAsync()
    {
        try
        {
            Directory.CreateDirectory(carpetaDatos);
            var entorno = await CoreWebView2Environment.CreateAsync(null, carpetaDatos);
            await web.EnsureCoreWebView2Async(entorno);
        }
        catch (Exception ex)
        {
            MessageBox.Show(Textos.T("inicio.error", ex.Message),
                Textos.T("app.nombre"), MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }

        var core = web.CoreWebView2;
#if DEBUG
        core.Settings.AreDevToolsEnabled = true;
        core.Settings.AreDefaultContextMenusEnabled = true;
#else
        core.Settings.AreDevToolsEnabled = false;
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.AreBrowserAcceleratorKeysEnabled = false; // sin F12, Ctrl+U, etc.
#endif
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsZoomControlEnabled = false;

        core.AddWebResourceRequestedFilter(Origen + "*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += AlPedirRecurso;
        core.WebMessageReceived += AlRecibirMensaje;
        core.NewWindowRequested += (_, e) => e.Handled = true; // nunca abrir ventanas externas
        core.NavigationStarting += (_, e) =>
        {
            if (!e.Uri.StartsWith(Origen, StringComparison.OrdinalIgnoreCase)
                && !e.Uri.Equals("about:blank", StringComparison.OrdinalIgnoreCase))
                e.Cancel = true;
        };

        core.Navigate(Origen + "index.html?idioma=" + Textos.Idioma);
    }

    void AlPedirRecurso(object? s, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var uri = new Uri(e.Request.Uri);
        var ruta = Uri.UnescapeDataString(uri.AbsolutePath).TrimStart('/');
        if (ruta == "") ruta = "index.html";

        byte[]? datos = ruta.Contains("..") ? null : Recursos.Leer(ruta);
        var entorno = web.CoreWebView2.Environment;
        if (datos == null)
        {
            e.Response = entorno.CreateWebResourceResponse(null, 404, "No encontrado", "Content-Type: text/plain");
            return;
        }
        e.Response = entorno.CreateWebResourceResponse(new MemoryStream(datos), 200, "OK",
            "Content-Type: " + Recursos.Mime(ruta) + "\r\nCache-Control: no-cache");
    }

    void AlRecibirMensaje(object? s, CoreWebView2WebMessageReceivedEventArgs e) => puente.Recibir(e.WebMessageAsJson);
}
