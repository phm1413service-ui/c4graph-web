# ============================================
#  C4Graph Ver 2.0 デスクトップショートカット作成スクリプト
#  使い方: このファイルを右クリック → [PowerShell で実行]
# ============================================

$ErrorActionPreference = "Stop"

# このスクリプトがあるフォルダ = C4Graph フォルダ
$appDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath  = Join-Path $appDir "C4Graph.bat"
$iconPath = Join-Path $appDir "C4Graph.ico"

if (-not (Test-Path $batPath)) {
    Write-Host "エラー: C4Graph.bat が見つかりません: $batPath" -ForegroundColor Red
    Read-Host "Enter キーを押して終了"
    exit 1
}

$desktopPath  = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "C4Graph.lnk"

$wshell   = New-Object -ComObject WScript.Shell
$shortcut = $wshell.CreateShortcut($shortcutPath)
$shortcut.TargetPath       = $batPath
$shortcut.WorkingDirectory = $appDir
$shortcut.Description      = "C4Graph Ver 2.0 - データモニタ可視化ツール"
$shortcut.WindowStyle      = 7  # 最小化 (黒いコンソール画面を目立たなくする)

if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}

$shortcut.Save()

Write-Host ""
Write-Host "デスクトップにショートカットを作成しました: $shortcutPath" -ForegroundColor Green
Write-Host "今後はデスクトップの [C4Graph] アイコンから起動できます。"
Write-Host ""
Read-Host "Enter キーを押して終了"