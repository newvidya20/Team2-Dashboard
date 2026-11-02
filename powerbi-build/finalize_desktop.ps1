Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class FinalizePbiWindow {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
'@
$pbiWindows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$targetWindow = $null
foreach ($item in $pbiWindows) { if ($item.Current.Name -eq 'SarangiCreditReview') { $targetWindow=$item; break } }
if ($null -eq $targetWindow) { throw 'SarangiCreditReview window was not found; no keys sent.' }
$targetHandle=[IntPtr]$targetWindow.Current.NativeWindowHandle
if (-not [FinalizePbiWindow]::SetForegroundWindow($targetHandle)) { throw 'Could not focus the report; no keys sent.' }
Start-Sleep -Milliseconds 700
[System.Windows.Forms.SendKeys]::SendWait('^s')
Start-Sleep -Milliseconds 2000
[FinalizePbiWindow]::PostMessage($targetHandle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
Start-Sleep -Milliseconds 3000
$remaining=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
foreach ($item in $remaining) { if ($item.Current.Name -eq 'SarangiCreditReview') { throw 'Report is still open; did not edit report files.' } }
python (Join-Path $PSScriptRoot 'finalize_files.py')
if ($LASTEXITCODE -ne 0) { throw 'File finalization failed.' }
Start-Process -FilePath 'C:\Users\loanb\OneDrive\Desktop\Power BI\SarangiCreditReview\SarangiCreditReview.pbip'
Write-Output 'Saved model, adjusted card layout and reopened the final report.'
