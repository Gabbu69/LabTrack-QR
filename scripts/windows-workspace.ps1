param([ValidateSet('dev','verify','install')][string]$Mode='dev', [string]$Workspace='D:\CodexBuilds\LabTrack-audit-20261003')
$ErrorActionPreference='Stop'
$source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target=[IO.Path]::GetFullPath($Workspace).TrimEnd('\')
if(!$target.StartsWith('D:\CodexBuilds\',[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($source,[StringComparison]::OrdinalIgnoreCase)) {throw 'Use a separate folder under D:\CodexBuilds.'}
$nodeDirectory=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$node=Join-Path $nodeDirectory 'node.exe'
if(!(Test-Path -LiteralPath $node)) { $node=(Get-Command node -ErrorAction Stop).Source; $nodeDirectory=Split-Path $node }
if((& $node --version) -notmatch '^v24\.') {throw 'Install Node 24 before running this helper.'}
$env:PATH=$nodeDirectory+';'+$env:PATH
$env:TEMP='D:\Temp'; $env:TMP='D:\Temp'; $env:npm_config_cache='D:\DevCaches\npm'
New-Item -ItemType Directory -Path $target,$env:TEMP,$env:npm_config_cache -Force | Out-Null
$marker=Join-Path $target '.labtrack-workspace'
if((Test-Path -LiteralPath $marker) -and (Get-Content -LiteralPath $marker -Raw).Trim() -ne $source) {throw 'Workspace belongs to another source checkout.'}
if((Test-Path -LiteralPath (Join-Path $target 'package.json')) -and ((Get-Content -LiteralPath (Join-Path $target 'package.json') -Raw|ConvertFrom-Json).name -ne 'labtrack-qr')) {throw 'Target is another project.'}
$source|Set-Content -LiteralPath $marker
$lockBefore=if(Test-Path -LiteralPath (Join-Path $target 'package-lock.json')) {(Get-FileHash -LiteralPath (Join-Path $target 'package-lock.json')).Hash} else {''}
foreach($folder in @('src','public','scripts','tests','supabase')) {
 if(Test-Path -LiteralPath (Join-Path $source $folder)) {
  & robocopy (Join-Path $source $folder) (Join-Path $target $folder) /E /XD .temp /NJH /NJS /NP /NFL /NDL | Out-Null
  if($LASTEXITCODE -gt 7) {throw "Could not copy $folder"}
 }
}
Get-ChildItem -LiteralPath $source -File | Where-Object {$_.Name -match '\.(json|mjs|js|ts|md)$' -or $_.Name -eq '.gitignore'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $target $_.Name)}
if(Test-Path -LiteralPath (Join-Path $source '.env.local')) {Copy-Item -LiteralPath (Join-Path $source '.env.local') -Destination (Join-Path $target '.env.local')}
# Remove only tracked source files deleted in the original checkout, within the mirror.
$deleted=& git -C $source ls-files --deleted
foreach($relative in $deleted) {
 $candidate=[IO.Path]::GetFullPath((Join-Path $target $relative))
 if(!$candidate.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)) {throw 'Deleted path escapes workspace.'}
 if(Test-Path -LiteralPath $candidate -PathType Leaf) {Remove-Item -LiteralPath $candidate}
}
Push-Location $target
try {
 if($Mode -eq 'install' -or !(Test-Path -LiteralPath 'node_modules\next\package.json') -or $lockBefore -ne (Get-FileHash -LiteralPath 'package-lock.json').Hash) {
  & npm ci --no-audit --no-fund
  if($LASTEXITCODE -ne 0) {throw 'Dependency installation failed.'}
 }
 if($Mode -ne 'install') {& npm run $Mode; if($LASTEXITCODE -ne 0) {throw "$Mode failed."}}
} finally {Pop-Location}
