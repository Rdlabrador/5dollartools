// Muestra el panel de impresion nativo de macOS para un PDF (PDFKit). JXA: se ejecuta con osascript.
// Uso a mano:
//   osascript -l JavaScript mac/scripts/imprimir.js archivo.pdf
// Escribe "ok" si el usuario imprimio o "cancelado" si cerro el panel. Con otro error sale con codigo distinto de 0.
ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('PDFKit');

function run(argv) {
  var ruta = argv[0];
  if (!ruta) throw new Error('Falta la ruta del PDF');

  var app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory); // sin icono en el Dock
  app.activateIgnoringOtherApps(true);

  var doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(ruta));
  if (!doc || Number(doc.pageCount) < 1) throw new Error('PDF_NO_ABIERTO');

  var info = $.NSPrintInfo.sharedPrintInfo;
  // 2 = kPDFPrintPageScaleDownToFit (reduce solo lo que no cabe); autoRotate = true
  var op = doc.printOperationForPrintInfoScalingModeAutoRotate(info, 2, true);
  op.showsPrintPanel = true;
  op.showsProgressPanel = true;

  var t0 = Date.now();
  var ok = op.runOperation;
  // Un false casi instantaneo significa que el panel nunca se mostro (operacion nula): se trata como fallo.
  if (!ok && Date.now() - t0 < 700) throw new Error('IMPRESION_NO_MOSTRADA');
  return ok ? 'ok' : 'cancelado';
}
