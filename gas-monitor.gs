/**
 * kommons 予約API 自己監視（GAS内蔵版）
 *
 * セットアップ:
 * 1. GASエディタ（line kommons）で新しいファイル「Monitor.gs」を追加
 * 2. このコードを貼り付けて保存
 * 3. installMonitor() を1回だけ実行（5分トリガーが自動登録される）
 * 4. 初回は権限の許可が必要
 *
 * 停止するとき:
 * removeMonitor() を実行
 */

var MONITOR_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyJkyjUM2x9Eiv0AwvtUMi0Syx34jrppeglnXAOVVeVNxGDwDaHhqar255O4rpEqPCj1Q/exec',
  ALERT_EMAIL: 'zonamb11111@gmail.com',
  FAIL_THRESHOLD: 3,
  COOLDOWN_MINUTES: 60
};

function installMonitor() {
  removeMonitor();
  ScriptApp.newTrigger('checkBookingAPI')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Monitor installed — runs every 5 minutes.');
}

function removeMonitor() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'checkBookingAPI') {
      ScriptApp.deleteTrigger(t);
    }
  });
  Logger.log('Monitor removed.');
}

function checkBookingAPI() {
  var props = PropertiesService.getScriptProperties();
  var failCount = parseInt(props.getProperty('monitor_fails') || '0', 10);
  var lastAlertTs = parseInt(props.getProperty('monitor_last_alert') || '0', 10);
  var prevState = props.getProperty('monitor_state') || 'ok';

  var ok = false;
  var httpCode = 0;
  var errorMsg = '';

  try {
    var response = UrlFetchApp.fetch(
      MONITOR_CONFIG.API_URL + '?action=menus&lang=en',
      { muteHttpExceptions: true, followRedirects: true }
    );
    httpCode = response.getResponseCode();
    var body = response.getContentText();

    if (httpCode === 200 && body.indexOf('"menus"') !== -1) {
      ok = true;
    } else {
      errorMsg = 'HTTP ' + httpCode + ', body: ' + body.substring(0, 150);
    }
  } catch (e) {
    errorMsg = 'Fetch error: ' + e.message;
  }

  var now = Math.floor(Date.now() / 1000);

  if (ok) {
    if (prevState !== 'ok') {
      sendMonitorEmail(
        '✅ [kommons予約] API復旧',
        '予約APIが復旧しました。\n\n'
        + 'Time: ' + new Date().toString() + '\n'
        + 'HTTP: ' + httpCode + '\n'
        + '連続失敗回数: ' + failCount + '回'
      );
    }
    props.setProperty('monitor_fails', '0');
    props.setProperty('monitor_state', 'ok');
    return;
  }

  failCount++;
  props.setProperty('monitor_fails', String(failCount));

  if (failCount >= MONITOR_CONFIG.FAIL_THRESHOLD) {
    var cooldownSec = MONITOR_CONFIG.COOLDOWN_MINUTES * 60;
    if (now - lastAlertTs >= cooldownSec) {
      sendMonitorEmail(
        '🚨 [kommons予約] APIダウン検知',
        '予約APIの異常を検知しました。\n\n'
        + 'Time: ' + new Date().toString() + '\n'
        + 'Source: GAS trigger (24h server-side)\n'
        + 'Details: ' + errorMsg + '\n'
        + '連続失敗: ' + failCount + '回\n\n'
        + '対応:\n'
        + '1. ' + MONITOR_CONFIG.API_URL + '?action=menus を直接ブラウザで開いて確認\n'
        + '2. 403が返る場合: GASエディタ → デプロイ管理 → 鉛筆 → 新バージョン → デプロイ\n'
      );
      props.setProperty('monitor_last_alert', String(now));
      props.setProperty('monitor_state', 'down');
    }
  }
}

function sendMonitorEmail(subject, body) {
  try {
    MailApp.sendEmail({
      to: MONITOR_CONFIG.ALERT_EMAIL,
      subject: subject,
      body: body
    });
  } catch (e) {
    Logger.log('Email send failed: ' + e.message);
  }
}

function monitorStatus() {
  var props = PropertiesService.getScriptProperties();
  var status = {
    state: props.getProperty('monitor_state') || 'ok',
    failCount: props.getProperty('monitor_fails') || '0',
    lastAlert: props.getProperty('monitor_last_alert') || 'never'
  };
  Logger.log(JSON.stringify(status, null, 2));
  return status;
}
