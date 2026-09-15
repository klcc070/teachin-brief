@echo off
rem Daily teachin brief: incremental update + toast notify. Log: data\teachin\update.log
cd /d "%~dp0..\.."
if not exist "data\teachin" mkdir "data\teachin"
node scripts\teachin\update.mjs --notify >> "data\teachin\update.log" 2>&1
