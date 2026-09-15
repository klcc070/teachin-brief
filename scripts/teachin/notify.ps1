# notify.ps1 - bottom-right popup briefing; click the button to open the reminder page
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path (Join-Path $dir '..\..')).Path
$brief = Join-Path $root 'data\teachin\brief.md'
$page = Join-Path $root '宣讲会提醒.html'

$body = ''
if (Test-Path $brief) {
    $body = ((Get-Content $brief -Encoding UTF8) | Select-Object -First 8) -join "`r`n"
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = '宣讲会简报'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.Size = New-Object System.Drawing.Size(460, 300)
$form.StartPosition = 'Manual'
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$form.Location = New-Object System.Drawing.Point(($wa.Right - $form.Width - 24), ($wa.Bottom - $form.Height - 24))

$label = New-Object System.Windows.Forms.Label
$label.Text = $body
$label.Font = New-Object System.Drawing.Font('Microsoft YaHei', 9)
$label.Location = New-Object System.Drawing.Point(14, 12)
$label.Size = New-Object System.Drawing.Size(416, 176)
$form.Controls.Add($label)

$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text = '打开简报'
$btnOpen.Location = New-Object System.Drawing.Point(14, 206)
$btnOpen.Size = New-Object System.Drawing.Size(200, 36)
$btnOpen.Add_Click({
    if (Test-Path $page) { Start-Process $page }
    $form.Close()
})
$form.Controls.Add($btnOpen)

$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = '关闭'
$btnClose.Location = New-Object System.Drawing.Point(230, 206)
$btnClose.Size = New-Object System.Drawing.Size(200, 36)
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

# 90 秒无人处理则自动收起
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 90000
$timer.Add_Tick({ $form.Close() })
$timer.Start()

$form.Add_Shown({ $form.Activate() })
[void]$form.ShowDialog()
$timer.Stop()
