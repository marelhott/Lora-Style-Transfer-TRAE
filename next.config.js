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
    // Remove conflicting CSS rules that interfere with Next.js built-in CSS handling
    // Next.js already handles CSS/PostCSS/Tailwind processing correctly
    
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
