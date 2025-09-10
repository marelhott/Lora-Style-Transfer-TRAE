/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  devIndicators: false,
  allowedDevOrigins: [
    "*.macaly.dev",
    "*.macaly.app",
    "*.macaly-app.com",
    "*.macaly-user-data.dev",
    "*.fly.dev",
  ],
  // https://github.com/vercel/next.js/issues/79588#issuecomment-2972850452
  experimental: {
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Skip macaly-tagger in production/RunPod environment
    if (dev && process.env.NODE_ENV !== 'production') {
      try {
        config.module.rules.unshift({
          test: /\.(jsx|tsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "macaly-tagger",
            },
          ],
          enforce: "pre", // Run before other loaders
        });
      } catch (e) {
        console.log('macaly-tagger not available, skipping...');
      }
    }

    return config;
  },
};

module.exports = nextConfig;
