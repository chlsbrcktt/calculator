# Start backend
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd "$PSScriptRoot\backend"; ..\backend\venv\Scripts\uvicorn main:app --reload --port 8001'

# Start frontend
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd "$PSScriptRoot\frontend"; npm run dev'

Write-Host "Starting servers..."
Write-Host "Backend: http://localhost:8001"
Write-Host "Frontend: http://localhost:5174"
