@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %ERRORLEVEL%==0 (
    set PYLAUNCHER=py
) else (
    where python >nul 2>nul
    if %ERRORLEVEL%==0 (
        set PYLAUNCHER=python
    ) else (
        echo Python non trovato. Installa Python 3.10 o superiore da https://www.python.org/downloads/
        echo e assicurati di selezionare "Add python.exe to PATH" durante l'installazione.
        pause
        exit /b 1
    )
)

if not exist ".venv" (
    echo Creazione ambiente virtuale Python in .venv ...
    %PYLAUNCHER% -m venv .venv
    if errorlevel 1 (
        echo Impossibile creare l'ambiente virtuale.
        pause
        exit /b 1
    )
)

call ".venv\Scripts\activate.bat"

echo Verifica dipendenze...
python -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
    echo Installazione delle dipendenze fallita. Controlla la connessione o i permessi.
    pause
    exit /b 1
)

echo.
echo Avvio Vendite CRM... il browser si aprira automaticamente.
echo Per chiudere il programma, chiudi questa finestra oppure premi CTRL+C.
echo.
python app.py

pause
