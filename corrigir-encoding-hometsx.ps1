# ============================================================
# ImobAI - Corrige corrupcao dupla de encoding em Home.tsx
# Reverte: UTF-8 lido como Windows-1252 e re-salvo, duas vezes seguidas.
# ============================================================

$cp1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Fix-Mojibake([string]$s) {
    $bytes = $cp1252.GetBytes($s)
    return $utf8NoBom.GetString($bytes)
}

$path = "client/src/pages/Home.tsx"

if (-not (Test-Path $path)) {
    Write-Host "ERRO: nao encontrei $path a partir da pasta atual. Rode isso da raiz do projeto."
    exit 1
}

$fullPath = (Resolve-Path $path).Path
$content = [System.IO.File]::ReadAllText($fullPath, $utf8NoBom)

$fixedOnce  = Fix-Mojibake $content
$fixedTwice = Fix-Mojibake $fixedOnce

[System.IO.File]::WriteAllText($fullPath, $fixedTwice, $utf8NoBom)

Write-Host "Arquivo corrigido: $path"
Write-Host ""
Write-Host "Amostra (linhas 85-95) apos a correcao:"
(Get-Content -Path $path) | Select-Object -Skip 84 -First 11
