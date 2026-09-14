# ============================================================
# ImobAI - Fase 0: Protecao e diagnostico (versao PowerShell, v3)
# Rode a partir da RAIZ do projeto (onde ficam client/, server/, shared/, drizzle/)
# ============================================================

$ErrorActionPreference = "Continue"

$BackupDir  = Join-Path $HOME "imobai-backups"
$Timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupFile = Join-Path $BackupDir "imobai-backup-$Timestamp.zip"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "== 1. Backup externo completo =="
$ItemsToBackup = @("client","server","shared","drizzle","package.json","package-lock.json","tsconfig.json","drizzle.config.ts","vite.config.ts",".env") |
    Where-Object { Test-Path $_ }
Compress-Archive -Path $ItemsToBackup -DestinationPath $BackupFile -Force
Write-Host "Backup salvo em: $BackupFile"
Get-Item $BackupFile | Select-Object Name, Length
Write-Host "(Esse arquivo contem seu .env - guarde em lugar seguro, tem credenciais.)"

Write-Host ""
Write-Host "== 2. Localizar backups/copias dentro das pastas de codigo (apenas lista) =="
$patterns = @("*.bak","*.backup","*_old*","*copy*","*.orig")
$found = Get-ChildItem -Path client, server, shared, drizzle -Recurse -Include $patterns -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' }
if ($found) { $found | ForEach-Object { $_.FullName } } else { Write-Host "Nenhum backup encontrado dentro do codigo." }

Write-Host ""
Write-Host "== 3. Confirmar que o Supabase continua acessivel (AJUSTE conforme seu setup) =="
if (Test-Path .env) {
    $envContent = Get-Content .env -Raw
    if ($envContent -match "DATABASE_URL|SUPABASE_URL") {
        Write-Host "Variavel de conexao encontrada em .env."
    } else {
        Write-Host "ATENCAO: nao achei DATABASE_URL/SUPABASE_URL em .env."
    }
} else {
    Write-Host "ATENCAO: nenhum .env encontrado na raiz - verifique onde suas credenciais estao."
}
Write-Host "Teste real de conexao (escolha o que existir no seu projeto):"
Write-Host "  npx drizzle-kit studio        # abre painel e valida a conexao"
Write-Host "  npm run db:check              # se existir esse script no package.json"

Write-Host ""
Write-Host "== 4. Confirmar que os 12 codigos IMB-001 a IMB-012 existem uma unica vez =="
$searchDirs = @("client/src","server","shared","drizzle") | Where-Object { Test-Path $_ }
if ($searchDirs) {
    $codeFiles = Get-ChildItem -Path $searchDirs -Recurse -Include *.json,*.sql,*.ts,*.tsx -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\dist\\' -and $_.FullName -notmatch '\\build\\' -and $_.FullName -notmatch '\\\.git\\' }
    $fileMatches = $codeFiles | Select-String -Pattern "IMB-0\d{2}" -AllMatches
    $allCodes = $fileMatches | ForEach-Object { $_.Matches.Value }
    if ($allCodes) {
        $allCodes | Group-Object | Sort-Object Count -Descending | Format-Table Name, Count -AutoSize
    } else {
        Write-Host "Nenhuma ocorrencia encontrada nessas pastas - ajuste -Path/-Include se seus dados ficam em outro lugar (ex: uma pasta de seed)."
    }
} else {
    Write-Host "Nenhuma das pastas client/src, server, shared, drizzle foi encontrada aqui - confirme que esta na raiz do projeto."
}

Write-Host ""
Write-Host "== 5. Verificar sinais de corrupcao UTF-8 no frontend ativo =="
$aTilde = [char]0x00C3
$aCirc  = [char]0x00C2
$badPattern = "$aTilde|$aCirc"
$corrupted = Get-ChildItem -Path client/src -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
    Select-String -Pattern $badPattern -List
if ($corrupted) {
    $corrupted | ForEach-Object { $_.Path }
    Write-Host "^ arquivos acima tem possivel corrupcao de acentuacao."
} else {
    Write-Host "Nenhuma ocorrencia obvia encontrada em client/src."
}

Write-Host ""
Write-Host "== 6. Registrar o estado inicial do build =="
$stateFile = Join-Path $BackupDir "estado-inicial-$Timestamp.txt"
$nodeVersion = (node -v) 2>$null
if (-not $nodeVersion) { $nodeVersion = "nao encontrado" }
$npmVersion = (npm -v) 2>$null
if (-not $npmVersion) { $npmVersion = "nao encontrado" }
$gitCommit = (git rev-parse --short HEAD) 2>$null
$gitBranch = (git branch --show-current) 2>$null

$commitLine = if ($gitCommit) { $gitCommit } else { "N/A (sem git ou fora de um repo)" }
$branchLine = if ($gitBranch) { $gitBranch } else { "N/A" }

@"
Registro de estado - $Timestamp
Node: $nodeVersion
npm: $npmVersion
Commit atual: $commitLine
Branch: $branchLine
"@ | Out-File -FilePath $stateFile -Encoding utf8

Get-Content $stateFile

Write-Host ""
Write-Host "Fase 0 concluida. Backup e diagnostico salvos em: $BackupDir"
