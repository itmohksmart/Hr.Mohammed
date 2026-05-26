import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 6000000, // 6MB
          runtimeCaching: [
            {
              // Handle GET requests (cache with NetworkFirst)
              urlPattern: /^https:\/\/.*\.supabase\.(co|in)\/rest\/v1\/.*/i,
              method: 'GET',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-get-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Handle Data Mutations for offline mode
              urlPattern: /^https:\/\/.*\.supabase\.(co|in)\/rest\/v1\/.*/i,
              method: 'POST',
              handler: 'NetworkOnly',
              options: {
                backgroundSync: {
                  name: 'supabase-post-queue',
                  options: {
                    maxRetentionTime: 24 * 60 // Retry for max of 24 Hours
                  }
                }
              }
            },
            {
              // Handle Data Mutations for offline mode
              urlPattern: /^https:\/\/.*\.supabase\.(co|in)\/rest\/v1\/.*/i,
              method: 'PATCH',
              handler: 'NetworkOnly',
              options: {
                backgroundSync: {
                  name: 'supabase-patch-queue',
                  options: {
                    maxRetentionTime: 24 * 60 // Retry for max of 24 Hours
                  }
                }
              }
            },
            {
              // Handle Data Mutations for offline mode
              urlPattern: /^https:\/\/.*\.supabase\.(co|in)\/rest\/v1\/.*/i,
              method: 'DELETE',
              handler: 'NetworkOnly',
              options: {
                backgroundSync: {
                  name: 'supabase-delete-queue',
                  options: {
                    maxRetentionTime: 24 * 60 // Retry for max of 24 Hours
                  }
                }
              }
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'unsplash-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                }
              }
            }
          ]
        },
        manifest: {
          name: 'نظام الموارد البشرية',
          short_name: 'HR System',
          description: 'نظام إدارة الموارد البشرية والرواتب',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
      extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
