[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Invoke-Tool([string]$Tool, [string[]]$ToolArgs) {
    & $Tool @ToolArgs
    if ($LASTEXITCODE -ne 0) {
        throw "$(Split-Path -Leaf $Tool) exited with code $LASTEXITCODE."
    }
}

function Get-JdkTool([string]$Name) {
    if ($env:JAVA_HOME) {
        return Join-Path $env:JAVA_HOME "bin\$Name.exe"
    }
    return (Get-Command "$Name.exe" -CommandType Application -ErrorAction Stop).Source
}

$sdkPath = $env:ANDROID_HOME
if (!$sdkPath) { $sdkPath = $env:ANDROID_SDK_ROOT }
if (!$sdkPath) { throw 'Set ANDROID_HOME to your Android SDK directory.' }

$toolsPath = Join-Path $sdkPath 'build-tools\36.0.0'
$androidJar = Join-Path $sdkPath 'platforms\android-36\android.jar'
$aapt = Join-Path $toolsPath 'aapt2.exe'
$align = Join-Path $toolsPath 'zipalign.exe'
$dexTool = Join-Path $toolsPath 'lib\d8.jar'
$signer = Join-Path $toolsPath 'lib\apksigner.jar'
foreach ($required in @($androidJar, $aapt, $align, $dexTool, $signer)) {
    if (!(Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Missing SDK file $required. Install Android SDK Platform 36 and Build Tools 36.0.0."
    }
}

$java = Get-JdkTool 'java'
$javac = Get-JdkTool 'javac'
$jar = Get-JdkTool 'jar'
$keytool = Get-JdkTool 'keytool'
$source = Join-Path $PSScriptRoot 'src'
$build = (New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'build') -Force).FullName
$work = (New-Item -ItemType Directory -Path (Join-Path $build ([guid]::NewGuid().ToString()))).FullName
$apk = Join-Path $build 'ClearWrite-debug.apk'

try {
    $classes = (New-Item -ItemType Directory -Path (Join-Path $work 'classes')).FullName
    $generated = (New-Item -ItemType Directory -Path (Join-Path $work 'generated')).FullName
    $dex = (New-Item -ItemType Directory -Path (Join-Path $work 'dex')).FullName
    $resources = Join-Path $work 'resources.zip'
    $unsigned = Join-Path $work 'unsigned.apk'
    $aligned = Join-Path $work 'aligned.apk'
    $signed = Join-Path $work 'signed.apk'
    $keystore = Join-Path $build 'debug.keystore'

    Invoke-Tool $aapt @('compile', '--dir', (Join-Path $source 'res'), '-o', $resources)
    Invoke-Tool $aapt @('link', '-I', $androidJar, '--manifest', (Join-Path $source 'AndroidManifest.xml'),
        '--min-sdk-version', '26', '--target-sdk-version', '36', '--java', $generated, '-o', $unsigned, $resources)

    $sources = @(Get-ChildItem -LiteralPath @((Join-Path $source 'java'), $generated) -Recurse -Filter '*.java' -File |
        Select-Object -ExpandProperty FullName)
    Invoke-Tool $javac (@('--release', '17', '-encoding', 'UTF-8', '-classpath', $androidJar, '-d', $classes) + $sources)
    $bytecode = @(Get-ChildItem -LiteralPath $classes -Recurse -Filter '*.class' -File | Select-Object -ExpandProperty FullName)
    Invoke-Tool $java (@('-cp', $dexTool, 'com.android.tools.r8.D8', '--min-api', '26',
        '--lib', $androidJar, '--output', $dex) + $bytecode)
    Invoke-Tool $jar @('--update', '--file', $unsigned, '--no-manifest', '-C', $dex, '.')
    Invoke-Tool $align @('-f', '4', $unsigned, $aligned)

    # Android's conventional debug credentials only. Keep the generated key for adb install -r.
    if (!(Test-Path -LiteralPath $keystore)) {
        Invoke-Tool $keytool @('-genkeypair', '-keystore', $keystore, '-storepass', 'android',
            '-keypass', 'android', '-alias', 'androiddebugkey', '-dname', 'CN=Android Debug',
            '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000')
    }
    Invoke-Tool $java @('-jar', $signer, 'sign', '--ks', $keystore, '--ks-pass', 'pass:android',
        '--ks-key-alias', 'androiddebugkey', '--out', $signed, $aligned)
    Invoke-Tool $java @('-jar', $signer, 'verify', '--verbose', $signed)
    Invoke-Tool $align @('-c', '4', $signed)
    Copy-Item -LiteralPath $signed -Destination $apk -Force
    Write-Output "APK: $apk"
} finally {
    $resolvedWork = (Resolve-Path -LiteralPath $work).ProviderPath
    if ($resolvedWork.StartsWith("$build\", [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedWork -Recurse -Force
    }
}
