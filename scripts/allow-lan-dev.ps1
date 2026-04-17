# Run as admin once:
# powershell.exe -ExecutionPolicy Bypass -File .\scripts\allow-lan-dev.ps1
New-NetFirewallRule -DisplayName "Babun Dev 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
