using Microsoft.Web.WebView2.Core;

namespace FirmarPdf;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Textos.Iniciar(VentanaPrincipal.RaizDatos());

        try
        {
            var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (string.IsNullOrEmpty(version)) throw new WebView2RuntimeNotFoundException();
        }
        catch (Exception)
        {
            MessageBox.Show(Textos.T("webview.falta", Textos.T("app.nombre")),
                Textos.T("app.nombre"), MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        string? pdfInicial = args.FirstOrDefault(a => a.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) && File.Exists(a));
        Application.Run(new VentanaPrincipal(pdfInicial));
    }
}
