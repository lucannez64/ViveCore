import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  server: {
    proxy: {
      '/supervive': {
        target: 'https://op.gg',
        changeOrigin: true,
        secure: true,
      },
      // Proxy OAuth calls to Theorycraft Accounts service
      '/iam': {
        target: 'https://accounts.projectloki.theorycraftgames.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy MMR calls to Theorycraft MMR service
      '/mmr': {
        target: 'https://mmr-jx-prod.prodcluster.awsinfra.theorycraftgames.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths()
  ],
})
