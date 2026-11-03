$ErrorActionPreference = "Stop"

$ModelDir = Join-Path $PSScriptRoot "models"
$ModelPath = Join-Path $ModelDir "face_landmarker.task"
$ModelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
$ExpectedSha256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"

New-Item -ItemType Directory -Force -Path $ModelDir | Out-Null
Invoke-WebRequest -Uri $ModelUrl -OutFile $ModelPath
$ActualSha256 = (Get-FileHash -Algorithm SHA256 -Path $ModelPath).Hash.ToLowerInvariant()

if ($ActualSha256 -ne $ExpectedSha256) {
    Remove-Item -Force $ModelPath
    throw "MediaPipe model SHA-256 mismatch. Expected $ExpectedSha256, got $ActualSha256"
}

Write-Host "Verified MediaPipe Face Landmarker model: $ActualSha256"
