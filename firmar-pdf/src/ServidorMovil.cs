using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QRCoder;

namespace FirmarPdf;

/// <summary>Servidor de red mínimo, encendido solo mientras el usuario firma con el celular.</summary>
sealed class ServidorMovil : IAsyncDisposable
{
    const int PuertoBase = 47615;
    const int MaxCuerpo = 3 * 1024 * 1024;
    const int MaxCuerpoFoto = 25 * 1024 * 1024;
    const int MaxFotos = 10;
    const int MaxLado = 4000;
    // 5 min; solo las pruebas automáticas la acortan (FIRMARPDF_PRUEBA_VIGENCIA_S, en segundos)
#if DEBUG
    static readonly TimeSpan Vigencia = int.TryParse(Environment.GetEnvironmentVariable("FIRMARPDF_PRUEBA_VIGENCIA_S"), out var vs) && vs > 0 && vs <= 300 ? TimeSpan.FromSeconds(vs) : TimeSpan.FromMinutes(5);
#else
    static readonly TimeSpan Vigencia = TimeSpan.FromMinutes(5);
#endif

    readonly Action<string> alRecibirFirma;
    readonly Action alVencer;
    readonly Action<string[]>? alRecibirFotos;
    readonly Action? alConectar;
    int avisoConectado; // 1 = ya se avisó en esta sesión
    readonly SemaphoreSlim cerrojo = new(1, 1);
    WebApplication? app;
    string? token;
    string modo = "firma"; // "firma" | "foto": cada sesión (y su token) sirve para un solo tipo
    CancellationTokenSource? vencimiento;

    public ServidorMovil(Action<string> alRecibirFirma, Action alVencer, Action<string[]>? alRecibirFotos = null, Action? alConectar = null)
    {
        this.alConectar = alConectar;
        this.alRecibirFirma = alRecibirFirma;
        this.alVencer = alVencer;
        this.alRecibirFotos = alRecibirFotos;
    }

    /// <summary>Enciende el servidor y devuelve (url, qr como data URL PNG). Lanza excepción con mensaje claro si falla.</summary>
    public async Task<(string url, string qr)> IniciarAsync(string modo = "firma")
    {
        await cerrojo.WaitAsync();
        try { this.modo = modo == "foto" ? "foto" : "firma"; return await IniciarInterno(); }
        finally { cerrojo.Release(); }
    }

    async Task<(string url, string qr)> IniciarInterno()
    {
        await DetenerInterno();

        var ip = BuscarIp() ?? throw new InvalidOperationException(
            Textos.T("movil.sinRed"));

        token = Token();
        Volatile.Write(ref avisoConectado, 0);
        int puerto = 0;
        Exception? ultimo = null;
        for (int p = PuertoBase; p <= PuertoBase + 10; p++)
        {
            try
            {
                app = Construir(p);
                await app.StartAsync();
                puerto = p;
                break;
            }
            catch (Exception ex)
            {
                ultimo = ex;
                if (app != null) { try { await app.DisposeAsync(); } catch { } app = null; }
            }
        }
        if (puerto == 0)
            throw new InvalidOperationException(Textos.T("movil.noEncendio", ultimo?.Message));

        vencimiento = new CancellationTokenSource();
        var cts = vencimiento;
        _ = Task.Delay(Vigencia, cts.Token).ContinueWith(async t =>
        {
            if (t.IsCanceled) return;
            await cerrojo.WaitAsync();
            bool vencio = false;
            try
            {
                // solo si sigue siendo la misma sesión
                if (ReferenceEquals(vencimiento, cts)) { await DetenerInterno(); vencio = true; }
            }
            finally { cerrojo.Release(); }
            if (vencio) { try { alVencer(); } catch { } }
        }, TaskScheduler.Default);

        var url = $"http://{ip}:{puerto}/f/{token}?l={Textos.Idioma}";
        return (url, GenerarQr(url));
    }

    WebApplication Construir(int puerto)
    {
        var b = WebApplication.CreateSlimBuilder();
        b.Logging.ClearProviders();
        b.WebHost.ConfigureKestrel(k =>
        {
            k.Listen(IPAddress.Any, puerto);
            k.Limits.MaxRequestBodySize = modo == "foto" ? MaxCuerpoFoto : MaxCuerpo;
            k.AddServerHeader = false;
        });
        var a = b.Build();

        a.MapGet("/f/{t}", (string t, HttpContext c) =>
        {
            if (!TokenValido(t))
            {
                c.Response.Headers["X-Content-Type-Options"] = "nosniff";
                return Results.Content(PaginaInvalida(), "text/html; charset=utf-8", Encoding.UTF8, statusCode: 404);
            }
            var html = Recursos.Leer(modo == "foto" ? "movil-foto.html" : "movil.html");
            if (html == null) return Results.NotFound();
            c.Response.Headers.CacheControl = "no-store";
            c.Response.Headers["X-Content-Type-Options"] = "nosniff";
            // aviso al PC: el celular abrió la página (solo con token válido, una vez por sesión; no consume el token)
            if (Interlocked.Exchange(ref avisoConectado, 1) == 0) { try { alConectar?.Invoke(); } catch { } }
            return Results.Bytes(html, "text/html; charset=utf-8");
        });

        a.MapPost("/f/{t}/firma", async (string t, HttpContext c) =>
        {
            if (!TokenValido(t) || modo != "firma") return Results.NotFound();
            var sesion = vencimiento;
            string? png;
            try
            {
                using var doc = await JsonDocument.ParseAsync(c.Request.Body);
                png = doc.RootElement.GetProperty("png").GetString();
            }
            catch { return Results.BadRequest(new { ok = false }); }

            const string cab = "data:image/png;base64,";
            if (png == null || !png.StartsWith(cab, StringComparison.Ordinal)) return Results.BadRequest(new { ok = false });
            try
            {
                var bytes = Convert.FromBase64String(png.Substring(cab.Length));
                // firma PNG: 89 50 4E 47
                if (bytes.Length < 8 || bytes[0] != 0x89 || bytes[1] != 0x50 || bytes[2] != 0x4E || bytes[3] != 0x47)
                    return Results.BadRequest(new { ok = false });
                // IHDR: ancho y alto (big-endian) en los bytes 16-23
                if (bytes.Length < 24 || !EsIhdr(bytes)) return Results.BadRequest(new { ok = false });
                long ancho = ((long)bytes[16] << 24) | ((long)bytes[17] << 16) | ((long)bytes[18] << 8) | bytes[19];
                long alto = ((long)bytes[20] << 24) | ((long)bytes[21] << 16) | ((long)bytes[22] << 8) | bytes[23];
                if (ancho <= 0 || alto <= 0 || ancho > 4000 || alto > 4000)
                    return Results.BadRequest(new { ok = false });
            }
            catch { return Results.BadRequest(new { ok = false }); }

            // de un solo uso, de forma atómica: solo una petición se lleva el token
            // (CompareExchange compara por referencia: hay que usar la misma instancia guardada en el campo)
            var vigente = Volatile.Read(ref token);
            if (vigente == null || !TokenValido(t) ||
                !ReferenceEquals(Interlocked.CompareExchange(ref token, null, vigente), vigente))
                return Results.NotFound();
            alRecibirFirma(png);
            _ = Task.Delay(3000).ContinueWith(async _ =>
            {
                await cerrojo.WaitAsync();
                try { if (ReferenceEquals(vencimiento, sesion)) await DetenerInterno(); }
                finally { cerrojo.Release(); }
            }, TaskScheduler.Default);
            return Results.Json(new { ok = true });
        });

        a.MapPost("/f/{t}/fotos", async (string t, HttpContext c) =>
        {
            if (!TokenValido(t) || modo != "foto" || alRecibirFotos == null) return Results.NotFound();
            var sesion = vencimiento;
            var salida = new List<string>();
            try
            {
                using var doc = await JsonDocument.ParseAsync(c.Request.Body);
                var arr = doc.RootElement.GetProperty("fotos");
                if (arr.ValueKind != JsonValueKind.Array) return Results.BadRequest(new { ok = false });
                int n = arr.GetArrayLength();
                if (n < 1 || n > MaxFotos) return Results.BadRequest(new { ok = false });
                foreach (var el in arr.EnumerateArray())
                {
                    var s = el.GetString();
                    if (s == null) return Results.BadRequest(new { ok = false });
                    string[] cabs = { "data:image/jpeg;base64,", "data:image/png;base64," };
                    var cab = cabs.FirstOrDefault(x => s.StartsWith(x, StringComparison.Ordinal));
                    if (cab == null) return Results.BadRequest(new { ok = false });
                    var b64 = s.Substring(cab.Length);
                    var tipo = TipoImagen(Convert.FromBase64String(b64));
                    if (tipo == null) return Results.BadRequest(new { ok = false });
                    salida.Add("data:image/" + tipo + ";base64," + b64); // el tipo sale de los bytes, no de lo que diga el celular
                }
            }
            catch { return Results.BadRequest(new { ok = false }); }

            // de un solo uso, de forma atómica (igual que la firma)
            var vigente = Volatile.Read(ref token);
            if (vigente == null || !TokenValido(t) ||
                !ReferenceEquals(Interlocked.CompareExchange(ref token, null, vigente), vigente))
                return Results.NotFound();
            alRecibirFotos(salida.ToArray());
            _ = Task.Delay(3000).ContinueWith(async _ =>
            {
                await cerrojo.WaitAsync();
                try { if (ReferenceEquals(vencimiento, sesion)) await DetenerInterno(); }
                finally { cerrojo.Release(); }
            }, TaskScheduler.Default);
            return Results.Json(new { ok = true });
        });

        a.MapFallback(() => Results.NotFound());
        return a;
    }

    /// <summary>El primer bloque de un PNG debe ser IHDR (bytes 12-15); si no, las medidas leídas no valen.</summary>
    static bool EsIhdr(byte[] b) => b.Length >= 24 && b[12] == 0x49 && b[13] == 0x48 && b[14] == 0x44 && b[15] == 0x52;

    /// <summary>"png" o "jpeg" si los bytes son una imagen de ese tipo con dimensiones legibles de hasta MaxLado px; si no, null.</summary>
    static string? TipoImagen(byte[] b)
    {
        if (b.Length >= 24 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47)
        {
            if (!EsIhdr(b)) return null;
            long ancho = ((long)b[16] << 24) | ((long)b[17] << 16) | ((long)b[18] << 8) | b[19];
            long alto = ((long)b[20] << 24) | ((long)b[21] << 16) | ((long)b[22] << 8) | b[23];
            return ancho > 0 && alto > 0 && ancho <= MaxLado && alto <= MaxLado ? "png" : null;
        }
        if (b.Length >= 4 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF)
        {
            int p = 2;
            while (p + 3 < b.Length)
            {
                if (b[p] != 0xFF) return null;
                while (p < b.Length && b[p] == 0xFF) p++; // relleno
                if (p >= b.Length) return null;
                int m = b[p++];
                if (m == 0x01 || (m >= 0xD0 && m <= 0xD8)) continue; // marcadores sin longitud
                if (m == 0xD9 || m == 0xDA) return null;            // fin o datos sin haber visto el SOF
                if (p + 1 >= b.Length) return null;
                int len = (b[p] << 8) | b[p + 1];
                if (len < 2) return null;
                bool sof = m >= 0xC0 && m <= 0xCF && m != 0xC4 && m != 0xC8 && m != 0xCC;
                if (sof)
                {
                    if (len < 8 || p + 6 >= b.Length) return null;
                    int alto = (b[p + 3] << 8) | b[p + 4];
                    int ancho = (b[p + 5] << 8) | b[p + 6];
                    return ancho > 0 && alto > 0 && ancho <= MaxLado && alto <= MaxLado ? "jpeg" : null;
                }
                p += len;
            }
        }
        return null;
    }

    bool TokenValido(string t)
    {
        var actual = token;
        if (actual == null || t.Length != actual.Length) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(t), Encoding.ASCII.GetBytes(actual));
    }

    public async Task DetenerAsync()
    {
        await cerrojo.WaitAsync();
        try { await DetenerInterno(); }
        finally { cerrojo.Release(); }
    }

    async Task DetenerInterno()
    {
        token = null;
        try { vencimiento?.Cancel(); } catch { }
        vencimiento = null;
        var a = app;
        app = null;
        if (a != null)
        {
            try { await a.StopAsync(TimeSpan.FromSeconds(1)); } catch { }
            try { await a.DisposeAsync(); } catch { }
        }
    }

    public ValueTask DisposeAsync() => new(DetenerAsync());

    static string Token()
    {
        const string letras = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var sb = new StringBuilder(32);
        for (int i = 0; i < 32; i++) sb.Append(letras[RandomNumberGenerator.GetInt32(letras.Length)]);
        return sb.ToString();
    }

    static string GenerarQr(string url)
    {
        using var gen = new QRCodeGenerator();
        using var datos = gen.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);
        var png = new PngByteQRCode(datos).GetGraphic(10);
        return "data:image/png;base64," + Convert.ToBase64String(png);
    }

    /// <summary>IPv4 de la interfaz activa (Wi-Fi/Ethernet) con puerta de enlace; si no hay, una IPv4 privada activa sin puerta.</summary>
    static string? BuscarIp()
    {
        string? conPuerta = null, sinPuerta = null;
        foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (ni.OperationalStatus != OperationalStatus.Up) continue;
            if (ni.NetworkInterfaceType is not (NetworkInterfaceType.Wireless80211 or NetworkInterfaceType.Ethernet
                or NetworkInterfaceType.GigabitEthernet or NetworkInterfaceType.FastEthernetT)) continue;
            var desc = (ni.Description + " " + ni.Name).ToLowerInvariant();
            if (desc.Contains("virtual") || desc.Contains("vmware") || desc.Contains("vbox") ||
                desc.Contains("hyper-v") || desc.Contains("vethernet") || desc.Contains("tap-windows") ||
                desc.Contains("vpn") || desc.Contains("loopback")) continue;
            var props = ni.GetIPProperties();
            var ip = props.UnicastAddresses.FirstOrDefault(u => u.Address.AddressFamily == AddressFamily.InterNetwork
                                                                && !IPAddress.IsLoopback(u.Address)
                                                                && !EsLinkLocal(u.Address));
            if (ip == null) continue;
            bool puerta = props.GatewayAddresses.Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork
                                                          && !g.Address.Equals(IPAddress.Any));
            if (puerta)
            {
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Wireless80211) return ip.Address.ToString();
                conPuerta ??= ip.Address.ToString();
            }
            else if (EsPrivada(ip.Address)) sinPuerta ??= ip.Address.ToString();
        }
        return conPuerta ?? sinPuerta;
    }

    static bool EsLinkLocal(IPAddress a) { var b = a.GetAddressBytes(); return b[0] == 169 && b[1] == 254; }

    static bool EsPrivada(IPAddress a)
    {
        var b = a.GetAddressBytes();
        return b[0] == 10 || (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168);
    }

    static string PaginaInvalida() => "<!doctype html><html lang=\"" + Textos.Idioma + "\"><head><meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + Textos.T("app.nombre") + "</title></head>" +
        "<body style=\"font-family:system-ui,sans-serif;font-size:22px;text-align:center;padding:48px 24px;background:#fff;color:#111\">" +
        "<p>" + System.Net.WebUtility.HtmlEncode(Textos.T("movil.paginaInvalida")) + "</p></body></html>";
}
