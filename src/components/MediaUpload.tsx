import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera, Image, Video, X, Upload } from 'lucide-react';

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
    <div className={`flex gap-2 ${className}`}>
      <label className="flex-1">
        <input
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full flex items-center gap-2"
          disabled={uploading}
          asChild
        >
          <span>
            <Image className="h-4 w-4" />
            Photo
          </span>
        </Button>
      </label>
      
      <label className="flex-1">
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
          className="w-full flex items-center gap-2"
          disabled={uploading}
          asChild
        >
          <span>
            <Video className="h-4 w-4" />
            Video
          </span>
        </Button>
      </label>
    </div>
  );
}