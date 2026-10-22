# Starts the local MongoDB the web app uses (see apps/web/.env.local).
# Data lives in %USERPROFILE%\farm-data\mongo-data, outside the repo.
# Prisma needs a replica set for transactions; the first run initiates it.
#
#   powershell -ExecutionPolicy Bypass -File apps/web/scripts/start-local-db.ps1
$ErrorActionPreference = 'Stop'

$mongod = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe'
$root = Join-Path $env:USERPROFILE 'farm-data'
$data = Join-Path $root 'mongo-data'
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $data, $logs | Out-Null

if (Get-NetTCPConnection -LocalPort 27018 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host 'Local MongoDB is already running on port 27018.'
  exit 0
}

$fresh = -not (Get-ChildItem $data -ErrorAction SilentlyContinue | Select-Object -First 1)
Start-Process -FilePath $mongod -WindowStyle Hidden -ArgumentList @(
  '--replSet', 'rs0', '--port', '27018', '--bind_ip', '127.0.0.1',
  '--dbpath', "`"$data`"", '--logpath', "`"$(Join-Path $logs 'mongod.log')`"", '--logappend'
)

for ($i = 0; $i -lt 30 -and -not (Get-NetTCPConnection -LocalPort 27018 -State Listen -ErrorAction SilentlyContinue); $i++) {
  Start-Sleep -Seconds 1
}

if ($fresh) {
  # A brand-new data folder needs its one-member replica set created once.
  Push-Location (Join-Path $PSScriptRoot '..')
  node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasourceUrl:'mongodb://127.0.0.1:27018/admin?directConnection=true'});p.`$runCommandRaw({replSetInitiate:{_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]}}).then(()=>console.log('Replica set created')).catch(e=>console.log(e.message)).finally(()=>p.`$disconnect())"
  Pop-Location
}

Write-Host "Local MongoDB running on port 27018 (data: $data)"
