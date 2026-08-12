import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const img = (
    <Image
      src="/shb-logo.svg"
      alt="SHB"
      width={1350}
      height={540}
      priority={false}
      className={cn('w-auto', className)}
    />
  );

  if (onDark) {
    return (
      <span className="inline-flex items-center rounded-md bg-white px-1.5 py-1">
        {img}
      </span>
    );
  }

  return img;
}
