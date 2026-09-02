#!/bin/bash
# ==============================================================================
# TÂM AN CARE V7.5 — STANDALONE MAC LAUNCHER
# Double-click to launch Tâm An Care as a native desktop application on macOS
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$DIR")")"
DIST_DIR="$PROJECT_ROOT/frontend/dist"

echo "=================================================================="
echo "  🚀 KHIỂN CHẠY TÂM AN CARE V7.5 — NATIVE MAC DESKTOP APP"
echo "=================================================================="

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Chưa tìm thấy thư mục dist. Đang tiến hành build..."
  cd "$PROJECT_ROOT/frontend" && npm run build
fi

# Kill any existing server on 5173
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start preview server in background
cd "$PROJECT_ROOT/frontend"
npx vite preview --host 127.0.0.1 --port 5173 > /dev/null 2>&1 &
SERVER_PID=$!

sleep 1.5

echo "✅ Đã khởi chạy server ứng dụng tại http://127.0.0.1:5173"
echo "📱 Đang mở cửa sổ ứng dụng desktop Tâm An Care..."

# Open in Chrome App Mode if Chrome is installed, else open in default browser
if [ -d "/Applications/Google Chrome.app" ]; then
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app=http://127.0.0.1:5173 --window-size=1280,850 &
else
  open "http://127.0.0.1:5173"
fi

echo "=================================================================="
echo "  Tâm An Care V7.5 đang chạy độc lập. Đóng cửa sổ này khi xong."
echo "=================================================================="
