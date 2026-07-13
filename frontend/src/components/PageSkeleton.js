import { SkeletonCard } from "./SkeletonFactory";
import BrandMark from "./BrandMark";

export default function PageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <BrandMark sizeClass="h-10 w-10 mb-6" />
      <div className="w-full max-w-md space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
