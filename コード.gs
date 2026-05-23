// ============================================================
// kommons GBP Automation — Google Apps Script
// ============================================================

var CONFIG = {
  ACCOUNT_ID: '101092433226282413885',
  LOCATION_ID: '17829111237745850902',
  GBP_BASE: 'https://mybusiness.googleapis.com/v4',
  ANTHROPIC_API_KEY: PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY'),
  DRIVE_FOLDER_ID: '108ireWS1jrrk97AW3rFNVrLhNWwlsy2H',
  NOTIFICATION_EMAIL: 'zonamb11111@gmail.com'
};

function gbpFetch_(method, path, payload) {
  var url = CONFIG.GBP_BASE + '/accounts/' + CONFIG.ACCOUNT_ID + '/locations/' + CONFIG.LOCATION_ID + path;
  var token = ScriptApp.getOAuthToken();
  var options = {
    method: method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = response.getContentText();
  Logger.log('[' + code + '] ' + method + ' ' + path);
  var parsed = {};
  try { parsed = JSON.parse(body); } catch (e) { parsed = { error: { code: code, message: body.substring(0, 200) } }; }
  return { code: code, body: parsed };
}

function callClaude_(systemPrompt, userPrompt) {
  if (!CONFIG.ANTHROPIC_API_KEY || CONFIG.ANTHROPIC_API_KEY === 'YOUR_KEY_HERE') {
    throw new Error('ANTHROPIC_API_KEY が未設定です');
  }
  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  var text = response.getContentText();
  Logger.log('Claude API status: ' + code);
  if (code !== 200) { Logger.log('Claude API error: ' + text.substring(0, 500)); throw new Error('Claude API returned ' + code); }
  var data = JSON.parse(text);
  if (!data.content || !Array.isArray(data.content)) throw new Error('Claude API unexpected format');
  return data.content.map(function(c) { return c.text || ''; }).join('');
}

function getDriveFiles_() {
  var token = ScriptApp.getOAuthToken();
  var resp = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files?q=%27' + CONFIG.DRIVE_FOLDER_ID + '%27+in+parents+and+trashed%3Dfalse&fields=files(id,name,mimeType)&pageSize=50',
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) {
    Logger.log('Drive API error: ' + resp.getContentText().substring(0, 300));
    return [];
  }
  return JSON.parse(resp.getContentText()).files || [];
}

function makeDriveFilePublic_(fileId) {
  var token = ScriptApp.getOAuthToken();
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '/permissions', {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ role: 'reader', type: 'anyone' }),
    muteHttpExceptions: true
  });
}

// ============================================================
// テスト（デバッグ版 — レスポンスbodyを出力）
// ============================================================
function testGbpApi() {
  Logger.log('=== GBP API テスト ===');
  var reviews = gbpFetch_('get', '/reviews?pageSize=3', null);
  Logger.log('レビュー code: ' + reviews.code);
  Logger.log('レビュー body: ' + JSON.stringify(reviews.body));
  var posts = gbpFetch_('get', '/localPosts?pageSize=3', null);
  Logger.log('投稿 code: ' + posts.code);
  Logger.log('投稿 body: ' + JSON.stringify(posts.body));
}

function testClaudeApi() {
  Logger.log('=== Claude API テスト ===');
  try {
    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 100, messages: [{ role: 'user', content: 'Say hello in 5 words.' }] }),
      muteHttpExceptions: true
    });
    Logger.log('Status: ' + resp.getResponseCode());
    Logger.log('Body: ' + resp.getContentText().substring(0, 500));
  } catch (e) { Logger.log('❌ ' + e.message); }
}

function testDriveApi() {
  Logger.log('=== Drive API テスト ===');
  var files = getDriveFiles_();
  Logger.log('ファイル数: ' + files.length);
  files.forEach(function(f) { Logger.log(f.name + ' (' + f.mimeType + ')'); });
}

// ============================================================
// 2. レビュー返信
// ============================================================
var REVIEW_REPLY_SYSTEM = [
  'You generate review reply options for a hair salon in Koenji, Tokyo.',
  'Brand: kommons (currently operating as HAIR IS YOUR SIGNATURE).',
  'Stylist: Hikaru, 15+ years experience, specializes in English-speaking service and European/Western hair.',
  '',
  'TONE: Write as Hikaru (first person). Warm and genuine, like thanking a friend. Confident but humble.',
  'Reference something specific from the review. Vary sentence structure across options.',
  '',
  'SEO KEYWORDS (weave in naturally, 1-2 per reply, English only):',
  '- "Koenji" or "Koenji, Tokyo"',
  '- "English-speaking hair salon" or "English-speaking stylist"',
  '- Specific service mentioned in review',
  '',
  'STRUCTURE: EN 3-4 sentences, then blank line, then JP 3-4 sentences (です/ます polite form).',
  'No hashtags, no emojis, no salon name.',
  'JP is NOT a translation — write independently in natural Japanese.',
  '',
  'NEVER USE:',
  '- "Thank you so much for your kind words!"',
  '- "I always aim to..." / "It\'s my goal to..."',
  '- "I\'d love to welcome you again anytime!"',
  '',
  'EDGE CASES:',
  '- Negative (★1-3): Acknowledge without being defensive, express genuine regret.',
  '- No text (★ only): Keep short (2-3 sentences EN + JP).',
  '- Japanese review: Reply in EN + JP as usual.',
  '',
  'Return ONLY valid JSON, no markdown:',
  '{"replies":[{"label":"A","en":"...","ja":"..."},{"label":"B","en":"...","ja":"..."},{"label":"C","en":"...","ja":"..."}]}'
].join('\n');

function checkAndDraftReviewReplies() {
  Session.getEffectiveUser().getEmail();
  Logger.log('=== レビューチェック開始 ===');
  var reviews = gbpFetch_('get', '/reviews?pageSize=20&orderBy=updateTime desc', null);
  if (reviews.code !== 200) { Logger.log('レビュー取得失敗: ' + reviews.code); return; }
  var unreplied = (reviews.body.reviews || []).filter(function(r) { return !r.reviewReply; });
  Logger.log('未返信: ' + unreplied.length + '件');
  if (unreplied.length === 0) return;
  unreplied.forEach(function(review) {
    var reviewer = review.reviewer.displayName || 'Anonymous';
    var rating = review.starRating || 'FIVE';
    var comment = review.comment || '(評価のみ)';
    var reviewName = review.name;
    Logger.log('処理中: ' + reviewer + ' ★' + rating);
    var prompt = 'Review to reply to:\nReviewer: ' + reviewer + '\nRating: ' + rating + '\nComment: ' + comment + '\n\nGenerate 3 reply options.';
    try {
      var raw = callClaude_(REVIEW_REPLY_SYSTEM, prompt);
      var parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      var subject = '【GBPレビュー返信】' + reviewer + ' ★' + rating;
      var body = 'レビュー内容:\n' + comment + '\n\n━━━━━━━━━━━━━━━━━━━━\n\n';
      parsed.replies.forEach(function(rep) { body += '【パターン ' + rep.label + '】\n' + rep.en + '\n\n' + rep.ja + '\n\n---\n\n'; });
      body += '━━━━━━━━━━━━━━━━━━━━\n\n返信はこちらから:\nhttps://business.google.com/reviews\n\nReview ID: ' + reviewName;
      GmailApp.createDraft(CONFIG.NOTIFICATION_EMAIL, subject, body);
      Logger.log('✅ 下書き作成: ' + reviewer);
    } catch (e) { Logger.log('❌ エラー (' + reviewer + '): ' + e.message); }
  });
  Logger.log('=== レビューチェック完了 ===');
}

// ============================================================
// 3. GBP投稿
// ============================================================
var POST_SYSTEM = [
  'You create Google Business Profile posts for a hair salon in Koenji, Tokyo.',
  'Brand: kommons (currently HAIR IS YOUR SIGNATURE).',
  'Stylist: Hikaru, 15+ years experience, English-speaking, specializes in Western/European hair.',
  '',
  'VOICE & TONE:',
  '- Write as Hikaru, first person.',
  '- Polite and warm, but never salesy, corporate, or preachy.',
  '- Talk about specific techniques, styles, or hair types.',
  '- Every post must mention a concrete style name, technique, or hair situation.',
  '- Describe what YOU did and why it works — NOT what the reader should do.',
  '- EN: Professional but approachable. Like talking to a client in the chair.',
  '- JP: です/ます base. Natural, not stiff.',
  '',
  'NEVER DO:',
  '- Never lecture the reader (no "The way you blow-dry can make or break your style")',
  '- Never use "you should" or "you need to" or "if you understand the technique"',
  '- Never use abstract statements like "technical skill meets genuine connection"',
  '- Never use "What makes a good haircut great?" style openings',
  '- Never include bullet points, checkmarks, or "Why choose us" sections',
  '- Never say「是非お任せください」「ぜひ一度ご相談ください」「正しい技術を知ると」',
  '- Never write about "the philosophy of hair" without a specific technique',
  '',
  'INSTEAD DO:',
  '- Talk about a specific style you recently did: "This reverse balayage was for a client who..."',
  '- Explain your thinking: "I kept the layers longer around the face because..."',
  '- Share an observation: "A lot of clients coming in lately are asking for..."',
  '',
  'STRUCTURE:',
  '- EN: 3-5 sentences. Start with a specific style/technique, not a question about life.',
  '- Blank line.',
  '- JP: 3-5 sentences. NOT a translation. です/ます polite form.',
  '- No hashtags, no emojis, no salon name.',
  '',
  'WHAT TO WRITE ABOUT:',
  '- If a file name is given (e.g. "pixie-mullet", "reverse-balayage"), write about THAT style.',
  '- If the file name is unclear, write about a recent technique or trend.',
  '',
  'SEO (1-2 keywords, EN only, natural):',
  '- "English-speaking hairdresser in Koenji" or "English-speaking hair salon in Koenji"',
  '- The specific style/service mentioned',
  '',
  'GOOD EXAMPLE:',
  'Reverse balayage is one of the most practical color techniques I do at this English-speaking hair salon in Koenji. Instead of going lighter from the roots, we bring depth back in — so the grow-out looks natural and the time between appointments stretches out. If you want color that works with your schedule, not against it, this is worth considering.',
  '',
  'リバースバレイヤージュは、根元に深みを戻すカラー技法です。明るくするのではなく、伸びてきたときの境目が自然になるようにデザインします。「カラーはしたいけど、頻繁には通えない」という方にとても相性がいい技術です。',
  '',
  'Return ONLY valid JSON:',
  '{"summary_en":"...","summary_ja":"...","combined":"EN text here\\n\\nJP text here"}'
].join('\n');

var THEMES = ['technical', 'personality', 'qa'];

function createAutoPost() {
  Logger.log('=== 自動投稿開始 ===');
  var props = PropertiesService.getScriptProperties();
  var themeIndex = parseInt(props.getProperty('themeIndex') || '0');
  var currentTheme = THEMES[themeIndex % THEMES.length];
  props.setProperty('themeIndex', String(themeIndex + 1));
  var recentKeywords = '';
  try {
    var reviews = gbpFetch_('get', '/reviews?pageSize=5&orderBy=updateTime desc', null);
    if (reviews.code === 200 && reviews.body.reviews) {
      recentKeywords = reviews.body.reviews.map(function(r) { return r.comment || ''; }).join(' ').substring(0, 200);
    }
  } catch (e) { Logger.log('レビューキーワード取得スキップ'); }
  var mediaUrl = '';
  var mediaFormat = '';
  var selectedFileName = '';
  try {
    var files = getDriveFiles_();
    var posted = JSON.parse(props.getProperty('postedFiles') || '[]');
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var name = f.name;
      var isImage = /\.(jpg|jpeg|png|webp)$/i.test(name);
      var isVideo = /\.(mp4|mov)$/i.test(name);
      if (!isImage && !isVideo) continue;
      if (posted.indexOf(name) !== -1) continue;
      makeDriveFilePublic_(f.id);
      mediaUrl = 'https://drive.google.com/uc?export=download&id=' + f.id;
      mediaFormat = isVideo ? 'VIDEO' : 'PHOTO';
      selectedFileName = name;
      posted.push(name);
      props.setProperty('postedFiles', JSON.stringify(posted));
      Logger.log('メディア選択: ' + name + ' (' + mediaFormat + ')');
      break;
    }
  } catch (e) { Logger.log('メディア選択スキップ: ' + e.message); }
  var prompt = 'Theme: ' + currentTheme + '\n';
  if (selectedFileName) prompt += 'Media file name (write about this style): ' + selectedFileName + '\n';
  if (recentKeywords) prompt += 'Recent review keywords: ' + recentKeywords + '\n';
  prompt += 'Generate a GBP post.';
  try {
    var raw = callClaude_(POST_SYSTEM, prompt);
    var parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    var postPayload = {
      languageCode: 'en',
      summary: parsed.combined || (parsed.summary_en + '\n\n' + parsed.summary_ja),
      topicType: 'STANDARD',
      callToAction: { actionType: 'BOOK', url: 'https://hairisyoursignature.jp' }
    };
    if (mediaUrl) {
      postPayload.media = [{ mediaFormat: mediaFormat, sourceUrl: mediaUrl }];
    }
    var result = gbpFetch_('post', '/localPosts', postPayload);
    if (result.code === 200 || result.code === 201) {
      Logger.log('✅ 投稿成功! テーマ: ' + currentTheme + ' メディア: ' + selectedFileName);
      GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, '【GBP自動投稿完了】' + currentTheme,
        '投稿が自動で公開されました。\n\nテーマ: ' + currentTheme + '\nメディア: ' + (selectedFileName || 'なし')
        + '\n\n内容:\n' + (parsed.combined || parsed.summary_en) + '\n\n確認: https://business.google.com/posts');
      return true;
    } else {
      Logger.log('❌ 投稿失敗: ' + result.code);
      Logger.log(JSON.stringify(result.body));
      GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, '【GBP自動投稿エラー】',
        '投稿に失敗しました。\nエラー: ' + result.code + '\nメディア: ' + (selectedFileName || 'なし') + '\n\n' + JSON.stringify(result.body, null, 2));
      return false;
    }
  } catch (e) {
    Logger.log('❌ 投稿生成エラー: ' + e.message);
    return false;
  }
}

// ============================================================
// 4. トリガー設定
// ============================================================
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkAndDraftReviewReplies').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('autoPostIfDue').timeBased().everyDays(1).atHour(10).create();
  Logger.log('✅ トリガー設定完了');
}

function autoPostIfDue() {
  Session.getEffectiveUser().getEmail();
  var props = PropertiesService.getScriptProperties();
  var lastPost = props.getProperty('lastPostDate') || '';
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  if (lastPost) {
    var diffDays = Math.floor((new Date() - new Date(lastPost)) / (1000 * 60 * 60 * 24));
    if (diffDays < 3) { Logger.log('前回から' + diffDays + '日 — スキップ'); return; }
  }
  var success = createAutoPost();
  if (success) {
    props.setProperty('lastPostDate', today);
    Logger.log('lastPostDate を更新: ' + today);
  } else {
    Logger.log('投稿失敗のため lastPostDate は更新しない');
  }
}

// ============================================================
// 5. ユーティリティ
// ============================================================
function resetPostedFiles() {
  PropertiesService.getScriptProperties().deleteProperty('postedFiles');
  Logger.log('投稿済みリストをリセット');
}

function resetThemeIndex() {
  PropertiesService.getScriptProperties().deleteProperty('themeIndex');
  Logger.log('テーマインデックスをリセット');
}

function postReviewReply(reviewName, replyText) {
  var result = UrlFetchApp.fetch(CONFIG.GBP_BASE + '/' + reviewName + '/reply', {
    method: 'put',
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Type': 'application/json' },
    payload: JSON.stringify({ comment: replyText }),
    muteHttpExceptions: true
  });
  Logger.log('返信投稿: ' + result.getResponseCode());
}

function forceReauth() {
  ScriptApp.invalidateAuth();
  Logger.log('承認リセット済み。次の実行で再承認を求められます。');
}

function checkProps() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var masked = {};
  Object.keys(props).forEach(function(k) {
    masked[k] = k.indexOf('KEY') !== -1 ? '***masked***' : props[k];
  });
  console.log(JSON.stringify(masked, null, 2));
}

function resetLastPostDate() {
  PropertiesService.getScriptProperties().setProperty('lastPostDate', '2026-04-20');
  console.log('リセット完了: lastPostDate = 2026-04-20');
}

function rebuildPostedFilesFromGBP() {
  var posts = gbpFetch_('get', '/localPosts?pageSize=100', null);
  if (posts.code !== 200) { Logger.log('取得失敗'); return; }
  var driveFiles = getDriveFiles_();
  var used = [];
  (posts.body.localPosts || []).forEach(function(p) {
    if (p.media && p.media.length) {
      p.media.forEach(function(m) {
        var url = m.sourceUrl || m.googleUrl || '';
        driveFiles.forEach(function(f) {
          if (url.indexOf(f.id) !== -1 && used.indexOf(f.name) === -1) {
            used.push(f.name);
          }
        });
      });
    }
  });
  PropertiesService.getScriptProperties().setProperty('postedFiles', JSON.stringify(used));
  Logger.log('復元完了: ' + used.length + '件');
  Logger.log(JSON.stringify(used, null, 2));
}
