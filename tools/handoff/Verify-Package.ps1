# Verify before restoring workspace or installing dependencies. No network or model calls.
param([string]$PackageRoot = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$manifestPath = Join-Path $resolvedRoot 'MANIFEST.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$prefix = $resolvedRoot.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
$expected = @{}
foreach ($entry in $manifest.files) {
    $absolute = [IO.Path]::GetFullPath((Join-Path $resolvedRoot $entry.path))
    if (-not $absolute.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe manifest path' }
    if ($expected.ContainsKey($absolute)) { throw 'Duplicate manifest path' }
    $expected[$absolute] = $true
    if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) { throw "Missing file: $($entry.path)" }
    $actual = Get-Item -LiteralPath $absolute
    if ($actual.Length -ne $entry.size_bytes) { throw "Size mismatch: $($entry.path)" }
    $hash = (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash
    if ($hash -ne $entry.sha256) { throw "SHA256 mismatch: $($entry.path)" }
}
foreach ($actual in Get-ChildItem -LiteralPath $resolvedRoot -File -Recurse -Force) {
    if ($actual.FullName -eq $manifestPath) { continue }
    if (-not $expected.ContainsKey($actual.FullName)) { throw "Unexpected file: $($actual.FullName.Substring($prefix.Length))" }
}
Write-Output "PASS: $($expected.Count) files verified. Branch: $($manifest.branch). Baseline: $($manifest.baseline_sha)"
Write-Output 'Now follow START_HERE.md to restore the local Git workspace. No GitHub account required.'
