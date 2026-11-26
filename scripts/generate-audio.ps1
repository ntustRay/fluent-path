# Requires Windows, PowerShell, Node.js 20+, ffmpeg and an installed English SAPI voice.
# From the project root, run: pwsh -File scripts/generate-audio.ps1
param([string]$VoiceName)

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$lessonFile = Join-Path $projectDir 'data/lessons.js'
$audioDir = Join-Path $projectDir 'audio'
$nodePath = (Get-Command node -CommandType Application | Select-Object -First 1).Source
$ffmpegPath = (Get-Command ffmpeg -CommandType Application | Select-Object -First 1).Source
$readLessons = @'
import { readFile } from "node:fs/promises";
const source = await readFile(process.argv[2], "utf8");
const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const { lessons } = await import(url);
const lines = lessons.flatMap((lesson) =>
  lesson.questions.filter((question) => question.transcript).map(({ id, transcript }) => ({ id, transcript }))
);
if (!lines.length || lines.some(({id}) => !/^[a-z0-9_-]+$/i.test(id)) ||
    new Set(lines.map(({ id }) => id)).size !== lines.length) {
  throw Error("Listening prompts need unique, filename-safe IDs.");
}
process.stdout.write(JSON.stringify(lines));
'@
$json = $readLessons | & $nodePath --input-type=module - $lessonFile
if ($LASTEXITCODE -ne 0) { throw 'Could not load lesson transcripts.' }
$lines = $json | ConvertFrom-Json

Add-Type -AssemblyName System.Speech
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ('fluentpath-audio-' + [guid]::NewGuid())
$wavFile = Join-Path $tempDir 'prompt.wav'
$mp3File = Join-Path $tempDir 'prompt.mp3'
try {
  $voice = $synth.GetInstalledVoices() | Where-Object {
    $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'en' -and
      (!$VoiceName -or $_.VoiceInfo.Name -eq $VoiceName)
  } | Select-Object -First 1
  if (!$voice) { throw 'Install an English SAPI voice or specify an installed English voice with -VoiceName.' }
  $synth.SelectVoice($voice.VoiceInfo.Name)
  [void][System.IO.Directory]::CreateDirectory($audioDir)
  [void][System.IO.Directory]::CreateDirectory($tempDir)
  foreach ($line in $lines) {
    $synth.SetOutputToWaveFile($wavFile)
    try { $synth.Speak($line.transcript) } finally { $synth.SetOutputToNull() }
    & $ffmpegPath -hide_banner -loglevel error -y -i $wavFile -map_metadata -1 -codec:a libmp3lame -ac 1 -ar 22050 -b:a 32k $mp3File
    if ($LASTEXITCODE -ne 0) { throw "MP3 encoding failed for $($line.id)." }
    Copy-Item -LiteralPath $mp3File -Destination (Join-Path $audioDir ($line.id + '.mp3')) -Force
  }
  Write-Output "Generated $($lines.Count) recordings using $($voice.VoiceInfo.Name)."
} finally {
  $synth.Dispose()
  foreach ($file in @($wavFile, $mp3File)) {
    if ([System.IO.File]::Exists($file)) { [System.IO.File]::Delete($file) }
  }
  if ([System.IO.Directory]::Exists($tempDir)) { [System.IO.Directory]::Delete($tempDir) }
}
