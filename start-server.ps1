# My To-Do List Local Development Server (Optimized & Fast)
$port = 5000
$url = "http://localhost:$port/"
$baseDir = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "            My To-Do List - Fast Web Server               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$listener = $null
while ($port -lt 5020) {
    try {
        $url = "http://localhost:$port/"
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add($url)
        $listener.Start()
        break
    } catch {
        $listener = $null
        $port++
    }
}

if (-not $listener -or -not $listener.IsListening) {
    Write-Host "[ERROR] Could not start server. Port may be in use." -ForegroundColor Red
    Exit 1
}

Write-Host "[OK] Server is running at: $url" -ForegroundColor Yellow
Write-Host "Press Ctrl + C to stop the server." -ForegroundColor Gray
Write-Host "----------------------------------------------------------"

try {
    Start-Process $url
} catch {
    Write-Host "Please open in browser: $url" -ForegroundColor Yellow
}

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain; charset=utf-8"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $path = $request.Url.LocalPath
            if ($path -eq "/" -or [string]::IsNullOrWhiteSpace($path)) {
                $path = "/index.html"
            }

            $decodedPath = [System.Uri]::UnescapeDataString($path).TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $filePath = Join-Path $baseDir $decodedPath

            $response.KeepAlive = $false
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                
                $response.StatusCode = 200
                $response.ContentType = $mime
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.OutputStream.Flush()
            } else {
                $response.StatusCode = 404
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                $response.OutputStream.Flush()
            }
        } catch {
            # Client disconnected or stream write error
        } finally {
            try {
                $response.OutputStream.Close()
                $response.Close()
            } catch {}
        }
    }
} catch {
    # Server stopped
} finally {
    if ($listener -and $listener.IsListening) {
        $listener.Stop()
        $listener.Close()
    }
    Write-Host "`nServer stopped." -ForegroundColor Cyan
}
