/**
 * Image Service - Search & Generation for ConvoLab
 * 
 * Provides image search and generation to add visual context,
 * helping users better understand and communicate.
 */

import { apiClient } from '@/lib/utils/api-client';

/**
 * Image result from search or generation
 */
export interface ImageResult {
  url: string;
  title: string;
  thumbnail: string;
  source: 'search' | 'generated';
  provider: string;
  style?: string;
  prompt?: string;
}

/**
 * Visual context response
 */
export interface VisualContext {
  text: string;
  images: ImageResult[];
  count: number;
  search_available: boolean;
  generation_available: boolean;
}

/**
 * Search for images to provide visual context
 * 
 * @param query - What to search for
 * @param numResults - How many images (1-10)
 * @returns Array of image results
 */
export async function searchImages(
  query: string,
  numResults: number = 5
): Promise<ImageResult[]> {
  if (!query || query.trim().length === 0) {
    console.warn('Empty image search query');
    return [];
  }

  try {
    const response = await apiClient.get<{ images: ImageResult[] }>(
      `/api/multimodal/image/search?query=${encodeURIComponent(query)}&num_results=${numResults}`
    );

    return response.images || [];
  } catch (error) {
    console.error('Image search failed:', error);
    return [];
  }
}

/**
 * Generate custom ConvoLab symbol/image
 * 
 * @param prompt - Description of what to generate
 * @param style - Visual style for the image
 * @returns Generated image or null
 */
export async function generateImage(
  prompt: string,
  style: 'simple_icon' | 'cartoon' | 'realistic' | 'symbol' = 'simple_icon'
): Promise<ImageResult | null> {
  try {
    const response = await apiClient.post<ImageResult>(
      '/api/multimodal/image/generate',
      { prompt, style }
    );
    return response;
  } catch (error) {
    console.error('Image generation failed:', error);
    return null;
  }
}

/**
 * Smart image retrieval (search or generate)
 * 
 * @param query - What image to get
 * @param preferGenerated - Generate custom instead of search
 * @param style - Style for generated images
 * @returns Single best image result or null
 */
export async function getImage(
  query: string,
  preferGenerated: boolean = false,
  style?: string
): Promise<ImageResult | null> {
  try {
    const params = new URLSearchParams({
      query,
      prefer_generated: String(preferGenerated)
    });
    if (style) params.append('style', style);

    const response = await apiClient.get<ImageResult>(
      `/api/multimodal/image/get?${params}`
    );
    return response;
  } catch (error) {
    console.error('Get image failed:', error);
    return null;
  }
}

/**
 * Get visual context (mix of search + optional generation)
 * 
 * @param text - Text to get visual context for
 * @param numImages - Number of context images
 * @param includeGenerated - Include one generated image
 * @returns Visual context with images
 */
export async function getVisualContext(
  text: string,
  numImages: number = 3,
  includeGenerated: boolean = false
): Promise<VisualContext> {
  try {
    const params = new URLSearchParams({
      text,
      num_images: String(numImages),
      include_generated: String(includeGenerated)
    });

    const response = await apiClient.get<VisualContext>(
      `/api/multimodal/image/context?${params}`
    );
    return response;
  } catch (error) {
    console.error('Visual context failed:', error);
    return {
      text,
      images: [],
      count: 0,
      search_available: false,
      generation_available: false
    };
  }
}
