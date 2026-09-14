# ============================================================
# ImobAI - Corrige encoding em Home.tsx (v2 - passada extra + verificacao)
# ============================================================

$cp1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Fix-Mojibake([string]$s) {
    $bytes = $cp1252.GetBytes($s)
    return $utf8NoBom.GetString($bytes)
}

$path = "client/src/pages/Home.tsx"

if (-not (Test-Path $path)) {
    Write-Host "ERRO: nao encontrei $path a partir da pasta atual. Rode isso de dentro da pasta do projeto (cd para la primeiro)."
    exit 1
}

$fullPath = (Resolve-Path $path).Path
$content = [System.IO.File]::ReadAllText($fullPath, $utf8NoBom)

# Aplica mais UMA passada (o arquivo ja levou 2 antes; os sinais indicam que faltou 1)
$fixed = Fix-Mojibake $content

[System.IO.File]::WriteAllText($fullPath, $fixed, $utf8NoBom)

# ------------------------------------------------------------
# Verificacao programatica - nao depende do terminal renderizar certo
# ------------------------------------------------------------
$aTil  = [char]0x00E3  # a-til
$iAc   = [char]0x00ED  # i-acento
$aAc   = [char]0x00E1  # a-acento
$cCed  = [char]0x00E7  # c-cedilha
$oTil  = [char]0x00F5  # o-til

$targets = @(
    "N${aTil}o foi poss${iAc}vel",
    "Vis${aTil}o geral",
    "Cat${aAc}logo",
    "Precifica${cCed}${aTil}o",
    "negocia${cCed}${oTil}es"
)

Write-Host "Verificacao (compara strings dentro do PowerShell, nao no que aparece na tela):"
$allOk = $true
foreach ($t in $targets) {
    if ($fixed.Contains($t)) {
        Write-Host "  OK    -> encontrado corretamente"
    } else {
        Write-Host "  FALTA -> NAO encontrado como esperado"
        $allOk = $false
    }
}

$badA = [char]0x00C3  # A-til maiusculo isolado = sinal de corrupcao residual
$badB = [char]0x00C2  # A-circunflexo maiusculo isolado
$leftoverCount = ([regex]::Matches($fixed, "[$badA$badB]")).Count
if ($leftoverCount -gt 0) {
    Write-Host "  ATENCAO: ainda ha $leftoverCount ocorrencia(s) de A-til/A-circunflexo maiusculo isolado."
    $allOk = $false
}

Write-Host ""
if ($allOk) {
    Write-Host "RESULTADO: correcao parece completa e verificada."
} else {
    Write-Host "RESULTADO: ainda ha problema. Nao confie no que aparece no terminal - me avise que eu vejo em detalhe."
}
