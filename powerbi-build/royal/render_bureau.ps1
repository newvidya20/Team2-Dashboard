$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($Operation,[Type]$Type) { $t=$asTask.MakeGenericMethod($Type).Invoke($null,@($Operation));$t.Wait();return $t.Result }
$source=Get-ChildItem -LiteralPath "$PSScriptRoot\sources" -Recurse -Filter 'Neeraj Cibil Report.pdf' | Select-Object -First 1
$file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($source.FullName)) ([Windows.Storage.StorageFile])
$pdf=Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
for($i=0;$i -lt 3;$i++) {
 $page=$pdf.GetPage($i)
 $stream=New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
 $action=$page.RenderToStreamAsync($stream)
 $actionMethod=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
 $actionMethod.Invoke($null,@($action)).Wait()
 $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 $bitmap=Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
 $result=Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
 [IO.File]::WriteAllLines("$PSScriptRoot\scans\bureau-$($i+1).txt",@($result.Lines | ForEach-Object {$_.Text}))
 $stream.Seek(0)
 $reader=New-Object Windows.Storage.Streams.DataReader($stream)
 $null=Await ($reader.LoadAsync([uint32]$stream.Size)) ([uint32])
 $bytes=New-Object byte[] ([int]$stream.Size)
 $reader.ReadBytes($bytes)
 [IO.File]::WriteAllBytes("$PSScriptRoot\scans\bureau-$($i+1).png",$bytes)
 $reader.Dispose();$bitmap.Dispose();$stream.Dispose();$page.Dispose()
 Write-Output "Bureau page $($i+1) rendered and OCR extracted"
}
