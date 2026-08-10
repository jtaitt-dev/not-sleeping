[CmdletBinding()]
param(
    [string]$ExtensionName = "Not Sleeping",

    [ValidateRange(1, 30)]
    [int]$TimeoutSeconds = 10,

    [bool]$RefreshSleeperTabs = $true
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

function Refresh-SleeperTabs {
    param(
        [Parameter(Mandatory)]
        [System.Windows.Automation.AutomationElement]$ChromeWindow
    )

    $tabCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::TabItem
    )
    $tabs = $ChromeWindow.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        $tabCondition
    )
    $refreshed = 0

    foreach ($tab in $tabs) {
        if ($tab.Current.Name -notlike "*Sleeper*") {
            continue
        }

        $selection = $tab.GetCurrentPattern(
            [System.Windows.Automation.SelectionItemPattern]::Pattern
        )
        $selection.Select()
        Start-Sleep -Milliseconds 150

        $reloadButton = $null
        foreach ($buttonName in @("Reload this page", "Reload")) {
            $buttonCondition = [System.Windows.Automation.AndCondition]::new(
                [System.Windows.Automation.PropertyCondition]::new(
                    [System.Windows.Automation.AutomationElement]::NameProperty,
                    $buttonName
                ),
                [System.Windows.Automation.PropertyCondition]::new(
                    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                    [System.Windows.Automation.ControlType]::Button
                )
            )
            $reloadButton = $ChromeWindow.FindFirst(
                [System.Windows.Automation.TreeScope]::Descendants,
                $buttonCondition
            )
            if ($null -ne $reloadButton) {
                break
            }
        }

        if ($null -eq $reloadButton) {
            Write-Warning "Reloaded the extension, but could not refresh Sleeper tab '$($tab.Current.Name)'."
            continue
        }

        $reload = $reloadButton.GetCurrentPattern(
            [System.Windows.Automation.InvokePattern]::Pattern
        )
        $reload.Invoke()
        $refreshed += 1
        Start-Sleep -Milliseconds 250
    }

    return $refreshed
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

$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$reloadButton = $null
$candidate = $walker.GetNextSibling($extensionLabel)

while ($null -ne $candidate) {
    $candidateId = $candidate.Current.AutomationId

    # Chrome flattens every extension card under one accessibility parent.
    # Stop at the next card instead of searching descendants and accidentally
    # reloading whichever unpacked extension appears first on the page.
    if ($candidateId -eq "name") {
        break
    }

    if (
        $candidateId -eq "dev-reload-button" -and
        $candidate.Current.ControlType -eq
            [System.Windows.Automation.ControlType]::Button
    ) {
        $reloadButton = $candidate
        break
    }

    $candidate = $walker.GetNextSibling($candidate)
}

if ($null -eq $reloadButton) {
    throw "Could not find Reload for '$ExtensionName'. Is Developer mode enabled?"
}

$invokePattern = $reloadButton.GetCurrentPattern(
    [System.Windows.Automation.InvokePattern]::Pattern
)

$invokePattern.Invoke()
Write-Host "Reloaded Chrome extension: $ExtensionName"

if ($RefreshSleeperTabs) {
    Start-Sleep -Milliseconds 500
    $refreshedTabs = Refresh-SleeperTabs -ChromeWindow $extensionsWindow
    Write-Host "Refreshed Sleeper tabs after extension reload: $refreshedTabs"
}
