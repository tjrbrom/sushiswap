import defaultNextConfig from '@sushiswap/nextjs-config'
import { withAxiom } from 'next-axiom'

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...defaultNextConfig,
  images: {
    loader: 'cloudinary',
    path: 'https://cdn.sushi.com/image/upload/',
  },
  basePath: '/swap',
  // By default, Next.js only runs ESLint on the 'pages' and 'utils' directories
  // so we have to add additional directories to the dirs.
  eslint: {
    dirs: ['pages', 'components', 'lib', 'app', 'ui'],
  },
  transpilePackages: ['@sushiswap/ui', '@sushiswap/wagmi'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/swap',
        permanent: true,
        basePath: false,
      },
      // {
      //   source: '/swap',
      //   // Change to /1/1/ETH/SUSHI before launch
      //   destination: '/swap/137:MATIC/137:SUSHI',
      //   permanent: true,
      //   basePath: false,
      // },
    ]
  },
}

export default withAxiom(nextConfig)
