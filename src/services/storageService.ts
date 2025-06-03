import { supabase } from '../lib/supabase';
import { optimizeLogo, validateImageFile, ImageOptimizationResult } from '../utils/imageOptimization';

export interface UploadResult {
  publicUrl: string;
  path: string;
  optimization: ImageOptimizationResult;
}

/**
 * Upload an optimized logo to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The user ID for folder organization
 * @returns Upload result with public URL and optimization stats
 */
export async function uploadLogo(file: File, userId: string): Promise<UploadResult> {
  // Validate the file first
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error!);
  }

  // Optimize the image
  const optimization = await optimizeLogo(file);
  
  // Generate a unique filename
  const timestamp = Date.now();
  const fileExt = 'png'; // Always use PNG for logos (from optimization)
  const fileName = `logo-${timestamp}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('logos')
    .upload(filePath, optimization.compressedFile, {
      cacheControl: '3600', // Cache for 1 hour
      upsert: false // Don't overwrite, create new file
    });

  if (error) {
    throw new Error(`Failed to upload logo: ${error.message}`);
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from('logos')
    .getPublicUrl(filePath);

  return {
    publicUrl,
    path: filePath,
    optimization
  };
}

/**
 * Delete a logo from Supabase Storage
 * @param path - The storage path of the logo to delete
 */
export async function deleteLogo(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('logos')
    .remove([path]);

  if (error) {
    console.warn(`Failed to delete logo at ${path}:`, error.message);
    // Don't throw error for deletion failures as it's not critical
  }
}

/**
 * Replace an existing logo with a new one
 * @param file - The new image file
 * @param userId - The user ID
 * @param oldPath - The path of the old logo to delete (optional)
 * @returns Upload result with public URL and optimization stats
 */
export async function replaceLogo(
  file: File, 
  userId: string, 
  oldPath?: string
): Promise<UploadResult> {
  // Upload the new logo first
  const result = await uploadLogo(file, userId);

  // Delete the old logo if it exists
  if (oldPath) {
    await deleteLogo(oldPath);
  }

  return result;
}

/**
 * Get the public URL for a logo path
 * @param path - The storage path of the logo
 * @returns The public URL
 */
export function getLogoPublicUrl(path: string): string {
  const { data: { publicUrl } } = supabase.storage
    .from('logos')
    .getPublicUrl(path);
  
  return publicUrl;
} 