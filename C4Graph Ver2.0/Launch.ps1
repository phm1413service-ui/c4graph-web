# C4Graph Ver 2.0 起動スクリプト (Chrome アプリモード)
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$uri = (New-Object System.Uri (Join-Path $dir 'index.html')).AbsoluteUri

$candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)

$chrome = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    Start-Process $chrome -ArgumentList "--app=$uri"
} else {
    Write-Host "Chrome が見つかりませんでした。Google Chrome をインストールしてください。" -ForegroundColor Red
    Read-Host "Enter キーを押して終了"
    exit 1
}
