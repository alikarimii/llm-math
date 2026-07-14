import { fileURLToPath } from 'node:url'
import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
}

const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-math'],
    rehypePlugins: [['rehype-katex', { strict: true, throwOnError: true }]],
  },
})

export default withMDX(nextConfig)
