import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ProfileSkeleton = () => {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar and Basic Info */}
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-32 mx-auto" />
            <Skeleton className="h-4 w-20 mx-auto" />
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-16" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>

        {/* Account Info */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Actions */}
        <div className="pt-4">
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSkeleton;