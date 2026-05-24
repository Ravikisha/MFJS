$ErrorActionPreference = 'Stop'

$root = (Resolve-Path "$PSScriptRoot\..").Path
$excludeDirs = @('node_modules', '.git', 'dist', '.next', 'build', 'coverage', '.turbo', '.pnpm-store', 'playwright-report', 'test-results', 'logo')
$excludeFiles = @('pnpm-lock.yaml', 'package-lock.json', 'yarn.lock')
$textExt = @('.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.jsonc','.md','.mdx','.yml','.yaml','.toml','.html','.css','.scss','.svg','.txt','.sh','.ps1')

function ShouldSkipPath($p) {
  foreach ($d in $excludeDirs) {
    if ($p -match "[\\/]$([regex]::Escape($d))[\\/]" -or $p -match "[\\/]$([regex]::Escape($d))$") { return $true }
  }
  return $false
}

$changedCount = 0
$files = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  -not (ShouldSkipPath $_.FullName) -and ($excludeFiles -notcontains $_.Name) -and ($textExt -contains $_.Extension.ToLower())
}

foreach ($f in $files) {
  try {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    if ($content -cmatch 'jorvel' -or $content -cmatch 'JORVEL' -or $content -cmatch 'Jorvel') {
      $new = $content
      $new = $new -creplace 'JORVEL', 'JORVEL'
      $new = $new -creplace 'Jorvel', 'Jorvel'
      $new = $new -creplace 'jorvel', 'jorvel'
      if ($new -ne $content) {
        [System.IO.File]::WriteAllText($f.FullName, $new)
        $changedCount++
      }
    }
  } catch {
    Write-Host "ERR read: $($f.FullName) :: $_"
  }
}
Write-Host "Text replacements done. Files changed: $changedCount"

# Rename files containing 'jorvel' in name (process deepest first)
$toRename = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  -not (ShouldSkipPath $_.FullName) -and $_.Name -match 'jorvel'
} | Sort-Object { $_.FullName.Length } -Descending

foreach ($f in $toRename) {
  $newName = $f.Name -replace 'jorvel', 'jorvel'
  $newPath = Join-Path $f.DirectoryName $newName
  if ($f.FullName -ne $newPath) {
    Move-Item -LiteralPath $f.FullName -Destination $newPath -Force
    Write-Host "Renamed: $($f.Name) -> $newName"
  }
}

# Rename directories containing 'jorvel' (deepest first)
$dirsToRename = Get-ChildItem -Path $root -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
  -not (ShouldSkipPath $_.FullName) -and $_.Name -match 'jorvel'
} | Sort-Object { $_.FullName.Length } -Descending

foreach ($d in $dirsToRename) {
  $newName = $d.Name -replace 'jorvel', 'jorvel'
  $newPath = Join-Path $d.Parent.FullName $newName
  if ($d.FullName -ne $newPath) {
    Move-Item -LiteralPath $d.FullName -Destination $newPath -Force
    Write-Host "Renamed dir: $($d.Name) -> $newName"
  }
}

Write-Host "DONE."
