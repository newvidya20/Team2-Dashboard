Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class PbiWindowTools {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
$pbiWindows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$targetWindow = $null
foreach ($item in $pbiWindows) {
    if ($item.Current.Name -eq 'SarangiCreditReview') { $targetWindow = $item; break }
}
if ($null -eq $targetWindow) { throw 'SarangiCreditReview window was not found; no keys sent.' }
$targetHandle = [IntPtr]$targetWindow.Current.NativeWindowHandle
[PbiWindowTools]::ShowWindow($targetHandle,3) | Out-Null
[PbiWindowTools]::SetForegroundWindow($targetHandle) | Out-Null
# Chromium's top-level accessibility node cannot receive focus; use its native window handle.
Start-Sleep -Milliseconds 800
[System.Windows.Forms.SendKeys]::SendWait('^s')
Start-Sleep -Milliseconds 1800
$screenBounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$capture = New-Object System.Drawing.Bitmap($screenBounds.Width,$screenBounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($capture)
$graphics.CopyFromScreen($screenBounds.Location,[System.Drawing.Point]::Empty,$screenBounds.Size)
$capture.Save((Join-Path $PSScriptRoot 'desktop-verification.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $capture.Dispose()
Write-Output 'Saved SarangiCreditReview and captured its Desktop view.'
