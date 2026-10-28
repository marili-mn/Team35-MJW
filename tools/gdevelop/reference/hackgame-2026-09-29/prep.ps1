Add-Type -AssemblyName System.Drawing
$src = 'C:\Users\Nicte\Desktop\Team35-MJW-jorgelinamendieta-gdevelop\GravityRunnerDash\assets'
$dst = 'C:\Users\Nicte\Desktop\Team35-MJW-jorgelinamendieta-gdevelop\GravityRunnerDash\hack_assets'
New-Item -ItemType Directory -Force $dst | Out-Null

function Get-Bounds($bmp) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $data = $bmp.LockBits($rect, 'ReadOnly', [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $bmp.Height)
  [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    $row = $y * $data.Stride
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($bytes[$row + $x * 4 + 3] -gt 16) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  return @($minX, $minY, $maxX, $maxY)
}

function Save-Cropped($inPath, $outName, $bounds, $targetW, $targetH) {
  $img = New-Object System.Drawing.Bitmap $inPath
  $cw = $bounds[2] - $bounds[0] + 1; $ch = $bounds[3] - $bounds[1] + 1
  if (-not $targetW -and -not $targetH) { $targetW = $cw; $targetH = $ch }
  elseif (-not $targetH) { $targetH = [int][Math]::Round($ch * $targetW / $cw) }
  elseif (-not $targetW) { $targetW = [int][Math]::Round($cw * $targetH / $ch) }
  $out = New-Object System.Drawing.Bitmap $targetW, $targetH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingMode = 'SourceCopy'
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $targetW, $targetH), $bounds[0], $bounds[1], $cw, $ch, 'Pixel')
  $g.Dispose(); $img.Dispose()
  $out.Save((Join-Path $dst $outName), [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
  return "$outName ${targetW}x${targetH}"
}

function Trim($file, $outName, $w, $h) {
  $b = New-Object System.Drawing.Bitmap (Join-Path $src $file)
  $bounds = Get-Bounds $b; $b.Dispose()
  Save-Cropped (Join-Path $src $file) $outName $bounds $w $h
}

# Kaito: union bounds of idle + walk frames so every frame shares the same box (stable hitbox)
$idle = @('NewSprite.png') + (2..16 | ForEach-Object { "NewSprite$_.png" })
$walk = 9..24 | ForEach-Object { "walk$_.png" }
$u = @(9999, 9999, -1, -1)
foreach ($f in $idle + $walk) {
  $b = New-Object System.Drawing.Bitmap (Join-Path $src $f); $bb = Get-Bounds $b; $b.Dispose()
  $u = @([Math]::Min($u[0], $bb[0]), [Math]::Min($u[1], $bb[1]), [Math]::Max($u[2], $bb[2]), [Math]::Max($u[3], $bb[3]))
}
"kaito union bounds: $($u -join ',')"
$i = 0; foreach ($f in $idle) { $i++; $r = Save-Cropped (Join-Path $src $f) ("kaito_idle_{0:D2}.png" -f $i) $u $null $null }
$i = 0; foreach ($f in $walk) { $i++; $r = Save-Cropped (Join-Path $src $f) ("kaito_walk_{0:D2}.png" -f $i) $u $null $null }
$r

# Backgrounds: fill 1280x720
foreach ($p in @(@('fondos\fondoTutorialb.png', 'fondo_tutorial.png'), @('fondos\fondoentrenamiento.png', 'fondo_entrenamiento.png'), @('fondos\fondo2.png', 'fondo_nivel1.png'))) {
  $b = New-Object System.Drawing.Bitmap (Join-Path $src $p[0]); $full = @(0, 0, ($b.Width - 1), ($b.Height - 1)); $b.Dispose()
  Save-Cropped (Join-Path $src $p[0]) $p[1] $full 1280 720
}

Trim 'tutorial\roca.png' 'roca.png' 64 64
Trim 'tutorial\pisoflotante.png' 'piso_flotante.png' 256 $null
Trim 'tutorial\pinchos.png' 'pinchos.png' 160 $null
Trim 'tutorial\gema.png' 'gema.png' 44 $null
Trim 'tutorial\corazonvida.png' 'corazon.png' 40 $null
Trim 'tutorial\puertasiguientenivel.png' 'portal.png' $null 220
Trim 'tutorial\indicacion1.png' 'cartel1.png' $null 150
Trim 'tutorial\indicacion2.png' 'cartel2.png' $null 120
Trim 'tutorial\indicacion3v2.png' 'cartel3.png' $null 110
Trim 'tutorial\INDICACION4.png' 'cartel4.png' $null 110
Trim 'tutorial\indicacion5.png' 'cartel5.png' $null 100
Trim 'tutorial\inicio.png' 'inicio.png' 260 $null
Trim 'tutorial\titulo.png' 'titulo.png' 720 $null
Trim 'gameover\gameover.png' 'gameover.png' 640 $null
Trim 'gameover\aviso.png' 'aviso.png' 640 $null
Trim 'gameover\espacio.png' 'espacio.png' 560 $null
Trim 'barradeenergia.png' 'barra_marco.png' 360 $null
Trim 'NewSprite22.png' 'barra_relleno.png' $null $null
