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
  // GTM スニペット（インライン）＋ GTM本体・LINE LIFF SDK
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.line-scdn.net https://*.line.me",
  "script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.line-scdn.net https://*.line.me",
  // 予約API（GAS）・GA4ビーコン・GTM通信・LINE LIFF認証
  "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://www.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.line.me",
  // OG画像・favicon・GA4ピクセル・LINEプロフィール画像（liff.getProfile）
  "img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com https://*.line-scdn.net",
  // インラインstyle（index.html内の<style>大量）
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // GTM noscript用iframe・LINE LIFF認証画面
  "frame-src https://www.googletagmanager.com https://*.line.me",
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
