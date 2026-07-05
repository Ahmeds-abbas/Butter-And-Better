import fallbackProductImageUrl from "../assets/hero.png";

export function getProductImageUrl(imageKey: string | null | undefined) {
  const trimmedImageKey = imageKey?.trim();

  return trimmedImageKey && trimmedImageKey.length > 0
    ? trimmedImageKey
    : fallbackProductImageUrl;
}
