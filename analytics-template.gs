/**
 * kommons 分析ダッシュボード自動生成スクリプト
 *
 * 使い方:
 * 1. Google Sheets を新規作成
 * 2. 拡張機能 → Apps Script
 * 3. このコードを貼り付けて保存
 * 4. buildDashboard() を実行
 * 5. 初回は権限の許可が必要
 */

function buildDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('kommons 分析ダッシュボード');

  buildWeekly(ss);
  buildMonthly(ss);
  buildFunnel(ss);
  buildImprovementLog(ss);
  buildKPI(ss);

  // Delete default Sheet1 if it exists
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('シート1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  ss.getSheets()[0].activate();
  SpreadsheetApp.flush();
}

/* ── Shared helpers ── */
var HEADER_BG = '#1a1a1a';
var HEADER_FG = '#ffffff';
var ACCENT = '#b8956a';
var GREEN_BG = '#e6f4ea';
var GREEN_FG = '#137333';
var RED_BG = '#fce8e6';
var RED_FG = '#c5221f';
var YELLOW_BG = '#fef7e0';
var YELLOW_FG = '#b05a00';
var GRAY_BG = '#f1f3f4';

function sectionHeader(sheet, row, lastCol, title) {
  var range = sheet.getRange(row, 1, 1, lastCol);
  range.merge().setValue(title)
    .setBackground(HEADER_BG).setFontColor(HEADER_FG)
    .setFontSize(13).setFontWeight('bold');
}

function subHeader(sheet, row, headers) {
  for (var i = 0; i < headers.length; i++) {
    var cell = sheet.getRange(row, i + 1);
    cell.setValue(headers[i]).setFontWeight('bold').setFontSize(10)
      .setBackground('#f5f0ea').setFontColor('#1a1a1a')
      .setBorder(false, false, true, false, false, false, '#e8e6e1', SpreadsheetApp.BorderStyle.SOLID);
  }
}

function addWowFormatting(sheet, col, startRow, numRows) {
  var range = sheet.getRange(startRow, col, numRows, 1);
  var rules = sheet.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0).setBackground(GREEN_BG).setFontColor(GREEN_FG).setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0).setBackground(RED_BG).setFontColor(RED_FG).setRanges([range]).build());
  sheet.setConditionalFormatRules(rules);
}

/* ── SHEET 1: 週次ダッシュボード ── */
function buildWeekly(ss) {
  var s = ss.insertSheet('週次ダッシュボード');
  s.setFrozenRows(2);
  s.setFrozenColumns(1);

  sectionHeader(s, 1, 22, '週次パフォーマンス / Weekly Performance');

  var headers = [
    '週開始日\nWeek Start',
    'PV',
    'ユーザー\nUsers',
    'フォーム閲覧\nForm Views',
    'メニュー選択\nMenu Select',
    '日付選択\nDate Select',
    '時間選択\nTime Select',
    '情報送信\nInfo Submit',
    '予約完了\nBookings',
    '予約売上(¥)\nRevenue',
    '診断完了\nCurator',
    'EN率\nEN %',
    'エラー数\nErrors',
    'Ads費用(¥)\nAds Spend',
    'Ads CV\n(全合計)',
    '— 計算列 —',
    'CVR\n(閲覧→予約)',
    '平均単価(¥)\nAvg Ticket',
    'CPA(¥)',
    'ROAS',
    'PV\n前週比',
    '予約\n前週比'
  ];
  subHeader(s, 2, headers);

  // Set column widths
  s.setColumnWidth(1, 100);
  for (var i = 2; i <= 22; i++) s.setColumnWidth(i, 85);
  s.setColumnWidth(10, 100);
  s.setColumnWidth(16, 30);

  // Format date column
  s.getRange('A3:A54').setNumberFormat('yyyy/mm/dd');
  // Format currency
  s.getRange('J3:J54').setNumberFormat('#,##0');
  s.getRange('N3:N54').setNumberFormat('#,##0');
  s.getRange('R3:R54').setNumberFormat('#,##0');
  s.getRange('S3:S54').setNumberFormat('#,##0');
  // Format percentages
  s.getRange('L3:L54').setNumberFormat('0.0%');
  s.getRange('Q3:Q54').setNumberFormat('0.0%');
  s.getRange('U3:U54').setNumberFormat('+0.0%;-0.0%');
  s.getRange('V3:V54').setNumberFormat('+0.0%;-0.0%');

  // Formulas for rows 3-54
  for (var r = 3; r <= 54; r++) {
    // CVR (Form View → Booking)
    s.getRange(r, 17).setFormula('=IF(D'+r+'=0,"—",I'+r+'/D'+r+')');
    // Avg ticket
    s.getRange(r, 18).setFormula('=IF(I'+r+'=0,"—",J'+r+'/I'+r+')');
    // CPA
    s.getRange(r, 19).setFormula('=IF(O'+r+'=0,"—",N'+r+'/O'+r+')');
    // ROAS
    s.getRange(r, 20).setFormula('=IF(N'+r+'=0,"—",J'+r+'/N'+r+')');
    if (r > 3) {
      // PV WoW
      s.getRange(r, 21).setFormula('=IF(B'+(r-1)+'=0,"—",(B'+r+'-B'+(r-1)+')/B'+(r-1)+')');
      // Bookings WoW
      s.getRange(r, 22).setFormula('=IF(I'+(r-1)+'=0,"—",(I'+r+'-I'+(r-1)+')/I'+(r-1)+')');
    }
  }

  // Divider column
  s.getRange(3, 16, 52, 1).setBackground('#e8e6e1');

  // Conditional formatting - WoW columns
  addWowFormatting(s, 21, 3, 52);
  addWowFormatting(s, 22, 3, 52);

  // Error column - red if > 0
  var errRange = s.getRange('M3:M54');
  var rules = s.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0).setBackground(RED_BG).setFontColor(RED_FG).setRanges([errRange]).build());
  s.setConditionalFormatRules(rules);
}

/* ── SHEET 2: 月次分析 ── */
function buildMonthly(ss) {
  var s = ss.insertSheet('月次分析');
  s.setFrozenRows(2);

  sectionHeader(s, 1, 17, '月次サマリー / Monthly Summary');

  var headers = [
    '月\nMonth', '総PV', '総ユーザー\nUsers', '新規\nNew',
    '予約数\nBookings', '売上(¥)\nRevenue', '平均単価(¥)\nAvg Ticket',
    '稼働日\nDays', '日平均予約\nBook/Day', '日平均売上(¥)\nRev/Day',
    'EN予約\nEN Book', 'EN率\nEN %', '診断経由\nCurator', '診断率\nCurator %',
    'LINE経由\nLINE', 'LINE率\nLINE %', '前月比予約\nMoM Book'
  ];
  subHeader(s, 2, headers);

  s.setColumnWidth(1, 90);
  for (var i = 2; i <= 17; i++) s.setColumnWidth(i, 85);
  s.getRange('A3:A14').setNumberFormat('yyyy/mm');
  s.getRange('F3:F14').setNumberFormat('#,##0');
  s.getRange('G3:G14').setNumberFormat('#,##0');
  s.getRange('J3:J14').setNumberFormat('#,##0');
  s.getRange('L3:L14').setNumberFormat('0.0%');
  s.getRange('N3:N14').setNumberFormat('0.0%');
  s.getRange('P3:P14').setNumberFormat('0.0%');
  s.getRange('Q3:Q14').setNumberFormat('+0.0%;-0.0%');

  for (var r = 3; r <= 14; r++) {
    s.getRange(r, 7).setFormula('=IF(E'+r+'=0,"—",F'+r+'/E'+r+')');
    s.getRange(r, 9).setFormula('=IF(H'+r+'=0,"—",E'+r+'/H'+r+')');
    s.getRange(r, 10).setFormula('=IF(H'+r+'=0,"—",F'+r+'/H'+r+')');
    s.getRange(r, 12).setFormula('=IF(E'+r+'=0,"—",K'+r+'/E'+r+')');
    s.getRange(r, 14).setFormula('=IF(E'+r+'=0,"—",M'+r+'/E'+r+')');
    s.getRange(r, 16).setFormula('=IF(E'+r+'=0,"—",O'+r+'/E'+r+')');
    if (r > 3) {
      s.getRange(r, 17).setFormula('=IF(E'+(r-1)+'=0,"—",(E'+r+'-E'+(r-1)+')/E'+(r-1)+')');
    }
  }

  addWowFormatting(s, 17, 3, 12);

  // --- Ads section ---
  sectionHeader(s, 17, 10, '広告パフォーマンス / Ads Performance');
  var adsH = [
    '月\nMonth', '表示\nImpr.', 'クリック\nClicks', 'CTR',
    '費用(¥)\nSpend', 'CV数\nConversions', 'CPA(¥)', 'ROAS',
    '広告売上(¥)\nAds Rev', '前月比CV\nMoM CV'
  ];
  subHeader(s, 18, adsH);

  s.getRange('E19:E30').setNumberFormat('#,##0');
  s.getRange('G19:G30').setNumberFormat('#,##0');
  s.getRange('I19:I30').setNumberFormat('#,##0');
  s.getRange('D19:D30').setNumberFormat('0.0%');

  for (var r = 19; r <= 30; r++) {
    s.getRange(r, 4).setFormula('=IF(B'+r+'=0,"—",C'+r+'/B'+r+')');
    s.getRange(r, 7).setFormula('=IF(F'+r+'=0,"—",E'+r+'/F'+r+')');
    s.getRange(r, 8).setFormula('=IF(E'+r+'=0,"—",I'+r+'/E'+r+')');
    if (r > 19) {
      s.getRange(r, 10).setFormula('=IF(F'+(r-1)+'=0,"—",(F'+r+'-F'+(r-1)+')/F'+(r-1)+')');
    }
  }
}

/* ── SHEET 3: ファネル分析 ── */
function buildFunnel(ss) {
  var s = ss.insertSheet('ファネル分析');
  s.setFrozenRows(3);
  s.setFrozenColumns(2);

  sectionHeader(s, 1, 15, '予約ファネル / Booking Funnel');

  s.getRange(2, 1).setValue('ステップ / Step').setFontWeight('bold');
  s.getRange(2, 2).setValue('イベント名').setFontWeight('bold');
  s.getRange(3, 1).setValue('').setFontWeight('bold');
  s.getRange(3, 2).setValue('');

  // Week columns C-O (13 weeks)
  for (var w = 0; w < 13; w++) {
    s.getRange(2, 3 + w).setValue('Week ' + (w + 1)).setFontWeight('bold')
      .setBackground('#f5f0ea').setHorizontalAlignment('center');
    s.getRange(3, 3 + w).setValue('MM/DD').setFontColor('#888').setFontSize(9)
      .setHorizontalAlignment('center');
  }

  var steps = [
    ['1. ページ閲覧', 'book_form_view'],
    ['2. 言語選択', 'select_language'],
    ['3. メニュー選択', 'select_menu'],
    ['4. 日付選択', 'select_date'],
    ['5. 時間選択', 'select_time'],
    ['6. 情報送信', 'submit_info'],
    ['7. 予約クリック', 'book_click'],
    ['8. 予約完了', 'book_complete'],
    ['エラー', 'api_error + book_error']
  ];

  for (var i = 0; i < steps.length; i++) {
    var row = 4 + i;
    s.getRange(row, 1).setValue(steps[i][0]).setFontWeight('bold');
    s.getRange(row, 2).setValue(steps[i][1]).setFontColor('#888').setFontSize(9);
  }

  s.setColumnWidth(1, 160);
  s.setColumnWidth(2, 140);
  for (var c = 3; c <= 15; c++) s.setColumnWidth(c, 75);

  // Drop-off section
  sectionHeader(s, 15, 15, 'ステップ間離脱率 / Drop-off Rate');

  var dropLabels = [
    '閲覧 → 言語選択', '言語 → メニュー', 'メニュー → 日付',
    '日付 → 時間', '時間 → 情報送信', '情報 → 予約クリック',
    '予約クリック → 完了', '全体CVR (閲覧→完了)', '最大離脱ステップ'
  ];

  for (var i = 0; i < dropLabels.length; i++) {
    s.getRange(16 + i, 1).setValue(dropLabels[i]).setFontWeight('bold');
  }

  // Drop-off formulas for each week column
  var colLetter = ['C','D','E','F','G','H','I','J','K','L','M','N','O'];
  for (var w = 0; w < 13; w++) {
    var cl = colLetter[w];
    for (var d = 0; d < 7; d++) {
      var srcRow1 = 4 + d;
      var srcRow2 = 5 + d;
      s.getRange(16 + d, 3 + w).setFormula(
        '=IF(' + cl + srcRow1 + '=0,"—",1-(' + cl + srcRow2 + '/' + cl + srcRow1 + '))'
      ).setNumberFormat('0.0%');
    }
    // Overall CVR
    s.getRange(23, 3 + w).setFormula(
      '=IF(' + cl + '4=0,"—",' + cl + '11/' + cl + '4)'
    ).setNumberFormat('0.0%');
    // Worst drop-off step
    s.getRange(24, 3 + w).setFormula(
      '=IF(MAX(' + cl + '16:' + cl + '22)=0,"—",INDEX($A$16:$A$22,MATCH(MAX(' + cl + '16:' + cl + '22),' + cl + '16:' + cl + '22,0)))'
    ).setFontSize(9);
  }

  // Conditional formatting for drop-off rates
  var dropRange = s.getRange(16, 3, 7, 13);
  var rules = s.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0.5).setBackground(RED_BG).setFontColor(RED_FG).setRanges([dropRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(0.3, 0.5).setBackground(YELLOW_BG).setFontColor(YELLOW_FG).setRanges([dropRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThanOrEqualTo(0.15).setBackground(GREEN_BG).setFontColor(GREEN_FG).setRanges([dropRange]).build());
  s.setConditionalFormatRules(rules);
}

/* ── SHEET 4: 改善ログ ── */
function buildImprovementLog(ss) {
  var s = ss.insertSheet('改善ログ');
  s.setFrozenRows(2);

  sectionHeader(s, 1, 11, '改善記録 / Improvement Log');

  var headers = [
    '実施日\nDate', 'カテゴリ\nCategory', '変更内容\nWhat Changed',
    '仮説\nHypothesis', '対象KPI\nTarget KPI', '変更前\nBefore',
    '変更後\nAfter', '変化率\nChange %', '計測期間\nPeriod',
    '判定\nResult', 'メモ\nNotes'
  ];
  subHeader(s, 2, headers);

  s.setColumnWidth(1, 100);
  s.setColumnWidth(2, 100);
  s.setColumnWidth(3, 250);
  s.setColumnWidth(4, 200);
  s.setColumnWidth(5, 120);
  s.setColumnWidth(6, 80);
  s.setColumnWidth(7, 80);
  s.setColumnWidth(8, 80);
  s.setColumnWidth(9, 100);
  s.setColumnWidth(10, 100);
  s.setColumnWidth(11, 200);

  s.getRange('A3:A54').setNumberFormat('yyyy/mm/dd');
  s.getRange('H3:H54').setNumberFormat('+0.0%;-0.0%');

  // Category dropdown
  var catRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['UI/UX', 'コピー', 'メニュー', '広告', 'SEO', 'LINE', '診断', '技術', 'その他'])
    .setAllowInvalid(false).build();
  s.getRange('B3:B54').setDataValidation(catRule);

  // KPI dropdown
  var kpiRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['CVR', '予約数', '売上', '離脱率', 'CPA', 'ROAS', 'エラー率', '診断CVR', 'EN率', '平均単価'])
    .setAllowInvalid(false).build();
  s.getRange('E3:E54').setDataValidation(kpiRule);

  // Result dropdown
  var resRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['成功', '失敗', '変化なし', '継続観察'])
    .setAllowInvalid(false).build();
  s.getRange('J3:J54').setDataValidation(resRule);

  // Change % formula
  for (var r = 3; r <= 54; r++) {
    s.getRange(r, 8).setFormula('=IF(OR(F'+r+'=0,F'+r+'=""),"—",(G'+r+'-F'+r+')/F'+r+')');
  }

  // Conditional formatting
  var rules = s.getConditionalFormatRules();
  var changeRange = s.getRange('H3:H54');
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0).setBackground(GREEN_BG).setFontColor(GREEN_FG).setRanges([changeRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0).setBackground(RED_BG).setFontColor(RED_FG).setRanges([changeRange]).build());

  var resRange = s.getRange('J3:J54');
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('成功').setBackground(GREEN_BG).setFontColor(GREEN_FG).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('失敗').setBackground(RED_BG).setFontColor(RED_FG).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('継続観察').setBackground(YELLOW_BG).setFontColor(YELLOW_FG).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('変化なし').setBackground(GRAY_BG).setRanges([resRange]).build());
  s.setConditionalFormatRules(rules);

  // Summary section
  s.getRange(56, 1).setValue('改善サマリー').setFontWeight('bold').setFontSize(12);
  s.getRange(57, 1).setValue('総テスト数');
  s.getRange(57, 2).setFormula('=COUNTA(A3:A54)');
  s.getRange(58, 1).setValue('成功数');
  s.getRange(58, 2).setFormula('=COUNTIF(J3:J54,"成功")');
  s.getRange(59, 1).setValue('成功率');
  s.getRange(59, 2).setFormula('=IF(B57=0,"—",B58/B57)').setNumberFormat('0.0%');
}

/* ── SHEET 5: KPI目標 ── */
function buildKPI(ss) {
  var s = ss.insertSheet('KPI目標');
  s.setFrozenRows(2);

  sectionHeader(s, 1, 9, 'KPI目標管理 / KPI Target Tracking');

  var headers = [
    'KPI項目\nMetric', '単位\nUnit', '月間目標\nTarget',
    '今月実績\nActual', '達成率\nProgress', '達成ペース\nPace',
    '先月実績\nLast Month', '前月比\nMoM', 'メモ\nNotes'
  ];
  subHeader(s, 2, headers);

  s.setColumnWidth(1, 180);
  s.setColumnWidth(2, 50);
  s.setColumnWidth(3, 90);
  s.setColumnWidth(4, 90);
  s.setColumnWidth(5, 80);
  s.setColumnWidth(6, 90);
  s.setColumnWidth(7, 90);
  s.setColumnWidth(8, 80);
  s.setColumnWidth(9, 180);

  var kpis = [
    ['月間予約数', '件'],
    ['月間売上', '¥'],
    ['平均予約単価', '¥'],
    ['日平均予約数', '件'],
    ['CVR (閲覧→予約)', '%'],
    ['CVR (メニュー→予約)', '%'],
    ['診断→予約率', '%'],
    ['EN予約比率', '%'],
    ['CPA', '¥'],
    ['ROAS', '倍'],
    ['エラー率', '%']
  ];

  for (var i = 0; i < kpis.length; i++) {
    var row = 3 + i;
    s.getRange(row, 1).setValue(kpis[i][0]).setFontWeight('bold');
    s.getRange(row, 2).setValue(kpis[i][1]).setFontColor('#888');
    // Progress formula
    s.getRange(row, 5).setFormula('=IF(OR(C'+row+'=0,C'+row+'=""),"—",D'+row+'/C'+row+')').setNumberFormat('0%');
    // Pace: check if on track (simple: >=80% = on pace)
    s.getRange(row, 6).setFormula('=IF(E'+row+'="—","—",IF(E'+row+'>=0.8,"◎ 順調","△ 遅れ"))');
    // MoM
    s.getRange(row, 8).setFormula('=IF(OR(G'+row+'=0,G'+row+'=""),"—",(D'+row+'-G'+row+')/G'+row+')').setNumberFormat('+0.0%;-0.0%');
  }

  // Currency formatting
  s.getRange('C4:D4').setNumberFormat('#,##0');
  s.getRange('G4:G4').setNumberFormat('#,##0');
  s.getRange('C5:D5').setNumberFormat('#,##0');
  s.getRange('G5:G5').setNumberFormat('#,##0');
  s.getRange('C11:D11').setNumberFormat('#,##0');
  s.getRange('G11:G11').setNumberFormat('#,##0');

  // Conditional formatting for progress
  var progRange = s.getRange('E3:E13');
  var rules = s.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThanOrEqualTo(1).setBackground(GREEN_BG).setFontColor(GREEN_FG).setRanges([progRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(0.7, 0.999).setBackground(YELLOW_BG).setFontColor(YELLOW_FG).setRanges([progRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.7).setBackground(RED_BG).setFontColor(RED_FG).setRanges([progRange]).build());

  // Pace column formatting
  var paceRange = s.getRange('F3:F13');
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('順調').setBackground(GREEN_BG).setFontColor(GREEN_FG).setRanges([paceRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('遅れ').setBackground(RED_BG).setFontColor(RED_FG).setRanges([paceRange]).build());

  addWowFormatting(s, 8, 3, 11);
  s.setConditionalFormatRules(rules);

  // Quarterly section
  sectionHeader(s, 16, 7, '四半期目標 / Quarterly Goals');
  var qHeaders = ['四半期\nQuarter', '予約目標\nBook Target', '売上目標(¥)\nRev Target',
    '予約実績\nActual Book', '売上実績(¥)\nActual Rev', '予約達成率\nBook %', '売上達成率\nRev %'];
  subHeader(s, 17, qHeaders);

  var quarters = ['2026 Q1', '2026 Q2', '2026 Q3', '2026 Q4'];
  for (var i = 0; i < quarters.length; i++) {
    var row = 18 + i;
    s.getRange(row, 1).setValue(quarters[i]);
    s.getRange(row, 3).setNumberFormat('#,##0');
    s.getRange(row, 5).setNumberFormat('#,##0');
    s.getRange(row, 6).setFormula('=IF(B'+row+'=0,"—",D'+row+'/B'+row+')').setNumberFormat('0%');
    s.getRange(row, 7).setFormula('=IF(C'+row+'=0,"—",E'+row+'/C'+row+')').setNumberFormat('0%');
  }
}
