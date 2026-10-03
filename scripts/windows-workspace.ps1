param([ValidateSet('dev','verify','install','sync')][string]$Mode='dev', [string]$Workspace='D:\CodexBuilds\LabTrack-audit-20261003')
$ErrorActionPreference='Stop'
$source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target=[IO.Path]::GetFullPath($Workspace).TrimEnd('\')
if(!$target.StartsWith('D:\CodexBuilds\',[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($source,[StringComparison]::OrdinalIgnoreCase)) {throw 'Use a separate folder under D:\CodexBuilds.'}
function AssertOrdinaryPath([string]$Path) {
 $current=[IO.Path]::GetFullPath($Path)
 while($current) {
  if(Test-Path -LiteralPath $current) {
   if((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'Workspace paths cannot use a junction, symbolic link or other reparse point.'}
  }
  $parent=[IO.Directory]::GetParent($current)
  $current=if($parent) {$parent.FullName} else {$null}
 }
}
AssertOrdinaryPath $target
$nodeDirectory=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$node=Join-Path $nodeDirectory 'node.exe'
if(!(Test-Path -LiteralPath $node)) { $node=(Get-Command node -ErrorAction Stop).Source; $nodeDirectory=Split-Path $node }
if((& $node --version) -notmatch '^v24\.') {throw 'Install Node 24 before running this helper.'}
$env:PATH=$nodeDirectory+';'+$env:PATH
$env:TEMP='D:\Temp'; $env:TMP='D:\Temp'; $env:npm_config_cache='D:\DevCaches\npm'
New-Item -ItemType Directory -Path $target,$env:TEMP,$env:npm_config_cache -Force | Out-Null
AssertOrdinaryPath $target
foreach($name in @('node_modules','.next','.labtrack-workspace','.env.local')) {AssertOrdinaryPath (Join-Path $target $name)}
$marker=Join-Path $target '.labtrack-workspace'
if((Test-Path -LiteralPath $marker) -and (Get-Content -LiteralPath $marker -Raw).Trim() -ne $source) {throw 'Workspace belongs to another source checkout.'}
if((Test-Path -LiteralPath (Join-Path $target 'package.json')) -and ((Get-Content -LiteralPath (Join-Path $target 'package.json') -Raw|ConvertFrom-Json).name -ne 'labtrack-qr')) {throw 'Target is another project.'}
$source|Set-Content -LiteralPath $marker
$lockBefore=if(Test-Path -LiteralPath (Join-Path $target 'package-lock.json')) {(Get-FileHash -LiteralPath (Join-Path $target 'package-lock.json')).Hash} else {''}
foreach($folder in @('src','public','scripts','tests','supabase')) {
 $sourceFolder=Join-Path $source $folder
 $targetFolder=Join-Path $target $folder
 AssertOrdinaryPath $targetFolder
 # The mirror's source directories contain only copied project files. Validate
 # every existing entry before copying or removing obsolete individual files.
 $pending=New-Object 'System.Collections.Generic.Queue[string]'
 $existingFiles=New-Object 'System.Collections.Generic.List[string]'
 if(Test-Path -LiteralPath $targetFolder) {$pending.Enqueue($targetFolder)}
 while($pending.Count) {
  foreach($item in (Get-ChildItem -LiteralPath ($pending.Dequeue()) -Force)) {
   if($folder -eq 'supabase' -and $item.Name -in @('.temp','.branches')) {continue}
   AssertOrdinaryPath $item.FullName
   if($item.PSIsContainer) {$pending.Enqueue($item.FullName)} else {$existingFiles.Add($item.FullName)}
  }
 }
 foreach($file in $existingFiles) {
  $relative=$file.Substring($targetFolder.Length+1)
  if(!(Test-Path -LiteralPath (Join-Path $sourceFolder $relative) -PathType Leaf)) {
   $resolved=[IO.Path]::GetFullPath($file)
   if(!$resolved.StartsWith($targetFolder+'\',[StringComparison]::OrdinalIgnoreCase)) {throw 'Obsolete source path escapes mirror.'}
   AssertOrdinaryPath $resolved
   Remove-Item -LiteralPath $resolved
  }
 }
 if(Test-Path -LiteralPath (Join-Path $source $folder)) {
  & robocopy (Join-Path $source $folder) (Join-Path $target $folder) /E /XD .temp /NJH /NJS /NP /NFL /NDL | Out-Null
  if($LASTEXITCODE -gt 7) {throw "Could not copy $folder"}
 }
}
Get-ChildItem -LiteralPath $source -File | Where-Object {$_.Name -match '\.(json|mjs|js|ts|md)$' -or $_.Name -eq '.gitignore'} | ForEach-Object {AssertOrdinaryPath (Join-Path $target $_.Name); Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $target $_.Name)}
if(Test-Path -LiteralPath (Join-Path $source '.env.local')) {Copy-Item -LiteralPath (Join-Path $source '.env.local') -Destination (Join-Path $target '.env.local')}
Push-Location $target
try {
 if($Mode -eq 'install' -or !(Test-Path -LiteralPath 'node_modules\next\package.json') -or $lockBefore -ne (Get-FileHash -LiteralPath 'package-lock.json').Hash) {
  & npm ci --no-audit --no-fund
  if($LASTEXITCODE -ne 0) {throw 'Dependency installation failed.'}
 }
 if($Mode -notin @('install','sync')) {& npm run $Mode; if($LASTEXITCODE -ne 0) {throw "$Mode failed."}}
} finally {Pop-Location}
