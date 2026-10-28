# Slices the Ninjas.zip spritesheets into 128x128 Kaito frames aligned by the feet.
#   pwsh tools/gdevelop/assets/slice-ninja.ps1 -NinjasDir <unzipped Ninjas folder>
param(
  [Parameter(Mandatory = $true)][string]$NinjasDir,
  [string]$OutDir = (Join-Path $PSScriptRoot "..\..\..\GravityRunnerDash\assets\kaito")
)
Add-Type -AssemblyName System.Drawing

$src = $NinjasDir
$out = $OutDir
New-Item -ItemType Directory -Force $out | Out-Null

# name, file, frameCount, nativeScale (true = already 128px frames)
$sheets = @(
  @{ name = "idle";    file = "Idle\idle.png";      n = 8;  native = $true  },
  @{ name = "walk";    file = "Walk\walk.png";      n = 8;  native = $true  },
  @{ name = "jump";    file = "Jump\jumping.png";   n = 8;  native = $true  },
  @{ name = "wounded"; file = "Wounded\wounded.png"; n = 2; native = $true  },
  @{ name = "run";     file = "Run\Run.png";        n = 8;  native = $false },
  @{ name = "death";   file = "Fall\Fall.png";      n = 8;  native = $false },
  @{ name = "attack";  file = "Ataque\Ataque.png";  n = 10; native = $false }
)

function Get-AlphaBytes($bmp) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $bmp.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $stride = $data.Stride
  $bmp.UnlockBits($data)
  return @{ bytes = $bytes; stride = $stride }
}

$T = 128
foreach ($s in $sheets) {
  $sheet = New-Object System.Drawing.Bitmap (Join-Path $src $s.file)
  $fw = [int]($sheet.Width / $s.n)
  $fh = $sheet.Height

  if ($s.native) {
    $scale = 1.0; $offX = 0; $offY = 0
  } else {
    $a = Get-AlphaBytes $sheet
    $minX = $fw; $minY = $fh; $maxX = -1; $maxY = -1
    for ($f = 0; $f -lt $s.n; $f++) {
      for ($y = 0; $y -lt $fh; $y += 2) {
        $row = $y * $a.stride
        for ($x = 0; $x -lt $fw; $x += 2) {
          $alpha = $a.bytes[$row + (($f * $fw + $x) * 4) + 3]
          if ($alpha -gt 40) {
            if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
          }
        }
      }
    }
    $uw = $maxX - $minX + 2; $uh = $maxY - $minY + 2
    $scale = [Math]::Min(124.0 / $uw, 124.0 / $uh)
    $offX = [int](64 - (($minX + $uw / 2.0) * $scale))
    $offY = [int](127 - (($maxY + 2) * $scale))
    "{0}: union bbox x{1}-{2} y{3}-{4} scale={5:N3}" -f $s.name, $minX, $maxX, $minY, $maxY, $scale
  }

  for ($f = 0; $f -lt $s.n; $f++) {
    $dst = New-Object System.Drawing.Bitmap $T, $T, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.Clear([System.Drawing.Color]::Transparent)
    if ($s.native) {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    } else {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    }
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $srcRect = New-Object System.Drawing.Rectangle ($f * $fw), 0, $fw, $fh
    $dstRect = New-Object System.Drawing.Rectangle $offX, $offY, ([int]($fw * $scale)), ([int]($fh * $scale))
    $g.DrawImage($sheet, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $dst.Save((Join-Path $out ("{0}_{1}.png" -f $s.name, $f)), [System.Drawing.Imaging.ImageFormat]::Png)
    $dst.Dispose()
  }
  $sheet.Dispose()
}
Get-ChildItem $out | Measure-Object | Select-Object -ExpandProperty Count
