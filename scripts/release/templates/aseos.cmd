@echo off
setlocal
"%~dp0node\node.exe" "%~dp0app\apps\cli\dist\main.js" %*
exit /b %ERRORLEVEL%
