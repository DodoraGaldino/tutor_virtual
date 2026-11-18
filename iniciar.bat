@echo off
title Tutor Virtual - Inicializador
echo ==============================================
echo        Iniciando o Tutor Virtual...
echo ==============================================

echo [1/2] Iniciando o Backend FastAPI (porta 8000)...
start "Backend (FastAPI)" cmd /k "cd /d C:\Users\isado\Desktop\Tutor_virtual01 && .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

echo [2/2] Iniciando o Frontend Next.js (porta 3000)...
start "Frontend (Next.js)" cmd /k "cd /d C:\Users\isado\Desktop\Tutor_virtual01\frontend && ^"C:\Program Files\nodejs\npm.cmd^" run dev"

echo.
echo Aguardando inicializacao...
timeout /t 5 >nul

echo Abrindo o navegador...
start http://localhost:3000

echo Tudo pronto!
