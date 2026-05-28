// kommons-booking — Cloudflare Workers entry
//
// 役割：env.ASSETS から静的ファイルを取得し、HTTPセキュリティヘッダー（CSP等）を
// 焼き込んでレスポンス。CSP enforce 化により「外部の知らないドメインからのスクリプト
// 実行・通信・画像読み込み」を未然にブロックする。
//
// CSPのスコープ：index.html が実際に使う6ドメインのみ許可（GTM・GA4・GAS予約API・LINE
// LIFF SDK・LINEプロフィール画像・GTM noscript用iframe）。それ以外は default-src 'self' で
// 同一オリジン限定。

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // GTMスニペット（インライン）＋ GTM本体・Google Ads（コンバージョン/リマケ）・LINE LIFF SDK
  "script-src 'self' 'unsafe-inline' https://*.googletagmanager.com https://*.googleadservices.com https://googleads.g.doubleclick.net https://static.line-scdn.net https://*.line.me",
  "script-src-elem 'self' 'unsafe-inline' https://*.googletagmanager.com https://*.googleadservices.com https://googleads.g.doubleclick.net https://static.line-scdn.net https://*.line.me",
  // 予約API（GAS）・GA4ビーコン・GTM/Google Ads通信（ccm/collect・rmkt/collect 等）・LINE LIFF認証
  // 日本IPからの Google広告は google.co.jp 側を叩くため両方許可
  "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.google.com https://*.google.co.jp https://*.g.doubleclick.net https://*.line.me",
  // OG画像・favicon・GA4ピクセル・Google Ads ピクセル（1p-user-list等 google.co.jp 配信）・LINEプロフィール画像
  "img-src 'self' data: https://*.googletagmanager.com https://*.google-analytics.com https://*.g.doubleclick.net https://*.google.com https://*.google.co.jp https://*.line-scdn.net",
  // インラインstyle（index.html内の<style>大量）
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // GTM noscript用iframe・Google Ads iframe・LINE LIFF認証画面
  "frame-src https://*.googletagmanager.com https://*.doubleclick.net https://*.line.me",
  "object-src 'none'",
  "base-uri 'self'",
  // フォームsubmitは同一オリジン（実体はfetchで送るのでform actionは未使用）＋念のためGAS
  "form-action 'self' https://script.google.com",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests"
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_DIRECTIVES,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-Frame-Options': 'SAMEORIGIN',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

export default {
  async fetch(request, env, ctx) {
    // 1. 静的アセットを ASSETS バインディングから取得
    const assetResponse = await env.ASSETS.fetch(request);

    // 2. レスポンスを再構築してセキュリティヘッダーを焼き込む
    const headers = new Headers(assetResponse.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(key, value);
    }

    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers
    });
  }
};
