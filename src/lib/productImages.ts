const fallbackProductImageUrl = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="Butter and Better product photo coming soon">
  <rect width="1200" height="900" fill="#F2F0EC"/>
  <circle cx="260" cy="210" r="180" fill="#738561" opacity="0.22"/>
  <circle cx="920" cy="680" r="250" fill="#573615" opacity="0.12"/>
  <rect x="185" y="170" width="830" height="560" rx="52" fill="#fffaf2" stroke="#738561" stroke-width="10"/>
  <text x="600" y="405" fill="#573615" font-family="Georgia, serif" font-size="86" font-weight="700" text-anchor="middle">Butter &amp; Better</text>
  <text x="600" y="485" fill="#738561" font-family="Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="8" text-anchor="middle">PRODUCT PHOTO</text>
  <text x="600" y="540" fill="#573615" font-family="Arial, sans-serif" font-size="30" font-weight="700" text-anchor="middle">coming soon</text>
</svg>
`)}`;

export function getProductImageUrl(imageKey: string | null | undefined) {
  const trimmedImageKey = imageKey?.trim();

  return trimmedImageKey && trimmedImageKey.length > 0
    ? trimmedImageKey
    : fallbackProductImageUrl;
}

export function getProductImageAltText(
  imageAltText: string | null | undefined,
  productName: string,
) {
  const trimmedAltText = imageAltText?.trim();

  return trimmedAltText && trimmedAltText.length > 0
    ? trimmedAltText
    : `${productName} from Butter & Better`;
}

export function parseProductGalleryImages(
  galleryImageUrls: string | null | undefined,
) {
  return (
    galleryImageUrls
      ?.split(/\r?\n|,/)
      .map((url) => url.trim())
      .filter(Boolean) ?? []
  );
}
