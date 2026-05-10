#!/bin/bash
# kommons 予約API 死活監視 (5分おきにlaunchdから実行)
# v2: 誤検知対策 — 連続失敗のみ通知、302/000をスキップ
set -uo pipefail

DEPLOY_URL="https://script.google.com/macros/s/AKfycbyJkyjUM2x9Eiv0AwvtUMi0Syx34jrppeglnXAOVVeVNxGDwDaHhqar255O4rpEqPCj1Q/exec"
LOG_DIR="$HOME/.kommons/logs"
LOG_FILE="$LOG_DIR/monitor_booking.log"
STATE_FILE="$LOG_DIR/monitor_booking.state"
FAIL_COUNT_FILE="$LOG_DIR/monitor_booking.failcount"
ALERT_THRESHOLD=3  # 連続N回失敗で初めて通知

mkdir -p "$LOG_DIR"
ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*" >> "$LOG_FILE"; }

# ── ネットワーク接続チェック（Wi-Fi切断/スリープ対策）──
if ! ping -c1 -W3 8.8.8.8 &>/dev/null && ! ping -c1 -W3 1.1.1.1 &>/dev/null; then
  log "SKIP (no network connectivity — likely sleep/Wi-Fi off)"
  exit 0
fi

prev_state="ok"
last_alert_ts=0
if [[ -f "$STATE_FILE" ]]; then
  prev_state=$(awk 'NR==1{print}' "$STATE_FILE" 2>/dev/null || echo "ok")
  last_alert_ts=$(awk 'NR==2{print}' "$STATE_FILE" 2>/dev/null || echo "0")
fi

fail_count=0
if [[ -f "$FAIL_COUNT_FILE" ]]; then
  fail_count=$(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo "0")
fi

http_code=$(curl -sSL -o /tmp/kommons_monitor.out -w '%{http_code}' \
  --max-time 15 "${DEPLOY_URL}?action=menus" 2>>"$LOG_FILE" || echo "000")

ok=0
if [[ "$http_code" == "200" ]] && grep -q '"menus"' /tmp/kommons_monitor.out; then
  ok=1
elif [[ "$http_code" == "302" ]]; then
  # GAS redirects are normal behavior
  ok=1
fi

now_ts=$(date +%s)
if [[ "$ok" == "1" ]]; then
  if [[ "$prev_state" != "ok" ]]; then
    osascript -e 'display notification "予約API復旧しました" with title "kommons monitor"' 2>/dev/null
    log "RECOVERED (HTTP $http_code)"
  else
    log "OK"
  fi
  echo "ok" > "$STATE_FILE"; echo "0" >> "$STATE_FILE"
  echo "0" > "$FAIL_COUNT_FILE"
else
  fail_count=$((fail_count + 1))
  echo "$fail_count" > "$FAIL_COUNT_FILE"
  body_excerpt=$(head -c 200 /tmp/kommons_monitor.out 2>/dev/null | tr -d '\n')
  log "FAIL $fail_count/$ALERT_THRESHOLD (HTTP=$http_code, body=$body_excerpt)"

  if (( fail_count >= ALERT_THRESHOLD )); then
    alert_cooldown=$((60 * 60))
    if (( now_ts - last_alert_ts >= alert_cooldown )); then
      osascript -e "display notification \"予約APIがダウン (HTTP $http_code, ${fail_count}回連続)\" with title \"kommons monitor\" sound name \"Sosumi\"" 2>/dev/null
      details_enc=$(printf '%s' "HTTP=${http_code}_fails=${fail_count}_body=${body_excerpt}" | sed 's/[^A-Za-z0-9.~_-]/_/g' | head -c 200)
      ping_code=$(curl -sSL -o /dev/null -w '%{http_code}' --max-time 10 \
        "${DEPLOY_URL}?action=ping_fail&source=mac_launchd&details=${details_enc}" 2>>"$LOG_FILE" || echo "000")
      log "ALERT_SENT (mac_notify=ok, gas_email=HTTP $ping_code)"
      echo "down" > "$STATE_FILE"; echo "$now_ts" >> "$STATE_FILE"
    else
      echo "down" > "$STATE_FILE"; echo "$last_alert_ts" >> "$STATE_FILE"
    fi
  fi
fi

if [[ -f "$LOG_FILE" ]] && [[ $(wc -c < "$LOG_FILE") -gt 1048576 ]]; then
  tail -1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
rm -f /tmp/kommons_monitor.out
