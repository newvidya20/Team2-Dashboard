$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
$windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$target=$null
foreach($w in $windows){if($w.Current.Name -eq 'SarangiCreditReview_4Tabs'){$target=$w;break}}
if($null -eq $target){throw 'Four-tab report window not found.'}
$nodes=$target.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
foreach($node in $nodes){
 if($node.Current.Name -in @('Save','Save (Ctrl+S)','Save, Ctrl+S','Save (Ctrl + S)')){
  $invoke=$null
  if($node.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$invoke)){$invoke.Invoke();Write-Output 'Saved four-tab report through Power BI accessibility.';exit 0}
 }
}
throw 'No unambiguous Save button exposed; no keyboard shortcut sent.'
