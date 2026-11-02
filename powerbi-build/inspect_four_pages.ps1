$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class FourPagesCapture {
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
}
'@
$windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$target=$null
foreach($w in $windows){if($w.Current.Name -eq 'SarangiCreditReview_4Tabs'){$target=$w;break}}
if($null -eq $target){throw 'Four-tab report window not found.'}
foreach($page in @(@('Finance','finance'),@('Financial Calculations','calculations'),@('Banking','banking'),@('GST','gst'))){
 $condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,$page[0])
 $nodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)
 $selected=$false
 foreach($node in $nodes){
  if($node.Current.BoundingRectangle.Top -lt ($target.Current.BoundingRectangle.Bottom-100)){continue}
  $candidate=$node
  for($level=0;$level -lt 3 -and $null -ne $candidate;$level++){
   $pattern=$null
   if($candidate.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){$pattern.Select();$selected=$true;break}
   if($candidate.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){$pattern.Invoke();$selected=$true;break}
   $candidate=[System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($candidate)
  }
  if($selected){break}
 }
 if(-not $selected){Write-Output ('No accessible navigation action for '+$page[0]);continue}
 Start-Sleep -Milliseconds 1100
 $rect=$target.Current.BoundingRectangle
 $bmp=New-Object System.Drawing.Bitmap([int]$rect.Width,[int]$rect.Height)
 $g=[System.Drawing.Graphics]::FromImage($bmp);$dc=$g.GetHdc()
 try{$ok=[FourPagesCapture]::PrintWindow([IntPtr]$target.Current.NativeWindowHandle,$dc,2)}finally{$g.ReleaseHdc($dc)}
 if($ok){$bmp.Save((Join-Path $PSScriptRoot ('checked-'+$page[1]+'.png')),[System.Drawing.Imaging.ImageFormat]::Png);Write-Output ('Inspected '+$page[0])}
 $g.Dispose();$bmp.Dispose()
}
