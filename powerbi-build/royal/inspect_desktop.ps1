param([string]$Page='', [string]$Year='', [switch]$Save, [switch]$ApplyExternal, [switch]$ScrollDown, [switch]$ScrollTop)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class RoyalWindow {
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr info);
}
'@
$null=[RoyalWindow]::SetProcessDPIAware()
$target=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition) | Where-Object {$_.Current.Name -eq 'RoyalEnterprisesCreditReview'} | Select-Object -First 1
if($null -eq $target){throw 'Royal Enterprises Power BI window not found.'}
$handle=[IntPtr]$target.Current.NativeWindowHandle
$null=[RoyalWindow]::ShowWindow($handle,9)
$null=[RoyalWindow]::SetForegroundWindow($handle)
Start-Sleep -Milliseconds 500
$nodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
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
  $null=[RoyalWindow]::SetCursorPos([int]($bounds.Left+$bounds.Width/2),[int]($bounds.Top+$bounds.Height/2))
  [RoyalWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
  [RoyalWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
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
 $null=[RoyalWindow]::SetCursorPos([int]($target.Current.BoundingRectangle.Left+800),[int]($target.Current.BoundingRectangle.Top+520))
 [RoyalWindow]::mouse_event(2048,0,0,2400,[UIntPtr]::Zero)
 Start-Sleep -Milliseconds 700
}
if($Year) {
 $clicked=$false
 $yearNodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 foreach($node in $yearNodes) {
  if($node.Current.Name -ne $Year -or $node.Current.IsOffscreen){continue}
  $bounds=$node.Current.BoundingRectangle
  $windowRect=$target.Current.BoundingRectangle
  if($bounds.Top -lt ($windowRect.Top+185) -or $bounds.Top -gt ($windowRect.Top+240) -or $bounds.Left -gt ($windowRect.Left+450)){continue}
  $null=[RoyalWindow]::SetCursorPos([int]($bounds.Left+$bounds.Width/2),[int]($bounds.Top+$bounds.Height/2))
  [RoyalWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[RoyalWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 3000
  $clicked=$true
  break
 }
 if(-not $clicked) {
  $offset=@{'2023-24'=141;'2024-25'=253;'2025-26'=365}[$Year]
  if(-not $offset){throw 'Unsupported statement year.'}
  $null=[RoyalWindow]::SetCursorPos([int]($target.Current.BoundingRectangle.Left+$offset),[int]($target.Current.BoundingRectangle.Top+221))
  [RoyalWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[RoyalWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 3000
 }
}
if($ScrollDown) {
 $null=[RoyalWindow]::SetCursorPos([int]($target.Current.BoundingRectangle.Left+800),[int]($target.Current.BoundingRectangle.Top+520))
 [RoyalWindow]::mouse_event(2048,0,0,4294966336,[UIntPtr]::Zero)
 Start-Sleep -Milliseconds 800
}
if($Save){[System.Windows.Forms.SendKeys]::SendWait('^s');Start-Sleep -Milliseconds 1600}
$names=@($target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object {$_.Current.Name})
[IO.File]::WriteAllLines("$PSScriptRoot\desktop-ui.txt",$names)
$names | Where-Object {$_} | Select-Object -First 100
$rect=$target.Current.BoundingRectangle
$bmp=New-Object System.Drawing.Bitmap([int]$rect.Width,[int]$rect.Height)
$g=[System.Drawing.Graphics]::FromImage($bmp);$dc=$g.GetHdc()
try{$null=[RoyalWindow]::PrintWindow($handle,$dc,2)}finally{$g.ReleaseHdc($dc)}
$filename=if($Year){'desktop-finance-'+$Year+'.png'}elseif($ScrollDown){'desktop-finance-detail.png'}elseif($Page){'desktop-'+$Page.Substring(0,1)+'.png'}else{'desktop.png'}
$bmp.Save((Join-Path $PSScriptRoot $filename),[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$bmp.Dispose()
