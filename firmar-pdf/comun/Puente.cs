using System.Text.Json;
using System.Text.Json.Nodes;
using FirmarPdf.Motor;

namespace FirmarPdf;

/// <summary>Atiende los mensajes del contrato (interfaz HTML/JS → programa). Es igual en todas las plataformas; lo propio del sistema va por IPlataforma.</summary>
public sealed class Puente
{
    readonly IPlataforma plat;
    string? pdfInicial;
    bool interfazLista;
    readonly ServidorMovil servidor;
    readonly string archivoCarpeta;
    string? ultimaCarpeta;
    bool hayCambios;

    public Puente(IPlataforma plataforma, string? pdfInicial)
    {
        plat = plataforma;
        this.pdfInicial = pdfInicial;
        archivoCarpeta = Path.Combine(plat.CarpetaDatos, "ultima-carpeta.txt");
        try { if (File.Exists(archivoCarpeta)) ultimaCarpeta = File.ReadAllText(archivoCarpeta).Trim(); } catch { }
        if (pdfInicial != null) RecordarCarpeta(pdfInicial);

        servidor = new ServidorMovil(
            png => plat.EnHiloUI(() => Enviar(new JsonObject { ["tipo"] = "firmaMovil", ["png"] = png })),
            () => plat.EnHiloUI(() => Enviar(new JsonObject { ["tipo"] = "movilVencido" })),
            fotos => plat.EnHiloUI(() =>
            {
                var imagenes = new JsonArray();
                foreach (var f in fotos) imagenes.Add(f);
                Enviar(new JsonObject { ["tipo"] = "fotosMovil", ["imagenes"] = imagenes });
            }),
            () => plat.EnHiloUI(() => Enviar(new JsonObject { ["tipo"] = "movilConectado" })));
    }

    /// <summary>true si la interfaz avisó que hay cambios sin guardar (mensaje "sucio"): la ventana debe preguntar antes de cerrar.</summary>
    public bool HayCambios => hayCambios;

    /// <summary>Detiene el servidor del celular. Llamar al cerrar la ventana.</summary>
    public void Cerrar()
    {
        try { Task.Run(() => servidor.DetenerAsync()).Wait(2000); } catch { }
        lock (temporales)
        {
            foreach (var t in temporales) { try { File.Delete(t); } catch { } }
            temporales.Clear();
        }
    }

    /// <summary>Recibe un mensaje de la interfaz (JSON). Llamar desde el hilo de la UI.</summary>
    public void Recibir(string json)
    {
        JsonNode? msg;
        try { msg = JsonNode.Parse(json); }
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

    void Enviar(JsonObject obj) => plat.EnviarJson(obj.ToJsonString());

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
            try { protegido = OperacionesPdf.RequiereContrasena(bytes); }
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
            try { plat.EnHiloUI(() => Enviar(resp)); } catch { /* ventana cerrada */ }
        });
    }

    /// <summary>Abre un PDF pedido desde fuera (por ejemplo, doble clic en el Finder con el programa ya abierto). Hilo UI.</summary>
    public void AbrirPdf(string ruta)
    {
        if (!File.Exists(ruta)) return;
        if (!interfazLista) { pdfInicial = ruta; return; } // la interfaz aún no arrancó: se abrirá al estar lista
        EnviarPdf(ruta);
    }

    void AlEstarListo()
    {
        interfazLista = true;
        if (pdfInicial == null) return;
        EnviarPdf(pdfInicial);
    }

    static FiltroArchivo FiltroPdf => new(Textos.T("filtro.pdf"), new[] { "pdf" });

    void Abrir()
    {
        var rutas = plat.AbrirArchivos(Textos.T("dlg.abrirPdf"), FiltroPdf, false, CarpetaInicial());
        if (rutas == null || rutas.Length == 0) return;
        EnviarPdf(rutas[0]);
    }

    void Guardar(string? datos, string? nombre)
    {
        if (string.IsNullOrEmpty(datos)) { Error(Textos.T("error.nadaGuardar")); return; }
        nombre = LimpiarNombre(nombre ?? Textos.T("nombre.firmado"));
        var destino = plat.GuardarArchivo(Textos.T("dlg.guardarPdfFirmado"), nombre, FiltroPdf, "pdf", CarpetaInicial());
        if (destino == null) { Enviar(new JsonObject { ["tipo"] = "cancelado" }); return; }
        RecordarCarpeta(destino);
        EnFondo(null, "error.guardarUno", () =>
        {
            File.WriteAllBytes(destino, Convert.FromBase64String(datos));
            return new JsonObject { ["tipo"] = "guardado", ["ruta"] = destino };
        });
    }

    // ---- mensajes con id (la respuesta devuelve el mismo id): abrirArchivos, guardarArchivo, guardarVarios ----
    static readonly string[] ExtImagenes = { "jpg", "jpeg", "png", "bmp", "gif", "tif", "tiff", "webp" };

    void AbrirArchivos(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        var tipos = Texto(msg["tipos"]) ?? "pdf";
        var filtro = tipos switch
        {
            "imagenes" => new FiltroArchivo(Textos.T("filtro.imagenes"), ExtImagenes),
            "pdf+imagenes" => new FiltroArchivo(Textos.T("filtro.pdfImagenes"), new[] { "pdf" }.Concat(ExtImagenes).ToArray()),
            "office" => new FiltroArchivo(Textos.T("filtro.office"), new[] { "doc", "docx", "xls", "xlsx", "ppt", "pptx" }, false),
            _ => FiltroPdf,
        };
        var rutas = plat.AbrirArchivos(Texto(msg["titulo"]) ?? Textos.T("dlg.abrirArchivos"), filtro, Booleano(msg["multiple"]), CarpetaInicial());
        if (rutas == null || rutas.Length == 0)
        {
            Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id });
            return;
        }
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
        // "formato" (no "tipo": ese campo es el nombre del mensaje)
        var tipo = (Texto(msg["formato"]) ?? "pdf").ToLowerInvariant();
        var (filtro, ext) = tipo switch
        {
            "png" => (new FiltroArchivo(Textos.T("filtro.png"), new[] { "png" }), "png"),
            "jpg" => (new FiltroArchivo(Textos.T("filtro.jpg"), new[] { "jpg", "jpeg" }), "jpg"),
            "docx" => (new FiltroArchivo(Textos.T("filtro.docx"), new[] { "docx" }), "docx"),
            "zip" => (new FiltroArchivo(Textos.T("filtro.zip"), new[] { "zip" }), "zip"),
            "txt" => (new FiltroArchivo(Textos.T("filtro.txt"), new[] { "txt" }), "txt"),
            _ => (FiltroPdf, "pdf"),
        };
        var nombre = LimpiarNombre(Texto(msg["nombre"]) ?? Textos.T("nombre.documento") + "." + ext);
        string? destino;
#if DEBUG
        var dp = DestinoPrueba(nombre);
        if (dp != null) destino = dp;
        else
#endif
        {
            destino = plat.GuardarArchivo(Textos.T("dlg.guardarArchivo"), nombre, filtro, ext, CarpetaInicial());
            if (destino == null) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
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
        var carpeta = plat.ElegirCarpeta(Textos.T("dlg.elegirCarpeta"), CarpetaInicial());
        if (carpeta == null) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
        PermitirCarpeta(carpeta);
        RecordarCarpetaElegida(carpeta);
        EnFondo(id, "error.guardarVarios", () =>
        {
            var (nombres, error, fallidos) = EscribirLote(carpeta, archivos);
            if (nombres.Count == 0)
                throw new IOException(error ?? Textos.T("error.nadaGuardar"));
            try { plat.AbrirCarpetaEnSistema(carpeta); } catch { }
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
        var ruta = plat.ElegirCarpeta(Texto(msg["titulo"]) ?? Textos.T("dlg.elegirCarpeta"), CarpetaInicial());
        if (ruta == null) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
        PermitirCarpeta(ruta);
        RecordarCarpetaElegida(ruta);
        Enviar(new JsonObject { ["tipo"] = "carpeta", ["ruta"] = ruta, ["id"] = id });
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
        try { plat.AbrirCarpetaEnSistema(carpeta!); } catch { }
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
            try { plat.EnHiloUI(() => Enviar(resp)); } catch { /* ventana cerrada */ }
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

        string? destino;
#if DEBUG
        var dp = DestinoPrueba(nombre);
        if (dp != null) destino = dp;
        else
#endif
        {
            destino = plat.GuardarArchivo(Textos.T("dlg.guardarWord"), nombre,
                new FiltroArchivo(Textos.T("filtro.docx"), new[] { "docx" }), "docx", CarpetaInicial());
            if (destino == null) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
            RecordarCarpeta(destino);
        }
        EnFondo(id, "word.fallo", () =>
        {
            File.WriteAllBytes(destino, Word.CrearDocx(doc));
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
            var r = await plat.ReconocerAsync(png, idioma);
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
            var idiomas = plat.IdiomasOcr();
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
        EnFondo(id, "office.consultaFallo", () =>
        {
            var o = plat.OfficeDisponible();
            return new JsonObject
            {
                ["tipo"] = "office",
                ["id"] = id?.DeepClone(),
                ["word"] = o.Word,
                ["excel"] = o.Excel,
                ["powerpoint"] = o.PowerPoint,
            };
        });
    }

    void OfficeAPdf(JsonNode msg)
    {
        var id = msg["id"]?.DeepClone();
        var o = plat.OfficeDisponible();
        var exts = new List<string>();
        if (o.Word) exts.AddRange(new[] { "doc", "docx", "rtf", "odt" });
        if (o.Excel) exts.AddRange(new[] { "xls", "xlsx", "ods" });
        if (o.PowerPoint) exts.AddRange(new[] { "ppt", "pptx", "odp" });
        if (exts.Count == 0)
        {
            Error(Textos.T("office.sinOffice"), id);
            return;
        }
        var rutas = plat.AbrirArchivos(Textos.T("dlg.abrirOffice"), new FiltroArchivo(Textos.T("filtro.office"), exts.ToArray()), false, CarpetaInicial());
        if (rutas == null || rutas.Length == 0) { Enviar(new JsonObject { ["tipo"] = "cancelado", ["id"] = id }); return; }
        var ruta = rutas[0];
        RecordarCarpeta(ruta);
        EnFondo(id, "office.convertirFallo", () =>
        {
            var pdf = plat.OfficeAPdf(File.ReadAllBytes(ruta), Path.GetExtension(ruta));
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
            var limpio = OperacionesPdf.Limpiar(Convert.FromBase64String(datos));
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
            try { plat.EnHiloUI(() => Enviar(resp)); } catch { /* ventana cerrada */ }
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
        var i = OperacionesPdf.Analizar(pdf);
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
        var nivel = Texto(msg["nivel"]) == "ligera" ? NivelCompresion.Ligera : NivelCompresion.Media;
        EnFondoPdf(msg, "pdf.nadaComprimir", pdf =>
        {
            var r = OperacionesPdf.Comprimir(pdf, nivel, plat);
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
            ["datos"] = Convert.ToBase64String(OperacionesPdf.Proteger(pdf, clave)),
        });
    }

    void QuitarContrasena(JsonNode msg)
    {
        var clave = Texto(msg["contrasena"]) ?? "";
        EnFondoPdf(msg, "pdf.nadaAbrir", pdf => new JsonObject
        {
            ["tipo"] = "pdfSinContrasena",
            ["datos"] = Convert.ToBase64String(OperacionesPdf.QuitarContrasena(pdf, clave)),
        });
    }

    async void Imprimir(string? datos)
    {
        if (string.IsNullOrEmpty(datos)) { Error(Textos.T("imprimir.nada")); return; }
        string? tmp = null;
        bool conservar = false;
        try
        {
            tmp = Path.Combine(Path.GetTempPath(), "FirmarPDF-" + Guid.NewGuid().ToString("N") + ".pdf");
            await File.WriteAllBytesAsync(tmp, Convert.FromBase64String(datos));
            var r = await plat.ImprimirPdfAsync(tmp);
            // Abierto: la impresión puede seguir leyendo el archivo; Aviso: Vista Previa lo necesita. Se borran al cerrar.
            if (r != ResultadoImpresion.Cerrado) { conservar = true; lock (temporales) temporales.Add(tmp); }
            // Contrato: "impreso" o "error" (siempre en el hilo de la UI: tras el await puede no estar en él)
            EnUI(() =>
            {
                if (r == ResultadoImpresion.Abierto) Enviar(new JsonObject { ["tipo"] = "impreso" });
                else if (r == ResultadoImpresion.Aviso) Error(Textos.T("imprimir.ctrlPVentana"));
            });
        }
        catch (Exception ex)
        {
            EnUI(() => Error(Textos.T("imprimir.preparar", ex.Message)));
        }
        finally
        {
            if (!conservar && tmp != null) { try { File.Delete(tmp); } catch { } }
        }
    }

    readonly List<string> temporales = new();

    /// <summary>Ejecuta en el hilo de la UI; si la ventana ya se cerró, se ignora.</summary>
    void EnUI(Action accion)
    {
        try { plat.EnHiloUI(accion); } catch { }
    }

    async Task IniciarMovilAsync(string modo = "firma")
    {
        try
        {
            var (url, qr) = await servidor.IniciarAsync(modo);
            EnUI(() => Enviar(new JsonObject { ["tipo"] = "movilQR", ["url"] = url, ["qr"] = qr }));
        }
        catch (Exception ex)
        {
            var mensaje = ex.Message;
            EnUI(() => Enviar(new JsonObject { ["tipo"] = "movilError", ["mensaje"] = mensaje }));
        }
    }

    string CarpetaInicial()
    {
        if (!string.IsNullOrEmpty(ultimaCarpeta) && Directory.Exists(ultimaCarpeta)) return ultimaCarpeta;
        return plat.CarpetaPredeterminada;
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
