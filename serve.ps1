$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".htm"  = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".mjs"  = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".wasm" = "application/wasm"
  ".task" = "application/octet-stream"
  ".map"  = "application/json"
  ".txt"  = "text/plain; charset=utf-8"
  ".woff" = "font/woff"
  ".woff2"= "font/woff2"
}

$ports = @(5500, 5501, 8080, 8000, 5173, 3000)
$listener = $null
$prefix = $null

foreach ($port in $ports) {
  $tryPrefix = "http://127.0.0.1:$port/"
  $try = [System.Net.HttpListener]::new()
  $try.Prefixes.Add($tryPrefix)
  try {
    $try.Start()
    $listener = $try
    $prefix = $tryPrefix
    break
  } catch {
    try { $try.Close() } catch {}
    Write-Host "Port $port busy, try next..."
  }
}

if (-not $listener) {
  Write-Host "[ERROR] Cannot start server. All candidate ports are busy." -ForegroundColor Red
  Write-Host "Close other local servers and try again." -ForegroundColor Yellow
  exit 1
}

Write-Host "Server started: $prefix" -ForegroundColor Green
Write-Host "Keep this window open. Press Ctrl+C to stop." -ForegroundColor Yellow
Start-Process $prefix

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
      $rel = [Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
      $rel = $rel -replace "/", [IO.Path]::DirectorySeparatorChar
      $full = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $rel))
      $root = [IO.Path]::GetFullPath($PSScriptRoot)

      if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $response.StatusCode = 403
        $bytes = [Text.Encoding]::UTF8.GetBytes("Forbidden")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      } elseif (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes("Not Found")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        if ($mime.ContainsKey($ext)) {
          $response.ContentType = $mime[$ext]
        } else {
          $response.ContentType = "application/octet-stream"
        }
        $response.Headers["Cache-Control"] = "no-cache"
        $bytes = [IO.File]::ReadAllBytes($full)
        $response.ContentLength64 = $bytes.LongLength
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      $response.StatusCode = 500
      $msg = [Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
      $response.OutputStream.Write($msg, 0, $msg.Length)
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
