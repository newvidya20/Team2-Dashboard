param([string]$Page='', [string]$Year='', [switch]$Save, [switch]$ApplyExternal, [switch]$ScrollDown, [switch]$ScrollTop, [switch]$ReportView)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class SpilWindow {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetPhysicalCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr info);
}
'@
$null=[SpilWindow]::SetProcessDPIAware()
$target=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition) | Where-Object {$_.Current.Name -eq 'SudarshanPharmaCreditReview' -and $_.Current.BoundingRectangle.Width -gt 600 -and -not [double]::IsInfinity($_.Current.BoundingRectangle.Width)} | Sort-Object { $_.Current.BoundingRectangle.Width * $_.Current.BoundingRectangle.Height } -Descending | Select-Object -First 1
if($null -eq $target){throw 'Sudarshan Pharma Power BI window not found.'}
$handle=[IntPtr]$target.Current.NativeWindowHandle
$null=[SpilWindow]::ShowWindow($handle,9)
$null=[SpilWindow]::SetForegroundWindow($handle)
Start-Sleep -Milliseconds 500
$nodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
if($ReportView) {
 foreach($node in $nodes) {
  if($node.Current.Name -ne 'Report view' -or $node.Current.IsOffscreen){continue}
  $pattern=$null
  if($node.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){$pattern.Select();break}
  if($node.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){$pattern.Invoke();break}
  if($node.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern,[ref]$pattern)){$pattern.DoDefaultAction();break}
  $bounds=$node.Current.BoundingRectangle
  if($bounds.Width -gt 0 -and $bounds.Width -lt 200) {
   $null=[SpilWindow]::SetPhysicalCursorPos([int]($bounds.Left+$bounds.Width/2),[int]($bounds.Top+$bounds.Height/2))
   [SpilWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[SpilWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
   break
  }
 }
 Start-Sleep -Milliseconds 900
 $nodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
}
if($ApplyExternal) {
 foreach($node in $nodes) {
  if($node.Current.Name -eq 'Apply external changes') {
   $pattern=$node.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
   $pattern.Invoke()
   Start-Sleep -Seconds 4
   break
  }
 }
 $nodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
}
if($Page) {
 foreach($node in $nodes) {
  if($node.Current.Name -ne $Page){continue}
  if($node.Current.IsOffscreen){continue}
  $bounds=$node.Current.BoundingRectangle
  if($bounds.Top -lt ($target.Current.BoundingRectangle.Bottom-100)){continue}
  $null=[SpilWindow]::SetPhysicalCursorPos([int]($bounds.Left+$bounds.Width/2),[int]($bounds.Top+$bounds.Height/2))
  [SpilWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
  [SpilWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  break
  $candidate=$node
  for($i=0;$i -lt 3 -and $candidate;$i++) {
   $pattern=$null
   if($candidate.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){$pattern.Select();break}
   if($candidate.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){$pattern.Invoke();break}
   $candidate=[System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($candidate)
  }
 }
 Start-Sleep -Milliseconds 1200
}
if($ScrollTop) {
 $null=[SpilWindow]::SetPhysicalCursorPos([int]($target.Current.BoundingRectangle.Left+800),[int]($target.Current.BoundingRectangle.Top+520))
 [SpilWindow]::mouse_event(2048,0,0,2400,[UIntPtr]::Zero)
 Start-Sleep -Milliseconds 700
}
if($Year) {
 $clicked=$false
 $yearNodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 foreach($node in $yearNodes) {
  if($node.Current.Name -ne $Year -or $node.Current.IsOffscreen){continue}
  $bounds=$node.Current.BoundingRectangle
  $windowRect=$target.Current.BoundingRectangle
  if($bounds.Width -lt 60 -or $bounds.Height -gt 70){continue}
  $null=[SpilWindow]::SetPhysicalCursorPos([int]($bounds.Left+$bounds.Width/2),[int]($bounds.Top+$bounds.Height/2))
  [SpilWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[SpilWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 3000
  $clicked=$true
  break
 }
 if(-not $clicked) {
  throw 'Visible financial-year button not found; no fallback click was attempted.'
 }
}
if($ScrollDown) {
 $null=[SpilWindow]::SetPhysicalCursorPos([int]($target.Current.BoundingRectangle.Left+800),[int]($target.Current.BoundingRectangle.Top+520))
 [SpilWindow]::mouse_event(2048,0,0,4294966336,[UIntPtr]::Zero)
 Start-Sleep -Milliseconds 800
}
if($Save){[System.Windows.Forms.SendKeys]::SendWait('^s');Start-Sleep -Milliseconds 1600}
$names=@($target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object {$_.Current.Name})
[IO.File]::WriteAllLines("$PSScriptRoot\desktop-ui.txt",$names)
$names | Where-Object {$_} | Select-Object -First 100
$nativeRect=New-Object SpilWindow+RECT
$null=[SpilWindow]::GetWindowRect($handle,[ref]$nativeRect)
$rect=[PSCustomObject]@{Width=($nativeRect.Right-$nativeRect.Left);Height=($nativeRect.Bottom-$nativeRect.Top)}
$bmp=New-Object System.Drawing.Bitmap([int]$rect.Width,[int]$rect.Height)
$g=[System.Drawing.Graphics]::FromImage($bmp);$dc=$g.GetHdc()
try{$null=[SpilWindow]::PrintWindow($handle,$dc,2)}finally{$g.ReleaseHdc($dc)}
$filename=if($Year){'desktop-finance-'+$Year+'.png'}elseif($ScrollDown){'desktop-finance-detail.png'}elseif($Page){'desktop-'+$Page.Substring(0,1)+'.png'}else{'desktop.png'}
$bmp.Save((Join-Path $PSScriptRoot $filename),[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$bmp.Dispose()
