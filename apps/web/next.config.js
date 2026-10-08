/** Next App Router retained from the OpenReview frontend; ProView configuration. */
const apiOrigin = process.env.PROVIEW_API_INTERNAL_URL || 'http://127.0.0.1:3001';

module.exports = {
  poweredByHeader: false,
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: require('node:path').join(__dirname, '../..'),
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};
