import Image from "next/image";

import type { Media } from "@/lib/api/client";

/**
 * Images uploaded from the dashboard, as they appear on the public site.
 *
 * Width and height come from the upload itself, so the page reserves the right
 * box before an image arrives and nothing below it jumps. An image stored
 * without dimensions still renders, in a fixed-ratio frame, rather than
 * breaking next/image by claiming to be zero pixels wide.
 */

type Props = {
  media: Media;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export function ProjectImage({ media, alt, sizes, className, priority }: Props) {
  const label = media.alt || alt;

  if (media.width && media.height) {
    return (
      <Image
        src={media.url}
        alt={label}
        width={media.width}
        height={media.height}
        sizes={sizes}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <span className="relative block aspect-[16/10]">
      <Image
        src={media.url}
        alt={label}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${className ?? ""}`}
      />
    </span>
  );
}
