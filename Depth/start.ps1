[CmdletBinding()]
param(
    [switch]$Reload,
    [ValidateRange(1, 65535)]
    [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$backendPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $backendPython)) {
    throw 'Backend environment missing. Run uv sync --extra dev from Depth first.'
}

Push-Location -LiteralPath $PSScriptRoot
try {
    & $backendPython -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        throw 'Database migration failed; FastAPI was not started.'
    }

    $serverArguments = @('-m', 'uvicorn', 'depth.main:app', '--host', '127.0.0.1', '--port', "$Port")
    if ($Reload) {
        $serverArguments += '--reload'
    }
    & $backendPython @serverArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'FastAPI exited with an error.'
    }
}
finally {
    Pop-Location
}
