#!/usr/bin/env bash
# Uso: armar-app.sh <rid: osx-arm64|osx-x64> <carpeta-publish> <carpeta-salida>
# Arma PepePDF.app, la firma ad-hoc y crea el .dmg. Se ejecuta en macOS.
set -euo pipefail

RID="${1:?Falta el rid (osx-arm64 u osx-x64)}"
PUBLISH="${2:?Falta la carpeta de publish}"
SALIDA="${3:?Falta la carpeta de salida}"
AQUI="$(cd "$(dirname "$0")" && pwd)"

case "$RID" in
  osx-arm64) DMG="PepePDF-Mac-AppleSilicon.dmg" ;;
  osx-x64)   DMG="PepePDF-Mac-Intel.dmg" ;;
  *) echo "rid no válido: $RID" >&2; exit 1 ;;
esac

[ -f "$PUBLISH/PepePDF" ] || { echo "No existe $PUBLISH/PepePDF" >&2; exit 1; }
mkdir -p "$SALIDA"
SALIDA="$(cd "$SALIDA" && pwd)"
APP="$SALIDA/PepePDF.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# Contenido: todo el publish junto al ejecutable
cp -R "$PUBLISH/." "$APP/Contents/MacOS/"
chmod +x "$APP/Contents/MacOS/PepePDF"
cp "$AQUI/Info.plist" "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"
for l in es en; do
  mkdir -p "$APP/Contents/Resources/$l.lproj"
  cp "$AQUI/$l.lproj/InfoPlist.strings" "$APP/Contents/Resources/$l.lproj/"
done

# Ícono .icns desde el PNG de 1024 px
SET="$(mktemp -d)/PepePDF.iconset"
mkdir -p "$SET"
PNG="$AQUI/icono-1024.png"
for t in 16 32 128 256 512; do
  sips -z $t $t "$PNG" --out "$SET/icon_${t}x${t}.png" >/dev/null
  sips -z $((t*2)) $((t*2)) "$PNG" --out "$SET/icon_${t}x${t}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$APP/Contents/Resources/PepePDF.icns"

# Firma ad-hoc: primero las bibliotecas y binarios sueltos, al final el paquete
find "$APP/Contents/MacOS" -type f \( -name '*.dylib' -o -name '*.so' -o -name '*.node' \) -print0 |
  while IFS= read -r -d '' f; do codesign --force --sign - "$f"; done
codesign --force --sign - "$APP/Contents/MacOS/PepePDF"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

# .dmg: app + enlace a Aplicaciones + instrucciones
DIR="$(mktemp -d)/PepePDF"
mkdir -p "$DIR"
cp -R "$APP" "$DIR/"
ln -s /Applications "$DIR/Applications"
cat > "$DIR/LEEME - Como abrir la primera vez.txt" <<'TXT'
PepePDF - Cómo abrir la app la primera vez
==========================================
1. Arrastra PepePDF a la carpeta Aplicaciones.
2. macOS dirá que no puede verificar la app (no está firmada por Apple). Es normal.
   macOS 15 (Sequoia) o posterior:
   a) Abre PepePDF una vez (doble clic) y cierra el aviso.
   b) Ve a Ajustes del Sistema > Privacidad y seguridad.
   c) Abajo, junto a "PepePDF", pulsa "Abrir de todos modos".
   d) Escribe la clave de tu Mac y confirma.
   macOS 13-14: también sirve clic derecho sobre PepePDF > Abrir > Abrir.
Solo hace falta la primera vez.

PepePDF - How to open the app the first time
============================================
1. Drag PepePDF to the Applications folder.
2. macOS will say it cannot verify the app (it is not signed by Apple). This is normal.
   macOS 15 (Sequoia) or later:
   a) Open PepePDF once (double-click) and dismiss the warning.
   b) Go to System Settings > Privacy & Security.
   c) At the bottom, next to "PepePDF", click "Open Anyway".
   d) Enter your Mac password and confirm.
   macOS 13-14: right-click PepePDF > Open > Open also works.
This is only needed the first time.
TXT

rm -f "$SALIDA/$DMG"
hdiutil create -volname "PepePDF" -srcfolder "$DIR" -ov -format UDZO "$SALIDA/$DMG"
echo "Listo: $SALIDA/$DMG"
