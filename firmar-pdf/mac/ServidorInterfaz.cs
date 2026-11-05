using System.Net;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FirmarPdf;

/// <summary>
/// Sirve la interfaz (recursos incrustados de comun) solo por loopback, con un token aleatorio en la ruta.
/// Así otras apps del equipo no pueden leer la interfaz. El puerto se recuerda entre sesiones para que
/// localStorage (firmas guardadas) conserve su origen.
/// </summary>
sealed class ServidorInterfaz : IAsyncDisposable
{
    // Puente de compatibilidad: la interfaz habla con window.chrome.webview; en Photino se usa window.external.
    const string Shim =
        "<script>(function(){if(window.chrome&&window.chrome.webview)return;var ls=[];" +
        "window.external.receiveMessage(function(m){var d=m;try{d=JSON.parse(m);}catch(e){}" +
        "ls.slice().forEach(function(f){try{f({data:d});}catch(e){console.error(e);}});});" +
        "window.chrome=window.chrome||{};" +
        "window.chrome.webview={postMessage:function(o){window.external.sendMessage(JSON.stringify(o));}," +
        "addEventListener:function(t,f){if(t==='message')ls.push(f);}," +
        "removeEventListener:function(t,f){var i=ls.indexOf(f);if(i>=0)ls.splice(i,1);}};})();</script>";

    // Solo prueba de humo del CI (PEPEPDF_PRUEBA=1): registra pedidos y errores de JavaScript por stdout.
    public static readonly bool Diag = Environment.GetEnvironmentVariable("PEPEPDF_PRUEBA") == "1";
    const string ScriptDiag =
        "<script>(function(){function m(t){try{window.webkit.messageHandlers.photinointerop.postMessage('DIAG '+t);}catch(e){}}" +
        "m('inicio external='+typeof window.external+' recv='+typeof (window.external&&window.external.receiveMessage));" +
        "addEventListener('error',function(e){m('error '+e.message+' @'+e.filename+':'+e.lineno);},true);" +
        "addEventListener('unhandledrejection',function(e){m('rechazo '+(e.reason&&(e.reason.stack||e.reason)));});" +
        "setTimeout(function(){var l=['lib/pdfjs/build/pdf.min.mjs','lib/pdfjs/web/pdf_viewer.mjs','js/estado.js','js/i18n.js','js/iconos.js','js/util.js','js/puente.js','js/visor.js','js/documento.js','js/main.js'];" +
        "(function sig(i){if(i>=l.length)return;import('./'+l[i]).then(function(){m('import ok '+l[i]);sig(i+1);},function(e){m('import FALLA '+l[i]+': '+e+' '+(e&&e.stack||''));sig(i+1);});})(0);" +
        "m('navegador '+navigator.userAgent);},3000);" +
        "['log','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){try{m('consola '+k+': '+[].map.call(arguments,String).join(' ').slice(0,300));}catch(e){}return o.apply(console,arguments);};});" +
        "document.addEventListener('DOMContentLoaded',function(){m('DOMContentLoaded');});addEventListener('load',function(){m('load');});" +
        "setTimeout(function(){var f=document.getElementById('bFirmar');m('8s estado='+document.readyState+' dataic='+document.querySelectorAll('[data-ic]').length+' hijos1='+(document.querySelector('[data-ic]')||{}).childElementCount+' firmar=['+(f&&f.textContent.trim())+'] lang='+document.documentElement.lang+' body='+document.body.dataset.estado+' arranque='+window.__arranque);},8000);" +
        "setTimeout(function(){import('./js/iconos.js').then(function(x){try{x.pintarIconos();m('5s manual iconos='+document.querySelectorAll('[data-ic] svg').length);}catch(e){m('5s manual FALLA '+e);}});},5000);" +
        "setTimeout(function(){m('8s iconos='+document.querySelectorAll('[data-ic] svg').length+' chrome.webview='+typeof (window.chrome&&window.chrome.webview));},8000);})();</script>";

    readonly string token = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
    readonly bool inyectarShim;
    WebApplication? app;
    int puerto;

    /// <param name="inyectarShim">false en pruebas con Chrome normal (ya hay modo prueba sin puente).</param>
    public ServidorInterfaz(bool inyectarShim = true) => this.inyectarShim = inyectarShim;

    public string Token => token;

    /// <summary>Arranca el servidor y devuelve la URL de index.html.</summary>
    public async Task<string> IniciarAsync(string carpetaDatos)
    {
        var archivoPuerto = Path.Combine(carpetaDatos, "puerto-interfaz.txt");
        int preferido = 0;
        try { if (File.Exists(archivoPuerto)) int.TryParse(File.ReadAllText(archivoPuerto).Trim(), out preferido); } catch { }

        foreach (var p in preferido is > 1023 and < 65536 ? new[] { preferido, 0 } : new[] { 0 })
        {
            try
            {
                app = Construir(p);
                await app.StartAsync();
                var url = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();
                puerto = new Uri(url).Port;
                break;
            }
            catch
            {
                if (p != 0) Console.Error.WriteLine($"PepePDF: el puerto guardado {p} no está disponible; se usará otro.");
                if (app != null) { try { await app.DisposeAsync(); } catch { } app = null; }
                if (p == 0) throw;
            }
        }
        try { Directory.CreateDirectory(carpetaDatos); File.WriteAllText(archivoPuerto, puerto.ToString()); } catch { }
        return $"http://127.0.0.1:{puerto}/{token}/index.html?idioma={Textos.Idioma}";
    }

    WebApplication Construir(int p)
    {
        var b = WebApplication.CreateSlimBuilder();
        b.Logging.ClearProviders();
        b.WebHost.ConfigureKestrel(k =>
        {
            k.Listen(IPAddress.Loopback, p); // solo 127.0.0.1
            k.AddServerHeader = false;
        });
        var a = b.Build();
        a.Run(Atender);
        return a;
    }

    async Task Atender(HttpContext c)
    {
        var r = c.Response;
        r.Headers["X-Content-Type-Options"] = "nosniff";
        r.Headers["Referrer-Policy"] = "no-referrer";
        r.Headers.CacheControl = "no-cache";

        // contra DNS rebinding: solo se acepta el host exacto
        if (c.Request.Host.Host != "127.0.0.1" || c.Request.Method != "GET" && c.Request.Method != "HEAD")
        {
            r.StatusCode = 403;
            return;
        }

        var ruta = Uri.UnescapeDataString(c.Request.Path.Value ?? "/").TrimStart('/');
        var marca = token + "/";
        if (!ruta.StartsWith(marca, StringComparison.Ordinal) || ruta.Contains(".."))
        {
            r.StatusCode = 404;
            return;
        }
        ruta = ruta[marca.Length..];
        if (ruta == "") ruta = "index.html";

        var datos = Recursos.Leer(ruta);
        if (datos == null) { r.StatusCode = 404; if (Diag) Console.Out.WriteLine($"DIAG pedido {ruta} -> 404"); return; }

        if (inyectarShim && ruta.Equals("index.html", StringComparison.OrdinalIgnoreCase))
        {
            // el shim va antes del primer <script>
            var html = Encoding.UTF8.GetString(datos);
            int i = html.IndexOf("<script", StringComparison.OrdinalIgnoreCase);
            var extra = (Diag ? ScriptDiag : "") + Shim;
            html = i >= 0 ? html.Insert(i, extra) : html + extra;
            datos = Encoding.UTF8.GetBytes(html);
        }

        r.StatusCode = 200;
        r.ContentType = Recursos.Mime(ruta);
        r.ContentLength = datos.Length;
        if (c.Request.Method != "HEAD") await r.Body.WriteAsync(datos);
        if (Diag) Console.Out.WriteLine($"DIAG pedido {ruta} -> 200 {r.ContentType}");
    }

    public async ValueTask DisposeAsync()
    {
        if (app == null) return;
        try { await app.StopAsync(); await app.DisposeAsync(); } catch { }
        app = null;
    }
}
