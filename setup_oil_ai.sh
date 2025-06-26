#!/usr/bin/env bash
# setup_oil_ai.sh  (v2 - fallback آلي لتثبيت TensorFlow على جميع بيئات macOS)
# يجرّب بالترتيب: tensorflow-macos ثم tensorflow الرسمي، بناءً على بنية الجهاز وإصدار بايثون.

set -e

PROJECT_DIR="$HOME/oil_ai"
SOURCE_PY="oil_ai_unified.py"
PYTHON_BIN="python3"

echo "⏳ إنشاء المجلد $PROJECT_DIR ..."
mkdir -p "$PROJECT_DIR"
cp "$SOURCE_PY" "$PROJECT_DIR"/

cd "$PROJECT_DIR"
$PYTHON_BIN -m venv .venv
source .venv/bin/activate

echo "⏳ تحديث pip وتثبيت الحزم العامة ..."
pip install --upgrade pip setuptools wheel
pip install streamlit pandas numpy scikit-learn

PY_VER=$($PYTHON_BIN -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
ARCH=$(uname -m)

echo "🔍 Python $PY_VER على $ARCH – محاولة تثبيت TensorFlow ..."

install_tf () {
  pkg=$1
  version=$2
  echo "⬇️  pip install $pkg$version ..."
  if pip install "$pkg$version"; then
    echo "✅ TensorFlow تم تثبيته بنجاح ($pkg$version)"
    return 0
  else
    echo "❌ فشل التثبيت: $pkg$version"
    return 1
  fi
}

# محاولات بالترتيب
if [[ "$ARCH" == "arm64" ]]; then
  install_tf "tensorflow-macos" "==2.16.0" ||   install_tf "tensorflow-macos" ""           ||   install_tf "tensorflow" "==2.15.0"
else
  install_tf "tensorflow" "==2.16.0"        ||   install_tf "tensorflow" ">=2.15,<2.16"    ||   install_tf "tensorflow" "==2.15.0"
fi

# تسريع GPU على Apple Silicon إن أمكن
[[ "$ARCH" == "arm64" ]] && pip install tensorflow-metal || true

echo "⏳ إنشاء launch.json لـ VS Code ..."
mkdir -p .vscode
cat > .vscode/launch.json <<'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Streamlit: Oil AI",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/.venv/bin/streamlit",
      "args": ["run", "${workspaceFolder}/oil_ai_unified.py"],
      "console": "integratedTerminal"
    }
  ]
}
EOF

echo "✅ المشروع جاهز! يفتح VS Code الآن..."
code "$PROJECT_DIR"

echo -e "\n========== ماذا بعد =========="
echo "1) داخل VS Code تأكد أن التيرمنال يُظهر (.venv)."
echo "2) لتشغيل التطبيق: ▶️  Run («Streamlit: Oil AI») أو:"
echo "   streamlit run oil_ai_unified.py"
echo "3) Ctrl+C لإيقاف، ثم deactivate للخروج."
echo "================================"
