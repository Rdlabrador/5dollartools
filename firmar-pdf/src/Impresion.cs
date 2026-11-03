using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace FirmarPdf;

/// <summary>Ventana secundaria que muestra el PDF con el visor de Edge y abre el diálogo de impresión.</summary>
sealed class Impresion : Form
{
    readonly WebView2 web = new() { Dock = DockStyle.Fill };
    readonly Label aviso = new()
    {
        Dock = DockStyle.Top, Height = 48, Visible = false, Font = new Font("Segoe UI", 13f),
        BackColor = Color.FromArgb(245, 196, 0), ForeColor = Color.Black, TextAlign = ContentAlignment.MiddleCenter,
    };
    readonly string archivo;
    readonly string carpetaDatos;
    readonly TaskCompletionSource<bool> resultado = new();

    /// <summary>true si se abrió el diálogo de impresión; false si hubo problema o se cerró antes.</summary>
    public Task<bool> Resultado => resultado.Task;

    public Impresion(string archivoTemporal, string carpetaDatos, Icon? icono)
    {
        archivo = archivoTemporal;
        this.carpetaDatos = carpetaDatos;
        Text = Textos.T("imprimir.titulo", Textos.T("app.nombre"));
        Size = new Size(1000, 750);
        StartPosition = FormStartPosition.CenterScreen;
        if (icono != null) Icon = icono;
        Controls.Add(web);
        Controls.Add(aviso);
        aviso.BringToFront();
        web.SendToBack();
        Load += async (_, _) => await IniciarAsync();
        FormClosed += (_, _) =>
        {
            try { web.Dispose(); } catch { }
            try { File.Delete(archivo); } catch { }
            resultado.TrySetResult(false);
        };
    }

    async Task IniciarAsync()
    {
        try
        {
            var entorno = await CoreWebView2Environment.CreateAsync(null, carpetaDatos);
            await web.EnsureCoreWebView2Async(entorno);
            web.CoreWebView2.NavigationCompleted += async (_, e) =>
            {
                if (!e.IsSuccess) { Avisar(Textos.T("imprimir.noMostrar")); resultado.TrySetResult(false); return; }
                try
                {
                    await Task.Delay(600); // da tiempo al visor de PDF
                    web.CoreWebView2.ShowPrintUI(CoreWebView2PrintDialogKind.System);
                    resultado.TrySetResult(true);
                }
                catch
                {
                    Avisar(Textos.T("imprimir.ctrlP"));
                    resultado.TrySetResult(false);
                }
            };
            web.CoreWebView2.Navigate(new Uri(archivo).AbsoluteUri);
        }
        catch (Exception ex)
        {
            Avisar(Textos.T("imprimir.preparar", ex.Message));
            resultado.TrySetResult(false);
        }
    }

    void Avisar(string texto)
    {
        aviso.Text = texto;
        aviso.Visible = true;
    }
}
