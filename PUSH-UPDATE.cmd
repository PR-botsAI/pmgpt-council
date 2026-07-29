@echo off
cd /d "%~dp0"
echo Publishing PMGPT Agent Arena to GitHub...
git status
git push -u origin main
if errorlevel 1 (
  echo.
  echo Push failed. Confirm you are signed into GitHub, then run this file again.
) else (
  echo.
  echo SUCCESS: PMGPT Agent Arena was published to GitHub.
  echo Site: https://pr-botsai.github.io/pmgpt-council/
)
pause
