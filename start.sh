#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Rihlati Smart Core — one-command start (macOS / Linux)
#  Usage:  ./start.sh          → install + build + run
#          ./start.sh test     → run the 13-scenario simulator only
#  دليل كامل: docs/14-activation-and-run-guide.md
# ─────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

say() { printf "\n\033[1;34m▸ %s\033[0m\n" "$1"; }
die() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }

# 1) Node.js 20+
command -v node >/dev/null 2>&1 || die "Node.js غير مثبت. ثبّته من https://nodejs.org (نسخة LTS) ثم أعد تشغيل هذا السكربت."
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
[ "$NODE_MAJOR" -ge 20 ] || die "إصدار Node قديم ($(node -v)). المطلوب 20 أو أحدث — حدّثه من https://nodejs.org"
say "Node $(node -v) ✓"

# 2) Correct branch (code lives on the feature branch until PR #1 is merged)
if [ ! -d apps/api ]; then
  say "الكود غير موجود على هذا الفرع — أنتقل للفرع الصحيح…"
  git checkout claude/libyan-travel-platform-eyfwpa || die "نفّذ يدوياً: git checkout claude/libyan-travel-platform-eyfwpa"
fi

# 3) Install + build (skipped automatically if already done)
if [ ! -d node_modules ]; then say "تثبيت الاعتماديات (مرة واحدة، ~دقيقة)…"; npm install; fi
if [ ! -d packages/shared-types/dist ]; then say "بناء الحزمة المشتركة…"; npm run build -w @rihlati/shared-types; fi

# 4) Simulator-only mode
if [ "$1" = "test" ]; then say "تشغيل المحاكي — 13 سيناريو…"; npm run simulate; exit 0; fi

# 5) Free the port if a previous run is stuck, then start
PORT="${API_PORT:-3000}"
if lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  say "المنفذ $PORT مشغول — أستخدم 3001 بدلاً منه"
  PORT=3001
fi

say "تشغيل النظام… (للإيقاف: Ctrl+C)"
printf "\n  🖥  بوابة العملاء:    http://localhost:%s/admin/portal.html   (رمز OTP التجريبي: 123456)\n" "$PORT"
printf "  🛠  واجهة المشغّلين:  http://localhost:%s/admin/admin.html    (admin@rihlati.test / Admin@12345)\n" "$PORT"
printf "  💬  واجهة الدعم:     http://localhost:%s/admin/support.html  (support@rihlati.test / Support@12345)\n\n" "$PORT"

API_PORT="$PORT" npm run dev
