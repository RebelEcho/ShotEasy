# 下载 Xenova/modnet 模型文件到 public/models/Xenova/modnet/
# 用法: powershell -ExecutionPolicy Bypass -File scripts/download-models.ps1
# 部署到 Cloudflare 前运行此脚本获取量化模型

$ProgressPreference = 'SilentlyContinue'
$dst = "$PSScriptRoot\..\public\models\Xenova\modnet"
New-Item -ItemType Directory -Force -Path "$dst\onnx" | Out-Null

$files = @(
    @{ url = 'https://huggingface.co/Xenova/modnet/resolve/main/config.json'; path = "$dst\config.json" },
    @{ url = 'https://huggingface.co/Xenova/modnet/resolve/main/preprocessor_config.json'; path = "$dst\preprocessor_config.json" },
    @{ url = 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx'; path = "$dst\onnx\model.onnx" },
    @{ url = 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx'; path = "$dst\onnx\model_quantized.onnx" }
)

$mirror = 'https://hf-mirror.com/Xenova/modnet/resolve/main'

foreach ($f in $files) {
    if (Test-Path $f.path) {
        $size = (Get-Item $f.path).Length
        if ($size -gt 0) { Write-Host "SKIP (exists): $($f.path) ($size bytes)"; continue }
    }
    $url = $f.url
    Write-Host "Downloading: $url"
    try {
        curl.exe -L --retry 3 --connect-timeout 30 -o $f.path $url
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Primary failed, trying mirror: $mirror"
            $mirrorUrl = $url -replace 'https://huggingface.co/Xenova/modnet/resolve/main', $mirror
            curl.exe -L --retry 3 --connect-timeout 30 -o $f.path $mirrorUrl
        }
        Write-Host "  OK: $($f.path) ($((Get-Item $f.path).Length) bytes)"
    } catch {
        Write-Host "  FAILED: $_"
    }
}

Write-Host "`nDone! Files in $dst :"
Get-ChildItem -Recurse $dst | ForEach-Object { Write-Host "  $($_.FullName) => $($_.Length) bytes" }
