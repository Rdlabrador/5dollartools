using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using FirmarPdf.Motor;
using Microsoft.Web.WebView2.WinForms;

namespace FirmarPdf;

/// <summary>Ventana principal: aloja la interfaz (WebView2) y atiende los mensajes del contrato.</summary>
sealed class VentanaPrincipal : Form
{
    const string Origen = "https://app.local/";

    readonly WebView2 web = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(12, 13, 16) };
    readonly string carpetaDatos = Path.Combine(RaizDatos(), "WebView2");
    internal static string RaizDatos()
    {
#if DEBUG
        // Solo para pruebas (no existe en Release): FIRMARPDF_DATOS=<carpeta> aísla los datos de la copia de prueba de los del usuario.
        var prueba = Environment.GetEnvironmentVariable("FIRMARPDF_DATOS");
        if (!string.IsNullOrEmpty(prueba)) return prueba;
#endif
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FirmarPDF");
    }
    readonly string archivoCarpeta;
    readonly string? pdfInicial;
    readonly ServidorMovil servidor;
    string? ultimaCarpeta;
    bool hayCambios;

    public VentanaPrincipal(string? pdfInicial)
    {
        this.pdfInicial = pdfInicial;
        archivoCarpeta = Path.Combine(Path.GetDirectoryName(carpetaDatos)!, "ultima-carpeta.txt");
        Text = Textos.T("app.nombre");
        try { Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath ?? Application.ExecutablePath); } catch { }
        MinimumSize = new Size(900, 600);
        WindowState = FormWindowState.Maximized;
        BackColor = Color.FromArgb(12, 13, 16);
        Controls.Add(web);

        try { if (File.Exists(archivoCarpeta)) ultimaCarpeta = File.ReadAllText(archivoCarpeta).Trim(); } catch { }
        if (pdfInicial != null) RecordarCarpeta(pdfInicial);

        servidor = new ServidorMovil(
            png => BeginInvoke(() => Enviar(new JsonObject { ["tipo"] = "firmaMovil", ["png"] = png })),
            () => BeginInvoke(() => Enviar(new JsonObject { ["tipo"] = "movilVencido" })),
            fotos => BeginInvoke(() =>
            {
                var imagenes = new JsonArray();
                foreach (var f in fotos) imagenes.Add(f);
                Enviar(new JsonObject { ["tipo"] = "fotosMovil", ["imagenes"] = imagenes });
            }),
            () => BeginInvoke(() => Enviar(new JsonObject { ["tipo"] = "movilConectado" })));

        Load += async (_, _) => await IniciarAsync();
        FormClosing += (_, e) =>
        {
            if (!hayCambios) return;
            var r = MessageBox.Show(this, Textos.T("salir.cambios"), Textos.T("app.nombre"),
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2);
            if (r != DialogResult.Yes) e.Cancel = true;
        };
        FormClosed += (_, _) =>
        {
            try { Task.Run(() => servidor.DetenerAsync()).Wait(2000); } catch { }
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

    void AlRecibirMensaje(object? s, CoreWebView2WebMessageReceivedEventArgs e)
    {
        JsonNode? msg;
        try { msg = JsonNode.Parse(e.WebMessageAsJson); }
        catch { return; } // JSON inválido: se ignora
        if (msg is not JsonObject || msg["tipo"] is not JsonValue vt || !vt.TryGetValue<string>(out var tipo)) return;
        JsonNode? idPeticion = msg["id"]?.DeepClone();
        try
        {
            switch (tipo)
            {
                case "abrirArchivos": AbrirArchivos(msg); break;
                case "guardarArchivo": GuardarArchivo(msg); break;
                case "guardarVarios": GuardarVarios(msg); break;
                case "elegirCarpeta": ElegirCarpeta(msg); break;
                case "escribirEnCarpeta": EscribirEnCarpeta(msg); break;
                case "abrirCarpeta": AbrirCarpeta(msg); break;
                case "limpiarPdf": LimpiarPdf(msg); break;
                case "analizarPdf": AnalizarPdf(msg); break;
                case "comprimirPdf": ComprimirPdf(msg); break;
                case "protegerPdf": ProtegerPdf(msg); break;
                case "quitarContrasena": QuitarContrasena(msg); break;
                case "crearDocx": CrearDocx(msg); break;
                case "ocr": Ocr(msg); break;
                case "ocrIdiomas": OcrIdiomas(msg); break;
                case "officeDisponible": OfficeDisponible(msg); break;
                case "officeAPdf": OfficeAPdf(msg); break;
                case "sucio": hayCambios = msg["valor"] is JsonValue vv && vv.TryGetValue<bool>(out var b) && b; break;
                case "listo": AlEstarListo(); break;
                case "idioma": Textos.Cambiar(Texto(msg["idioma"])); break;
                case "abrir": Abrir(); break;
                case "guardar": Guardar(Texto(msg["datos"]), Texto(msg["nombre"])); break;
                case "imprimir": Imprimir(Texto(msg["datos"])); break;
                case "movilIniciar": _ = IniciarMovilAsync(Texto(msg["modo"]) == "foto" ? "foto" : "firma"); break;
                case "movilCancelar": _ = servidor.DetenerAsync(); break;
            }
        }
        catch (Exception ex)
        {
            Error(Textos.T("error.problema", ex.Message), idPeticion);
        }
    }

    static string? Texto(JsonNode? n) => n is JsonValue v && v.TryGetValue<string>(out var t) ? t : null;

    void Enviar(JsonObject obj)
    {
        if (web.CoreWebView2 == null) return;
        web.CoreWebView2.PostWebMessageAsJson(obj.ToJsonString());
    }

    void Error(string mensaje, JsonNode? id = null)
    {
        var o = new JsonObject { ["tipo"] = "error", ["mensaje"] = mensaje };
        if (id != null) o["id"] = id.DeepClone();
        Enviar(o);
    }

    static bool Booleano(JsonNode? n) => n is JsonValue v && v.TryGetValue<bool>(out var b) && b;

    void EnviarPdf(string ruta)
    {
        RecordarCarpeta(ruta);
        EnFondo(null, "error.abrirUno", () =>
        {
            var bytes = File.ReadAllBytes(ruta);
            bool protegido;
            try { protegido = Motor.OperacionesPdf.RequiereContrasena(bytes); }
            catch { protegido = false; } // dañado: la interfaz lo avisa al intentar abrirlo
            return new JsonObject
            {
                ["tipo"] = "pdf",
                ["nombre"] = Path.GetFileName(ruta),
                ["datos"] = Convert.ToBase64String(bytes),
                ["protegido"] = protegido,
            };
        });
    }

    /// <summary>Ejecuta el trabajo fuera del hilo de UI y envía la respuesta (o un error con el mismo id) de vuelta en el hilo de UI.</summary>
    void EnFondo(JsonNode? id, string claveError, Func<JsonObject> trabajo)
    {
        var idCopia = id?.DeepClone();
        Task.Run(() =>
        {
            JsonObject resp;
            try { resp = trabajo(); }
            catch (Exception ex)
            {
                resp = new JsonObject { ["tipo"] = "error", ["mensaje"] = Textos.T(claveError, ex.Message) };
                if (idCopia != null) resp["id"] = idCopia;
            }
            try { BeginInvoke(() => Enviar(resp)); } catch { /* ventana cerrada */ }
        });
    }

    void AlEstarListo()
    {
        if (pdfInicial == null) return;
        EnviarPdf(pdfInicial);
    }

    void Abrir()
    {
        using var d = new OpenFileDialog
        {
            Title = Textos.T("dlg.abrirPdf"),
            Filter = Textos.Filtro("filtro.pdf", "*.pdf"),
            InitialDirectory = CarpetaInicial(),
        };
        if (d.ShowDialog(this) != DialogResult.OK) return;
        EnviarPdf(d.FileName);
    }

    void Guardar(string? datos, string? nombre)
    {
        if (string.IsNullOrEmpty(datos)) { Error(Textos.T("error.nadaGuardar")); return; }
        nombre = LimpiarNombre(nombre ?? Textos.T("nombre.firmado"));
        using var d = new SaveFileDialog
        {
            Title = Textos.T("dlg.guardarPdfFirmado"),
            Filter = Textos.Filtro("filtro.pdf", "*.pdf"),
            FileName = nombre,
            InitialDirectory = CarpetaInicial(),
            OverwritePrompt = true,
            DefaultExt = "pdf",
            AddExtension = true,
        };
        if (d.ShowDialog(this) != DialogResult.OK) { Enviar(new JsonObject { ["tipo"] = "cancelado" }); return; }
        var destino = d.FileName;
        RecordarCarpeta(destino);
        EnFondo(null, "error.guardarUno", () =>
        {
            File.WriteAllBytes(destino, Convert.FromBase64String(datos));
            return new JsonObject { ["tipo"] = "guardado", ["ruta"] = destino };
        });
    }

    // ---- mensajes con id (la respuesta devuelve el mismo id): abrirArchivos, guardarArchivo, guardarVarios ----
    const string ExtImagenes = "*.jpg;*.jpeg;*.png;*.bmp;*.gif;*.tif;*.tiff;*.webp";

    void AbrirArchivos(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        var tipos = Texto(msg["tipos"]) ?? "pdf";
        var filtro = tipos switch
        {
            "imagenes" => Textos.Filtro("filtro.imagenes", ExtImagenes),
            "pdf+imagenes" => Textos.Filtro("filtro.pdfImagenes", "*.pdf;" + ExtImagenes),
            "office" => Textos.T("filtro.office") + "|*.doc;*.docx;*.xls;*.xlsx;*.ppt;*.pptx",
            _ => Textos.Filtro("filtro.pdf", "*.pdf"),
        };
        using var d = new OpenFileDialog
        {
            Title = Texto(msg["titulo"]) ?? Textos.T("dlg.abrirArchivos"),
            Filter = filtro,
            Multiselect = Booleano(msg["multiple"]),
            InitialDirectory = CarpetaInicial(),
        };
        if (d.ShowDialog(this) != DialogResult.OK)
        {
            Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id });
            return;
        }
        var rutas = d.FileNames;
        RecordarCarpeta(rutas[0]);
        EnFondo(id, rutas.Length == 1 ? "error.abrirUno" : "error.abrirVarios", () =>
        {
            var lista = new JsonArray();
            foreach (var ruta in rutas)
                lista.Add(new JsonObject { ["nombre"] = Path.GetFileName(ruta), ["datos"] = Convert.ToBase64String(File.ReadAllBytes(ruta)) });
            return new JsonObject { ["tipo"] = "archivos", ["lista"] = lista, ["id"] = id?.DeepClone() };
        });
    }

#if DEBUG
    // Solo para pruebas (no existe en Release): con FIRMARPDF_PRUEBA_GUARDAR=<carpeta> se guarda directo ahí, sin diálogo.
    static string? DestinoPrueba(string nombre)
    {
        var carpeta = Environment.GetEnvironmentVariable("FIRMARPDF_PRUEBA_GUARDAR");
        if (string.IsNullOrEmpty(carpeta)) return null;
        Directory.CreateDirectory(carpeta);
        return Path.Combine(carpeta, Path.GetFileName(nombre));
    }
#endif

    void GuardarArchivo(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        var datos = Texto(msg["datos"]);
        if (string.IsNullOrEmpty(datos)) { Error(Textos.T("error.nadaGuardar"), id); return; }
        var tipo = (Texto(msg["tipo"]) ?? "pdf").ToLowerInvariant();
        var (filtro, ext) = tipo switch
        {
            "png" => (Textos.Filtro("filtro.png", "*.png"), "png"),
            "jpg" => (Textos.Filtro("filtro.jpg", "*.jpg;*.jpeg"), "jpg"),
            "docx" => (Textos.Filtro("filtro.docx", "*.docx"), "docx"),
            "zip" => (Textos.Filtro("filtro.zip", "*.zip"), "zip"),
            "txt" => (Textos.Filtro("filtro.txt", "*.txt"), "txt"),
            _ => (Textos.Filtro("filtro.pdf", "*.pdf"), "pdf"),
        };
        using var d = new SaveFileDialog
        {
            Title = Textos.T("dlg.guardarArchivo"),
            Filter = filtro,
            FileName = LimpiarNombre(Texto(msg["nombre"]) ?? Textos.T("nombre.documento") + "." + ext),
            InitialDirectory = CarpetaInicial(),
            OverwritePrompt = true,
            DefaultExt = ext,
            AddExtension = true,
        };
        string destino;
#if DEBUG
        var dp = DestinoPrueba(d.FileName);
        if (dp != null) destino = dp;
        else
#endif
        {
            if (d.ShowDialog(this) != DialogResult.OK) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
            destino = d.FileName;
            RecordarCarpeta(destino);
        }
        EnFondo(id, "error.guardarUno", () =>
        {
            File.WriteAllBytes(destino, Convert.FromBase64String(datos));
            return new JsonObject { ["tipo"] = "guardado", ["ruta"] = destino, ["id"] = id?.DeepClone() };
        });
    }

    void GuardarVarios(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        if (msg["archivos"] is not JsonArray archivos || archivos.Count == 0) { Error(Textos.T("error.nadaGuardar"), id); return; }
        using var d = new FolderBrowserDialog { Description = Textos.T("dlg.elegirCarpeta"), UseDescriptionForTitle = true, InitialDirectory = CarpetaInicial() };
        if (d.ShowDialog(this) != DialogResult.OK) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
        var carpeta = d.SelectedPath;
        PermitirCarpeta(carpeta);
        RecordarCarpetaElegida(carpeta);
        EnFondo(id, "error.guardarVarios", () =>
        {
            var (nombres, error, fallidos) = EscribirLote(carpeta, archivos);
            if (nombres.Count == 0)
                throw new IOException(error ?? Textos.T("error.nadaGuardar"));
            try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(carpeta) { UseShellExecute = true }); } catch { }
            var r = new JsonObject { ["tipo"] = "guardado", ["ruta"] = carpeta, ["cantidad"] = nombres.Count, ["id"] = id?.DeepClone() };
            if (fallidos > 0) { r["fallidos"] = fallidos; r["error"] = error; }
            return r;
        });
    }

    // ---- carpetas por lotes: elegirCarpeta / escribirEnCarpeta / abrirCarpeta ----
    // Solo se escribe en carpetas que el usuario eligió en esta sesión (la interfaz no puede apuntar a otra parte).
    readonly HashSet<string> carpetasPermitidas = new(StringComparer.OrdinalIgnoreCase);

    static string Normalizar(string ruta) => Path.GetFullPath(ruta).TrimEnd('\\', '/');

    void PermitirCarpeta(string ruta) { lock (carpetasPermitidas) carpetasPermitidas.Add(Normalizar(ruta)); }

    bool EsCarpetaPermitida(string? ruta)
    {
        if (string.IsNullOrWhiteSpace(ruta)) return false;
        try { lock (carpetasPermitidas) return carpetasPermitidas.Contains(Normalizar(ruta)); }
        catch { return false; }
    }

    void RecordarCarpetaElegida(string carpeta)
    {
        ultimaCarpeta = carpeta;
        try { File.WriteAllText(archivoCarpeta, carpeta); } catch { }
    }

    void ElegirCarpeta(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        using var d = new FolderBrowserDialog
        {
            Description = Texto(msg["titulo"]) ?? Textos.T("dlg.elegirCarpeta"),
            UseDescriptionForTitle = true,
            InitialDirectory = CarpetaInicial(),
        };
        if (d.ShowDialog(this) != DialogResult.OK) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
        PermitirCarpeta(d.SelectedPath);
        RecordarCarpetaElegida(d.SelectedPath);
        Enviar(new JsonObject { ["tipo"] = "carpeta", ["ruta"] = d.SelectedPath, ["id"] = id });
    }

    void EscribirEnCarpeta(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        var carpeta = Texto(msg["carpeta"]);
        if (!EsCarpetaPermitida(carpeta)) { Error(Textos.T("error.carpetaNoPermitida"), id); return; }
        if (msg["archivos"] is not JsonArray archivos || archivos.Count == 0) { Error(Textos.T("error.nadaGuardar"), id); return; }
        EnFondo(id, "error.guardarLote", () =>
        {
            var (nombres, error, fallidos) = EscribirLote(carpeta!, archivos);
            var lista = new JsonArray();
            foreach (var n in nombres) lista.Add(n);
            var r = new JsonObject { ["tipo"] = "escritos", ["id"] = id?.DeepClone(), ["nombres"] = lista, ["fallidos"] = fallidos };
            if (error != null) r["error"] = error;
            return r;
        });
    }

    void AbrirCarpeta(JsonNode msg)
    {
        var carpeta = Texto(msg["carpeta"]);
        if (!EsCarpetaPermitida(carpeta)) return;
        try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(carpeta!) { UseShellExecute = true }); } catch { }
    }

    /// <summary>Escribe cada archivo (nombre saneado, sin sobrescribir). Si uno falla sigue con los demás. Se llama fuera del hilo de UI.</summary>
    static (List<string> nombres, string? error, int fallidos) EscribirLote(string carpeta, JsonArray archivos)
    {
        var nombres = new List<string>();
        string? error = null;
        int fallidos = 0;
        foreach (var a in archivos)
        {
            try
            {
                var nombre = Nombres.Sanear(Texto(a?["nombre"]));
                if (nombre == null) throw new IOException(Textos.T("error.nombreInvalido"));
                var b64 = Texto(a?["datos"]);
                if (string.IsNullOrEmpty(b64)) throw new IOException(Textos.T("error.archivoVacio", nombre));
                nombres.Add(Nombres.EscribirSinSobrescribir(carpeta, nombre, Convert.FromBase64String(b64)));
            }
            catch (Exception ex)
            {
                fallidos++;
                error ??= ex.Message;
            }
        }
        return (nombres, error, fallidos);
    }

    // ---- fase 4: Word, OCR y Office (todos con id) ----
    static readonly JsonSerializerOptions OpcionesJson = new(JsonSerializerDefaults.Web);

    /// <summary>Como EnFondo, pero para trabajo asíncrono (OCR): no bloquea ningún hilo mientras espera.</summary>
    void EnFondoAsync(JsonNode? id, string claveError, Func<Task<JsonObject>> trabajo)
    {
        var idCopia = id?.DeepClone();
        Task.Run(async () =>
        {
            JsonObject resp;
            try { resp = await trabajo(); }
            catch (Exception ex)
            {
                resp = new JsonObject { ["tipo"] = "error", ["mensaje"] = Textos.T(claveError, ex.Message) };
                if (idCopia != null) resp["id"] = idCopia;
            }
            try { BeginInvoke(() => Enviar(resp)); } catch { /* ventana cerrada */ }
        });
    }

    void CrearDocx(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        DocumentoWord? doc;
        try { doc = msg["documento"]?.Deserialize<DocumentoWord>(OpcionesJson); }
        catch (Exception ex) { Error(Textos.T("word.invalido", ex.Message), id); return; }
        if (doc == null || doc.Paginas.Count == 0) { Error(Textos.T("error.nadaGuardar"), id); return; }
        var nombre = LimpiarNombre(Texto(msg["nombre"]) ?? Textos.T("nombre.documento") + ".docx");
        if (!nombre.EndsWith(".docx", StringComparison.OrdinalIgnoreCase)) nombre = Path.ChangeExtension(nombre, ".docx");

        using var d = new SaveFileDialog
        {
            Title = Textos.T("dlg.guardarWord"),
            Filter = Textos.Filtro("filtro.docx", "*.docx"),
            FileName = nombre,
            InitialDirectory = CarpetaInicial(),
            OverwritePrompt = true,
            DefaultExt = "docx",
            AddExtension = true,
        };
        string destino;
#if DEBUG
        var dp = DestinoPrueba(d.FileName);
        if (dp != null) destino = dp;
        else
#endif
        {
            if (d.ShowDialog(this) != DialogResult.OK) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
            destino = d.FileName;
            RecordarCarpeta(destino);
        }
        EnFondo(id, "word.fallo", () =>
        {
            File.WriteAllBytes(destino, Motor.Word.CrearDocx(doc));
            return new JsonObject { ["tipo"] = "guardado", ["ruta"] = destino, ["id"] = id?.DeepClone() };
        });
    }

    void Ocr(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        var b64 = Texto(msg["png"]);
        if (string.IsNullOrEmpty(b64)) { Error(Textos.T("ocr.sinImagen"), id); return; }
        var idioma = Texto(msg["idioma"]);
        EnFondoAsync(id, "ocr.fallo", async () =>
        {
            int coma = b64.IndexOf("base64,", StringComparison.Ordinal);
            var png = Convert.FromBase64String(coma >= 0 ? b64[(coma + 7)..] : b64);
            var r = await Motor.Ocr.ReconocerAsync(png, idioma);
            return new JsonObject
            {
                ["tipo"] = "ocrResultado",
                ["id"] = id?.DeepClone(),
                ["resultado"] = JsonSerializer.SerializeToNode(r, OpcionesJson),
            };
        });
    }

    void OcrIdiomas(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        EnFondo(id, "ocr.idiomasFallo", () =>
        {
            var idiomas = Motor.Ocr.IdiomasDisponibles();
            var lista = new JsonArray();
            foreach (var i in idiomas) lista.Add(i);
            return new JsonObject
            {
                ["tipo"] = "ocrIdiomas",
                ["id"] = id?.DeepClone(),
                ["idiomas"] = lista,
                ["tieneEspanol"] = idiomas.Any(i => i.StartsWith("es", StringComparison.OrdinalIgnoreCase)),
            };
        });
    }

    void OfficeDisponible(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        EnFondo(id, "office.consultaFallo", () => new JsonObject
        {
            ["tipo"] = "office",
            ["id"] = id?.DeepClone(),
            ["word"] = Motor.Office.HayWord,
            ["excel"] = Motor.Office.HayExcel,
            ["powerpoint"] = Motor.Office.HayPowerPoint,
        });
    }

    void OfficeAPdf(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        var partes = new List<string>();
        if (Motor.Office.HayWord) partes.Add("*.doc;*.docx;*.rtf;*.odt");
        if (Motor.Office.HayExcel) partes.Add("*.xls;*.xlsx;*.ods");
        if (Motor.Office.HayPowerPoint) partes.Add("*.ppt;*.pptx;*.odp");
        if (partes.Count == 0)
        {
            Error(Textos.T("office.sinOffice"), id);
            return;
        }
        var todos = string.Join(";", partes);
        using var d = new OpenFileDialog
        {
            Title = Textos.T("dlg.abrirOffice"),
            Filter = Textos.Filtro("filtro.office", todos),
            InitialDirectory = CarpetaInicial(),
        };
        if (d.ShowDialog(this) != DialogResult.OK) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
        var ruta = d.FileName;
        RecordarCarpeta(ruta);
        EnFondo(id, "office.convertirFallo", () =>
        {
            var pdf = Motor.Office.OfficeAPdf(File.ReadAllBytes(ruta), Path.GetExtension(ruta));
            return new JsonObject
            {
                ["tipo"] = "pdfDeOffice",
                ["id"] = id?.DeepClone(),
                ["nombre"] = Path.GetFileNameWithoutExtension(ruta) + ".pdf",
                ["datos"] = Convert.ToBase64String(pdf),
            };
        });
    }

    void LimpiarPdf(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        var datos = Texto(msg["datos"]);
        if (string.IsNullOrEmpty(datos)) { Error(Textos.T("pdf.nadaLimpiar"), id); return; }
        EnFondo(id, "pdf.limpiarFallo", () =>
        {
            var limpio = Motor.OperacionesPdf.Limpiar(Convert.FromBase64String(datos));
            return new JsonObject { ["tipo"] = "pdfLimpio", ["id"] = id?.DeepClone(), ["datos"] = Convert.ToBase64String(limpio) };
        });
    }

    // ---- fase 3: comprimir y proteger (todos con id; errores con "codigo") ----
    /// <summary>Como EnFondo, pero traduce las excepciones del motor de PDF a mensajes simples y un código para la interfaz.</summary>
    void EnFondoPdf(JsonNode msg, string claveSinDatos, Func<byte[], JsonObject> trabajo)
    {
        var id = msg["id"]?.DeepClone();
        var datos = Texto(msg["datos"]);
        if (string.IsNullOrEmpty(datos)) { ErrorPdf(id, "otro", Textos.T(claveSinDatos)); return; }
        Task.Run(() =>
        {
            JsonObject resp;
            try { resp = trabajo(Convert.FromBase64String(datos)); resp["id"] = id?.DeepClone(); }
            catch (ContrasenaIncorrectaException) { resp = RespuestaError(id, "contrasena", Textos.T("pdf.claveIncorrecta")); }
            catch (YaProtegidoException) { resp = RespuestaError(id, "yaProtegido", Textos.T("pdf.yaProtegido")); }
            catch (PdfDanadoException) { resp = RespuestaError(id, "danado", Textos.T("pdf.danado")); }
            catch (Exception) { resp = RespuestaError(id, "otro", Textos.T("pdf.otro")); }
            try { BeginInvoke(() => Enviar(resp)); } catch { /* ventana cerrada */ }
        });
    }

    static JsonObject RespuestaError(JsonNode? id, string codigo, string mensaje)
    {
        var o = new JsonObject { ["tipo"] = "error", ["mensaje"] = mensaje, ["codigo"] = codigo };
        if (id != null) o["id"] = id.DeepClone();
        return o;
    }

    void ErrorPdf(JsonNode? id, string codigo, string mensaje) => Enviar(RespuestaError(id, codigo, mensaje));

    void AnalizarPdf(JsonNode msg) => EnFondoPdf(msg, "pdf.nadaRevisar", pdf =>
    {
        var i = Motor.OperacionesPdf.Analizar(pdf);
        return new JsonObject
        {
            ["tipo"] = "infoPdf",
            ["info"] = new JsonObject
            {
                ["formularios"] = i.TieneFormularios,
                ["marcadores"] = i.TieneMarcadores,
                ["firmaDigital"] = i.TieneFirmaDigital,
                ["requiereContrasena"] = i.RequiereContrasena,
                ["paginas"] = i.Paginas,
            },
        };
    });

    void ComprimirPdf(JsonNode msg)
    {
        var nivel = Texto(msg["nivel"]) == "ligera" ? Motor.NivelCompresion.Ligera : Motor.NivelCompresion.Media;
        EnFondoPdf(msg, "pdf.nadaComprimir", pdf =>
        {
            var r = Motor.OperacionesPdf.Comprimir(pdf, nivel);
            return new JsonObject
            {
                ["tipo"] = "pdfComprimido",
                ["datos"] = Convert.ToBase64String(r.Datos),
                ["antes"] = r.Antes,
                ["despues"] = r.Despues,
                ["imagenes"] = r.ImagenesRecomprimidas,
            };
        });
    }

    void ProtegerPdf(JsonNode msg)
    {
        var clave = Texto(msg["contrasena"]);
        if (string.IsNullOrEmpty(clave)) { ErrorPdf(msg["id"], "otro", Textos.T("pdf.pideClave")); return; }
        EnFondoPdf(msg, "pdf.nadaProteger", pdf => new JsonObject
        {
            ["tipo"] = "pdfProtegido",
            ["datos"] = Convert.ToBase64String(Motor.OperacionesPdf.Proteger(pdf, clave)),
        });
    }

    void QuitarContrasena(JsonNode msg)
    {
        var clave = Texto(msg["contrasena"]) ?? "";
        EnFondoPdf(msg, "pdf.nadaAbrir", pdf => new JsonObject
        {
            ["tipo"] = "pdfSinContrasena",
            ["datos"] = Convert.ToBase64String(Motor.OperacionesPdf.QuitarContrasena(pdf, clave)),
        });
    }

    async void Imprimir(string? datos)
    {
        if (string.IsNullOrEmpty(datos)) { Error(Textos.T("imprimir.nada")); return; }
        try
        {
            var tmp = Path.Combine(Path.GetTempPath(), "FirmarPDF-" + Guid.NewGuid().ToString("N") + ".pdf");
            await File.WriteAllBytesAsync(tmp, Convert.FromBase64String(datos));
            var ventana = new Impresion(tmp, Path.Combine(Path.GetDirectoryName(carpetaDatos)!, "WebView2-imprimir"), Icon);
            ventana.Show(this);
            bool ok = await ventana.Resultado;
            // Contrato: "impreso" o "error"
            if (ok) Enviar(new JsonObject { ["tipo"] = "impreso" });
            else if (!ventana.IsDisposed && ventana.Visible)
                Error(Textos.T("imprimir.ctrlPVentana"));
        }
        catch (Exception ex)
        {
            Error(Textos.T("imprimir.preparar", ex.Message));
        }
    }

    async Task IniciarMovilAsync(string modo = "firma")
    {
        try
        {
            var (url, qr) = await servidor.IniciarAsync(modo);
            Enviar(new JsonObject { ["tipo"] = "movilQR", ["url"] = url, ["qr"] = qr });
        }
        catch (Exception ex)
        {
            Enviar(new JsonObject { ["tipo"] = "movilError", ["mensaje"] = ex.Message });
        }
    }

    string CarpetaInicial()
    {
        if (!string.IsNullOrEmpty(ultimaCarpeta) && Directory.Exists(ultimaCarpeta)) return ultimaCarpeta;
        return Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
    }

    void RecordarCarpeta(string rutaArchivo)
    {
        var dir = Path.GetDirectoryName(rutaArchivo);
        if (string.IsNullOrEmpty(dir)) return;
        ultimaCarpeta = dir;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(archivoCarpeta)!);
            File.WriteAllText(archivoCarpeta, dir);
        }
        catch { }
    }

    static string LimpiarNombre(string n) => Nombres.Sanear(n) ?? Textos.T("nombre.documento");
}
