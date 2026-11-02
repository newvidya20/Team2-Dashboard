$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class PbiReadOnlyCapture {
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint f);
}
'@
$windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$target=$null
foreach($w in $windows){if($w.Current.Name -eq 'SarangiCreditReview_4Tabs'){$target=$w;break}}
if($null -eq $target){throw 'Four-tab report window not found.'}
$rect=$target.Current.BoundingRectangle
$bmp=New-Object System.Drawing.Bitmap([int]$rect.Width,[int]$rect.Height)
$graphics=[System.Drawing.Graphics]::FromImage($bmp)
$dc=$graphics.GetHdc()
try{$ok=[PbiReadOnlyCapture]::PrintWindow([IntPtr]$target.Current.NativeWindowHandle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
if(-not $ok){throw 'Power BI window capture was not available.'}
$bmp.Save((Join-Path $PSScriptRoot 'four-tabs-window.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose();$bmp.Dispose()
Write-Output 'Captured the four-tab report window without changing focus.'
