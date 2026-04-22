@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║       心晴 —— 大学生心理健康陪伴助手           ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: 检查Node.js是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到 Node.js
    echo.
    echo 请先安装 Node.js：
    echo   下载地址：https://nodejs.org/
    echo   选择 LTS 版本安装即可
    pause
    exit /b 1
)

echo ✅ Node.js 已安装
node --version
echo.

:: 检查是否在项目目录
if not exist "package.json" (
    echo ❌ 错误：未找到 package.json
    echo 请确保在项目根目录运行此脚本
    pause
    exit /b 1
)

:: 检查依赖是否已安装
if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo.
    echo ✅ 依赖安装完成
    echo.
)

:: 检查API Key配置
if defined ZHIPU_API_KEY (
    echo ✅ 检测到智谱 API Key（环境变量）
) else (
    :: 检查配置文件
    findstr /C:"apiKey" config\llm-zhipu.json >nul 2>nul
    for /f "tokens=2 delims=:," %%a in ('findstr "apiKey" config\llm-zhipu.json') do (
        set "CONFIG_KEY=%%~a"
    )
    
    if not "%CONFIG_KEY%"=="" "" (
        echo ✅ 检测到智谱 API Key（配置文件）
    ) else (
        echo ⚠️  未检测到 API Key
        echo.
        echo 请选择以下方式之一配置：
        echo.
        echo 方式1（推荐）：设置环境变量
        echo   set ZHIPU_API_KEY=你的密钥
        echo.
        echo 方式2：编辑配置文件
        echo   编辑 config\llm-zhipu.json，填入 apiKey
        echo.
        echo 获取 API Key：https://open.bigmodel.cn/
        echo.
        choice /C YN /M "是否继续启动（AI功能将不可用）"
        if errorlevel 2 exit /b 0
    )
)

echo.
echo ═══════════════════════════════════════════════════
echo 🚀 正在启动心晴助手...
echo ═══════════════════════════════════════════════════
echo.

:: 启动开发服务器
call npm run dev

pause
