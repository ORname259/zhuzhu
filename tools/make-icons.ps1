Add-Type -AssemblyName System.Drawing

$src = New-Object System.Drawing.Bitmap("E:\zhuzhucheng\design\pig-src.jpg")
$sw = $src.Width; $sh = $src.Height
Write-Output "source ${sw}x${sh}"

function New-Icon([int]$size, [string]$hex, [double]$scale, [string]$out, [bool]$jpeg) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml($hex))

  # 等比缩放：源图较长的一边贴到 size*scale
  $fit = [int]($size * $scale)
  $ratio = [double]$sw / [double]$sh
  if ($ratio -ge 1) { $dw = $fit; $dh = [int]($fit / $ratio) } else { $dh = $fit; $dw = [int]($fit * $ratio) }
  $dx = [int](($size - $dw) / 2); $dy = [int](($size - $dh) / 2)

  $dest = New-Object System.Drawing.Rectangle($dx, $dy, $dw, $dh)
  $srcRect = New-Object System.Drawing.Rectangle(0, 0, $sw, $sh)
  $g.DrawImage($script:src, $dest, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $fmt = if ($jpeg) { [System.Drawing.Imaging.ImageFormat]::Jpeg } else { [System.Drawing.Imaging.ImageFormat]::Png }
  $bmp.Save($out, $fmt)
  $bmp.Dispose()
  Write-Output "saved $out  ${dw}x${dh} in ${size}"
}

New-Icon 512 "#FFFFFF" 1.00 "E:\zhuzhucheng\www\assets\icon-512.png" $false
New-Icon 192 "#FFFFFF" 1.00 "E:\zhuzhucheng\www\assets\icon-192.png" $false
New-Icon 180 "#FFFFFF" 1.00 "E:\zhuzhucheng\www\assets\icon-180.png" $false
New-Icon 512 "#FFFFFF" 0.72 "E:\zhuzhucheng\www\assets\icon-maskable-512.png" $false
New-Icon 512 "#FFFFFF" 1.00 "E:\zhuzhucheng\www\assets\pig.jpg" $true
New-Icon 1024 "#FFFFFF" 1.00 "E:\zhuzhucheng\www\assets\app-icon-1024.png" $false
New-Icon 1024 "#FFFFFF" 1.00 "E:\zhuzhucheng\assets\icon.png" $false
New-Icon 2732 "#FFFFFF" 0.40 "E:\zhuzhucheng\assets\splash.png" $false
$src.Dispose()
