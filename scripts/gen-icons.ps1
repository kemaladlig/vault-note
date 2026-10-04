# Regenerates the PWA / favicon assets from the 1024px master `public/vaultnote-icon.png`.
#
#   pwsh scripts/gen-icons.ps1
#
# The master carries a rounded dark tile on a white square; this drops the white corners and
# emits every runtime size, plus a full-bleed maskable. Re-run it whenever the brand mark changes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $root 'public\vaultnote-icon.png'
$srcFile = [System.Drawing.Bitmap]::FromFile($srcPath)
$src = New-Object System.Drawing.Bitmap $srcFile
$srcFile.Dispose()  # release the file lock so the master can be overwritten
$S = $src.Width  # current master, 1024 the first time
$masterSize = 512  # the stored master is downscaled to this; runtime sizes never exceed it

# The tile fills the whole canvas; only its four corners are cut with a radius. The mask radius
# is slightly larger than the tile's own so no white sliver survives the clip.
$R = [int][Math]::Round($S * 0.164)

function New-RoundedPath([int]$w, [int]$h, [int]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc(0, 0, $d, $d, 180, 90)
  $p.AddArc($w - $d, 0, $d, $d, 270, 90)
  $p.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
  $p.AddArc(0, $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# Transparent master: keep the tile, drop the white corners.
$master = New-Object System.Drawing.Bitmap($S, $S, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($master)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$clip = New-RoundedPath $S $S $R
$g.SetClip($clip)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $S, $S))
$g.ResetClip()
$clip.Dispose()
$g.Dispose()

function Save-Scaled([System.Drawing.Bitmap]$image, [int]$size, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gr = [System.Drawing.Graphics]::FromImage($bmp)
  $gr.Clear([System.Drawing.Color]::Transparent)
  $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gr.DrawImage($image, (New-Object System.Drawing.Rectangle 0, 0, $size, $size))
  $gr.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Save-Scaled $master 512 (Join-Path $root 'public\pwa-512.png')
Save-Scaled $master 192 (Join-Path $root 'public\pwa-192.png')
Save-Scaled $master 180 (Join-Path $root 'public\apple-touch-icon.png')
Save-Scaled $master 32  (Join-Path $root 'public\favicon-32.png')

# Maskable: fill the transparent corners by extending the nearest edge colour (edge clamp), so
# the result is a seamless, solid full-bleed square the OS can mask freely.
$rect = New-Object System.Drawing.Rectangle 0, 0, $S, $S
$md = $master.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$mstride = $md.Stride
$mbuf = New-Object byte[] ($mstride * $S)
[System.Runtime.InteropServices.Marshal]::Copy($md.Scan0, $mbuf, 0, $mbuf.Length)
for ($y = 0; $y -lt $S; $y++) {
  $row = $y * $mstride
  $lb = 10; $lg = 10; $lr = 12; $has = $false
  for ($x = 0; $x -lt $S; $x++) {
    $i = $row + $x * 4
    if ($mbuf[$i + 3] -gt 0) { $lb = $mbuf[$i]; $lg = $mbuf[$i + 1]; $lr = $mbuf[$i + 2]; $has = $true }
    elseif ($has) { $mbuf[$i] = $lb; $mbuf[$i + 1] = $lg; $mbuf[$i + 2] = $lr; $mbuf[$i + 3] = 255 }
  }
  $nb = 10; $ng = 10; $nr = 12; $nextSet = $false
  for ($x = $S - 1; $x -ge 0; $x--) {
    $i = $row + $x * 4
    if ($mbuf[$i + 3] -gt 0) { $nb = $mbuf[$i]; $ng = $mbuf[$i + 1]; $nr = $mbuf[$i + 2]; $nextSet = $true }
    elseif ($nextSet) { $mbuf[$i] = $nb; $mbuf[$i + 1] = $ng; $mbuf[$i + 2] = $nr; $mbuf[$i + 3] = 255 }
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($mbuf, 0, $md.Scan0, $mbuf.Length)
$master.UnlockBits($md)
Save-Scaled $master 512 (Join-Path $root 'public\pwa-maskable-512.png')

# Store the master downscaled; it is the source of truth for the next regeneration.
Save-Scaled $master $masterSize $srcPath

$master.Dispose()
$src.Dispose()
Write-Output 'Icons regenerated: pwa-192/512, pwa-maskable-512, apple-touch-icon, favicon-32'
