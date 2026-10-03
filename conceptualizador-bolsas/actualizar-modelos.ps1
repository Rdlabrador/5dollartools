# Convierte las fotos de referencias\modelos en modelos.js (catálogo "Mis modelos" de la app).
# - Endereza las fotos del celular (orientación EXIF) y las reduce a 1600 px para que la app cargue rápido.
# - Las fotos quedan incrustadas en modelos.js, así la app funciona abriendo index.html sin servidor.
# - Área de impresión opcional por foto en referencias\modelos\areas.json (fracciones 0-1 de la foto):
#     { "blanca.jpg": { "quad": [[x,y],[x,y],[x,y],[x,y]] } }  (esquinas del frente: sup-izq, sup-der, inf-der, inf-izq)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $root 'referencias\modelos'
$out = Join-Path $root 'modelos.js'
$maxSide = 1600

$areas = @{}
$areasFile = Join-Path $dir 'areas.json'
if (Test-Path $areasFile) {
  (Get-Content $areasFile -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $areas[$_.Name] = $_.Value }
}

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L

$entries = @()
$files = Get-ChildItem $dir -File | Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } | Sort-Object Name
foreach ($f in $files) {
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  try {
    # EXIF orientation (0x0112): fotos de celular suelen venir "acostadas"
    if ($img.PropertyIdList -contains 0x0112) {
      switch ([int]$img.GetPropertyItem(0x0112).Value[0]) {
        3 { $img.RotateFlip('Rotate180FlipNone') }
        6 { $img.RotateFlip('Rotate90FlipNone') }
        8 { $img.RotateFlip('Rotate270FlipNone') }
      }
    }
    $k = [Math]::Min(1, $maxSide / [Math]::Max($img.Width, $img.Height))
    $w = [int]($img.Width * $k); $h = [int]($img.Height * $k)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $w, $h)
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, $jpeg, $params)
    $g.Dispose(); $bmp.Dispose()
  } finally { $img.Dispose() }

  $nombre = [IO.Path]::GetFileNameWithoutExtension($f.Name) -replace '[-_]+', ' '
  $nombre = $nombre.Substring(0, 1).ToUpper() + $nombre.Substring(1)
  $entries += [ordered]@{
    nombre  = $nombre
    archivo = $f.Name
    area    = $areas[$f.Name]
    src     = 'data:image/jpeg;base64,' + [Convert]::ToBase64String($ms.ToArray())
  }
  Write-Host ("  + {0}  ({1}x{2})" -f $f.Name, $w, $h)
}

$json = if ($entries.Count) { ConvertTo-Json @($entries) -Depth 6 -Compress } else { '[]' }
[IO.File]::WriteAllText($out, "window.MODELOS = $json;`n", (New-Object System.Text.UTF8Encoding $false))
Write-Host ""
Write-Host "Listo: $($entries.Count) modelo(s) en modelos.js. Recarga la app (F5)."
