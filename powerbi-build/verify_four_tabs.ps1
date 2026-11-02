param([string]$CaptureName='four-tabs-gst.png',[switch]$CaptureAll,[switch]$ApplyExternal)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class FourTabWindow {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a,uint b,bool on);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr info);
}
'@
$windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$target=$null
foreach($w in $windows){if($w.Current.Name -eq 'SarangiCreditReview_4Tabs'){$target=$w;break}}
if($null -eq $target){throw 'Four-tab report window not found; no keys sent.'}
$handle=[IntPtr]$target.Current.NativeWindowHandle
$targetPid=[uint32]$target.Current.ProcessId
[FourTabWindow]::ShowWindow($handle,3)|Out-Null
[FourTabWindow]::SetForegroundWindow($handle)|Out-Null
Start-Sleep -Milliseconds 300
$foregroundPid=[uint32]0
$foregroundThread=[FourTabWindow]::GetWindowThreadProcessId([FourTabWindow]::GetForegroundWindow(),[ref]$foregroundPid)
if($foregroundPid -ne $targetPid){
 $currentThread=[FourTabWindow]::GetCurrentThreadId()
 [FourTabWindow]::AttachThreadInput($currentThread,$foregroundThread,$true)|Out-Null
 try{[FourTabWindow]::SetForegroundWindow($handle)|Out-Null}finally{[FourTabWindow]::AttachThreadInput($currentThread,$foregroundThread,$false)|Out-Null}
}
Start-Sleep -Milliseconds 250
$foregroundPid=[uint32]0
[FourTabWindow]::GetWindowThreadProcessId([FourTabWindow]::GetForegroundWindow(),[ref]$foregroundPid)|Out-Null
if($foregroundPid -ne $targetPid){throw 'Could not confirm foreground report; no keys sent or screenshot captured.'}
if($ApplyExternal){
 $applyCondition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Apply external changes')
 $apply=$target.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$applyCondition)
 if($null -ne $apply){
  $pattern=$null
  if($apply.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){$pattern.Invoke();Start-Sleep -Milliseconds 2500}
 }
}
[System.Windows.Forms.SendKeys]::SendWait('^s')
Start-Sleep -Milliseconds 4000
$foregroundPid=[uint32]0
[FourTabWindow]::GetWindowThreadProcessId([FourTabWindow]::GetForegroundWindow(),[ref]$foregroundPid)|Out-Null
if($foregroundPid -ne $targetPid){throw 'Focus changed before capture; no unrelated screen captured.'}
$rect=$target.Current.BoundingRectangle
function Capture-Pbi([string]$name){
 $activePid=[uint32]0
 [FourTabWindow]::GetWindowThreadProcessId([FourTabWindow]::GetForegroundWindow(),[ref]$activePid)|Out-Null
 if($activePid -ne $targetPid){throw 'Report lost focus; capture cancelled.'}
 $bmp=New-Object System.Drawing.Bitmap([int]$rect.Width,[int]$rect.Height)
 $g=[System.Drawing.Graphics]::FromImage($bmp)
 $g.CopyFromScreen([int]$rect.X,[int]$rect.Y,0,0,$bmp.Size)
 $out=Join-Path $PSScriptRoot $name
 $bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
 $g.Dispose();$bmp.Dispose()
 Write-Output ('Captured: '+$out)
}
Capture-Pbi $CaptureName
if($CaptureAll){
 foreach($page in @(@('finance',280),@('banking',360),@('calculations',475),@('gst',208))){
  $activePid=[uint32]0
  [FourTabWindow]::GetWindowThreadProcessId([FourTabWindow]::GetForegroundWindow(),[ref]$activePid)|Out-Null
  if($activePid -ne $targetPid){throw 'Report lost focus; no navigation clicks sent.'}
  [FourTabWindow]::SetCursorPos([int]($rect.X+$page[1]),[int]($rect.Bottom-42))|Out-Null
  [FourTabWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
  [FourTabWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 1400
  Capture-Pbi ('four-tabs-'+$page[0]+'.png')
 }
 [System.Windows.Forms.SendKeys]::SendWait('^s')
}
Write-Output 'Desktop report verification finished.'
