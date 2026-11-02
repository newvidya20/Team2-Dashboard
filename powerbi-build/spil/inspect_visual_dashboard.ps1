param([switch]$Launch)
$ErrorActionPreference='Stop'
if($Launch){
 $app = Get-CimInstance Win32_Process -Filter "Name='PBIDesktop.exe'" | Select-Object -First 1
 if(-not $app){throw 'Power BI executable not found.'}
 $project=Join-Path $PSScriptRoot 'SudarshanPharmaDashboardFinal\SudarshanPharmaDashboardFinal.pbip'
 Start-Process -FilePath $app.ExecutablePath -ArgumentList ('"'+$project+'"')
 Start-Sleep -Seconds 12
}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public class DashboardWindow {
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int cmd);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@
$null=[DashboardWindow]::SetProcessDPIAware()
$roots=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$roots | Where-Object {$_.Current.Name -like '*Sudarshan*'} | ForEach-Object {Write-Output ("Window: {0}; bounds: {1}; handle: {2}" -f $_.Current.Name,$_.Current.BoundingRectangle,$_.Current.NativeWindowHandle)}
$target=$roots | Where-Object {$_.Current.Name -eq 'SudarshanPharmaDashboardFinal' -and $_.Current.NativeWindowHandle -ne 0} | Sort-Object {$_.Current.BoundingRectangle.Width} -Descending | Select-Object -First 1
if(-not $target){
 $target=$roots | Where-Object {$_.Current.Name -eq 'Untitled - Power BI Desktop'} | Select-Object -First 1
 if(-not $target){$roots | ForEach-Object {$_.Current.Name};exit}
 $target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) | Where-Object {-not $_.Current.IsOffscreen} | ForEach-Object {$_.Current.Name} | Where-Object {$_} | Select-Object -Unique -First 100
 exit
}
$null=[DashboardWindow]::ShowWindow([IntPtr]$target.Current.NativeWindowHandle,3)
$null=[DashboardWindow]::SetForegroundWindow([IntPtr]$target.Current.NativeWindowHandle)
Start-Sleep -Seconds 2
$nodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
foreach($node in $nodes){
 if($node.Current.Name -eq 'Report view' -and -not $node.Current.IsOffscreen){
  $pattern=$null
  if($node.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){$pattern.Select();break}
  if($node.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){$pattern.Invoke();break}
 }
}
Start-Sleep -Seconds 2
$nodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
$names=$nodes | ForEach-Object {$_.Current.Name} | Where-Object {$_} | Select-Object -Unique
$names | Set-Content (Join-Path $PSScriptRoot 'visual-desktop-ui.txt')
$bounds=$target.Current.BoundingRectangle
if([double]::IsInfinity($bounds.Width) -or $bounds.Width -le 0){$names | Select-Object -First 80;exit}
$bitmap=New-Object System.Drawing.Bitmap ([int]$bounds.Width),([int]$bounds.Height)
$graphics=[System.Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
$null=[DashboardWindow]::PrintWindow([IntPtr]$target.Current.NativeWindowHandle,$dc,2)
$graphics.ReleaseHdc($dc)
$bitmap.Save((Join-Path $PSScriptRoot 'visual-desktop.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose();$bitmap.Dispose()
$names | Select-Object -First 80
