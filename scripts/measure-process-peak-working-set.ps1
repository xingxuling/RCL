param(
  [Parameter(Mandatory = $true)]
  [string]$Binary,

  [Parameter(Mandatory = $true)]
  [string]$InputFile
)

$ErrorActionPreference = 'Stop'

$resolvedBinary = (Resolve-Path -LiteralPath $Binary).Path
$resolvedInput = (Resolve-Path -LiteralPath $InputFile).Path
if ((Get-Item -LiteralPath $resolvedInput).Length -eq 0) {
  throw "Input request is empty: $resolvedInput"
}
$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $resolvedBinary
$startInfo.Arguments = "execute `"$resolvedInput`""
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
if (-not $process.Start()) {
  throw "Unable to start $resolvedBinary"
}

$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()

[long]$peakWorkingSetBytes = 0
do {
  try {
    $process.Refresh()
    $peakWorkingSetBytes = [Math]::Max($peakWorkingSetBytes, [long]$process.WorkingSet64)
    $peakWorkingSetBytes = [Math]::Max($peakWorkingSetBytes, [long]$process.PeakWorkingSet64)
  } catch {
    # A process can exit between HasExited/WaitForExit and a memory-counter refresh.
  }
} while (-not $process.WaitForExit(1))
$process.WaitForExit()

$result = [ordered]@{
  exitCode = $process.ExitCode
  peakWorkingSetBytes = $peakWorkingSetBytes
  stdout = $stdoutTask.GetAwaiter().GetResult()
  stderr = $stderrTask.GetAwaiter().GetResult()
}

$process.Dispose()
$result | ConvertTo-Json -Compress -Depth 3
