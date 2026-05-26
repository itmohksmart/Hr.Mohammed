import { Human, Config } from '@vladmandic/human';

// Intercept fetch requests to cache Human models in Browser Cache Storage (Model Caching)
if (typeof window !== 'undefined' && 'caches' in window) {
  const originalFetch = window.fetch;
  if (!(originalFetch as any).__isPatchedForHumanModels) {
    const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' 
        ? input 
        : input instanceof URL 
          ? input.toString() 
          : input.url;

      // Intercept calls to human-models base path
      if (url.includes('vladmandic.github.io/human-models') || url.includes('/models/')) {
        try {
          const cache = await caches.open('vladmandic-human-models-cache');
          const cachedResponse = await cache.match(url);
          if (cachedResponse) {
            return cachedResponse;
          }
          const response = await originalFetch(input, init);
          if (response.ok) {
            await cache.put(url, response.clone());
          }
          return response;
        } catch (error) {
          console.warn('Failed to load human model from Cache Storage:', error);
          return originalFetch(input, init);
        }
      }
      return originalFetch(input, init);
    };
    (patchedFetch as any).__isPatchedForHumanModels = true;
    window.fetch = patchedFetch;
  }
}

const config: Partial<Config> = {
  backend: 'webgl',
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  cacheModels: true,
  face: {
    enabled: true,
    detector: { 
      rotation: true,
      maxDetected: 1,
      minConfidence: 0.1,
    },
    mesh: { enabled: true },
    iris: { enabled: true },
    description: { enabled: true },
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
};

let human: Human | null = null;

export const initFaceSystem = async () => {
  if (!human) {
    human = new Human(config);
    // Use high performance backend and warm up with a dummy image for faster first run
    await human.load();
    // Pre-warm the models
    await human.warmup();
  }
  return human;
};

export const getFaceSystem = () => {
  if (!human) throw new Error('Face system not initialized');
  return human;
};

export const calculateSimilarity = (embedding1: number[], embedding2: number[]) => {
  // Cosine similarity for ArcFace
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    normA += embedding1[i] * embedding1[i];
    normB += embedding2[i] * embedding2[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const ALIGNMENT_THRESHOLD = 0.75; // Professional standard for ArcFace
