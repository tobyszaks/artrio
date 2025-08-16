import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera, Image, Video, X, Upload } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface MediaUploadProps {
  onMediaUploaded: (mediaUrl: string, mediaType: 'image' | 'video') => void;
  className?: string;
}

export default function MediaUpload({ onMediaUploaded, className = '' }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select a file smaller than 50MB"
      });
      return;
    }

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image or video file"
      });
      return;
    }

    const type = isImage ? 'image' : 'video';
    setMediaType(type);

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    await uploadFile(file, type);
  };

  const handleCameraCapture = async () => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        setPreview(image.dataUrl);
        setMediaType('image');
        
        // Convert dataUrl to blob
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        await uploadFile(file, 'image');
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        variant: "destructive",
        title: "Camera error",
        description: "Failed to access camera"
      });
    }
  };

  const handleGallerySelect = async () => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      if (image.dataUrl) {
        setPreview(image.dataUrl);
        setMediaType('image');
        
        // Convert dataUrl to blob
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `gallery-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        await uploadFile(file, 'image');
      }
    } catch (error) {
      console.error('Gallery error:', error);
      toast({
        variant: "destructive",
        title: "Gallery error", 
        description: "Failed to access photo gallery"
      });
    }
  };

  const uploadFile = async (file: File, type: 'image' | 'video') => {
    setUploading(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.data.user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('post-media')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('post-media')
        .getPublicUrl(data.path);

      onMediaUploaded(publicUrl, type);
      
      toast({
        title: "Success",
        description: `${type === 'image' ? 'Image' : 'Video'} uploaded successfully`
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload media"
      });
      clearPreview();
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setMediaType(null);
  };

  if (preview && mediaType) {
    return (
      <Card className={`w-full ${className}`}>
        <CardContent className="p-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearPreview}
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {mediaType === 'image' ? (
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-64 object-cover rounded-lg"
              />
            ) : (
              <video
                src={preview}
                controls
                className="w-full max-h-64 rounded-lg"
                preload="metadata"
              />
            )}
            
            {uploading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
                <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-lg">
                  <Upload className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCameraCapture}
        disabled={uploading}
        className="flex flex-col items-center gap-1 h-16"
      >
        <Camera className="h-5 w-5" />
        <span className="text-xs">Camera</span>
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleGallerySelect}
        disabled={uploading}
        className="flex flex-col items-center gap-1 h-16"
      >
        <Image className="h-5 w-5" />
        <span className="text-xs">Gallery</span>
      </Button>
      
      <label className="contents">
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          className="flex flex-col items-center gap-1 h-16"
          asChild
        >
          <span>
            <Video className="h-5 w-5" />
            <span className="text-xs">Video</span>
          </span>
        </Button>
      </label>
    </div>
  );
}