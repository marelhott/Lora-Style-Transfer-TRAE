/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  devIndicators: {
    buildActivity: false,
  },
  experimental: {
    allowedOrigins: ['localhost:3000', 'localhost:8000'],
    serverComponentsExternalPackages: ['sharp'],
  },
  webpack: (config, { dev, isServer }) => {
    // Fix Tailwind CSS processing
    config.module.rules.push({
      test: /\.css$/,
      use: [
        'style-loader',
        'css-loader',
        'postcss-loader'
      ],
    });

    // Macaly-tagger loader configuration with error handling for production/RunPod
    if (dev && process.env.NODE_ENV !== 'production') {
      try {
        config.module.rules.push({
          test: /\.(js|jsx|ts|tsx)$/,
          use: {
            loader: 'macaly-tagger',
            options: {
              // Macaly-tagger options
            },
          },
        });
      } catch (error) {
        console.warn('Macaly-tagger loader not available:', error.message);
      }
    }

    return config;
  },
};

module.exports = nextConfig;
