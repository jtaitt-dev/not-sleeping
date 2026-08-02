[CmdletBinding()]
param(
    [string]$ExtensionName = "Not Sleeping",

    [ValidateRange(1, 30)]
    [int]$TimeoutSeconds = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "This script requires Windows."
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-ExtensionsWindow {
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $windows = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.Condition]::TrueCondition
    )

    foreach ($window in $windows) {
        if ($window.Current.Name -like "Extensions - *Chrome*") {
            return $window
        }
    }

    $extensionsTabCondition = [System.Windows.Automation.AndCondition]::new(
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::NameProperty,
            "Extensions"
        ),
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::TabItem
        )
    )

    foreach ($window in $windows) {
        if ($window.Current.Name -notlike "* - Google Chrome") {
            continue
        }

        $extensionsTab = $window.FindFirst(
            [System.Windows.Automation.TreeScope]::Descendants,
            $extensionsTabCondition
        )

        if ($null -eq $extensionsTab) {
            continue
        }

        $selection = $extensionsTab.GetCurrentPattern(
            [System.Windows.Automation.SelectionItemPattern]::Pattern
        )
        $selection.Select()
        Start-Sleep -Milliseconds 300
        return $window
    }

    return $null
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$extensionsWindow = Get-ExtensionsWindow

while ($null -eq $extensionsWindow -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 200
    $extensionsWindow = Get-ExtensionsWindow
}

if ($null -eq $extensionsWindow) {
    throw "Could not find an open chrome://extensions tab."
}

$nameCondition = [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty,
        $ExtensionName
    ),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
        "name"
    )
)

$extensionLabel = $extensionsWindow.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    $nameCondition
)

if ($null -eq $extensionLabel) {
    throw "Could not find the '$ExtensionName' extension card."
}

$card = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent(
    $extensionLabel
)

if ($null -eq $card) {
    throw "Could not resolve the '$ExtensionName' extension card."
}

$reloadCondition = [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button
    ),
    [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
        "dev-reload-button"
    )
)

$reloadButton = $card.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    $reloadCondition
)

if ($null -eq $reloadButton) {
    throw "Could not find Reload for '$ExtensionName'. Is Developer mode enabled?"
}

$invokePattern = $reloadButton.GetCurrentPattern(
    [System.Windows.Automation.InvokePattern]::Pattern
)

$invokePattern.Invoke()
Write-Host "Reloaded Chrome extension: $ExtensionName"
