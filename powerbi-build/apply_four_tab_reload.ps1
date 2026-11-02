$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
$windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$target=$null
foreach($w in $windows){if($w.Current.Name -eq 'SarangiCreditReview_4Tabs'){$target=$w;break}}
if($null -eq $target){throw 'Four-tab report window not found.'}
$condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Apply external changes')
$button=$target.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition)
if($null -eq $button){Write-Output 'No pending apply button exposed through UIAutomation.';exit 0}
$invoke=$null
if($button.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$invoke)){$invoke.Invoke();Write-Output 'Applied the report layout changes.'}else{
    $legacy=$null
    if($button.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern,[ref]$legacy)){$legacy.DoDefaultAction();Write-Output 'Applied report layout changes using native accessibility.'}else{Write-Output 'Apply button is visible but does not expose an invoke action.'}
}
