$BOT = 'https://api.telegram.org/bot8312523483:AAE2ytCMngLe8018QUJagfiyoiWosJaCWqU'
$CHAT = '-1004260140479'

$c = Invoke-RestMethod -Uri "$BOT/getChat?chat_id=$CHAT" -TimeoutSec 20
$pinned = $c.result.pinned_message
Write-Host ("pinned doc: " + $pinned.document.file_name + " (msg " + $pinned.message_id + ")")

$f = Invoke-RestMethod -Uri "$BOT/getFile?file_id=$($pinned.document.file_id)" -TimeoutSec 20
$token = $BOT -replace '^.*/bot', ''
$bytes = (Invoke-WebRequest -Uri "https://api.telegram.org/file/bot$token/$($f.result.file_path)" -TimeoutSec 30).Content
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
Write-Host "--- db content:"
Write-Host $text
