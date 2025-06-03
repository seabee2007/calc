import imageCompression from 'browser-image-compression';

export interface ImageOptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  fileType?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
  initialQuality?: number;
}

export interface ImageOptimizationResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dataUrl: string;
}

/**
 * Optimize an image file for web use with compression and resizing
 * @param file - The original image file
 * @param options - Optimization options
 * @returns Promise resolving to optimization result
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<ImageOptimizationResult> {
  const {
    maxSizeMB = 0.5,
    maxWidthOrHeight = 800,
    fileType = 'image/jpeg',
    quality = 0.8,
    initialQuality = 0.8
  } = options;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  // Validate file size (10MB limit before compression)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size must be less than 10MB');
  }

  const compressionOptions = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType,
    quality,
    initialQuality
  };

  try {
    const compressedFile = await imageCompression(file, compressionOptions);
    
    // Calculate compression ratio
    const compressionRatio = ((file.size - compressedFile.size) / file.size * 100);
    
    // Convert to data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });

    return {
      compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      compressionRatio,
      dataUrl
    };
  } catch (error) {
    throw new Error(`Failed to optimize image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Optimize image specifically for logo use
 * Targets smaller file size and square aspect ratio suitable for logos
 */
export async function optimizeLogo(file: File): Promise<ImageOptimizationResult> {
  return optimizeImage(file, {
    maxSizeMB: 0.3, // Smaller target for logos
    maxWidthOrHeight: 400, // Smaller dimensions for logos
    fileType: 'image/png', // PNG better for logos with transparency
    quality: 0.9, // Higher quality for logos
    initialQuality: 0.9
  });
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate image file before optimization
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Please select a valid image file (PNG, JPG, JPEG, GIF, WebP)' };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  return { valid: true };
} 