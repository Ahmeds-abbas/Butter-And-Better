import { remove, uploadData } from "aws-amplify/storage";

export type ProductMediaKind = "gallery" | "main" | "video";

type UploadProgress = {
  totalBytes?: number;
  transferredBytes: number;
};

type UploadProductMediaFileOptions = {
  file: File;
  kind: ProductMediaKind;
  productId: string;
  onProgress?: (progress: number) => void;
};

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const imageMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const videoExtensions = new Set(["mp4", "webm", "mov"]);
const videoMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-quicktime",
]);
const imageMaxBytes = 5 * 1024 * 1024;
const videoMaxBytes = 50 * 1024 * 1024;

function getFileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function validateProductMediaFile(file: File, kind: ProductMediaKind) {
  const extension = getFileExtension(file);
  const isVideo = kind === "video";
  const allowedExtensions = isVideo ? videoExtensions : imageExtensions;
  const allowedMimeTypes = isVideo ? videoMimeTypes : imageMimeTypes;
  const maxBytes = isVideo ? videoMaxBytes : imageMaxBytes;
  const maxMegabytes = isVideo ? 50 : 5;

  if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.type)) {
    throw new Error(
      isVideo
        ? "Use an MP4, WebM or MOV video."
        : "Use a JPG, JPEG, PNG or WebP image.",
    );
  }

  if (file.size > maxBytes) {
    throw new Error(`File is too large. Max size is ${maxMegabytes}MB.`);
  }

  return extension === "jpeg" ? "jpg" : extension;
}

function createUploadPath(
  productId: string,
  kind: ProductMediaKind,
  extension: string,
) {
  const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (kind === "video") {
    return `product-videos/${productId}/video-${timestamp}.${extension}`;
  }

  const prefix = kind === "main" ? "main" : "gallery";

  return `product-images/${productId}/${prefix}-${timestamp}.${extension}`;
}

export function isStoredProductMediaPath(path: string) {
  return (
    path.startsWith("product-images/") || path.startsWith("product-videos/")
  );
}

export function parseStoredMediaPaths(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((path) => path.trim())
    .filter(Boolean);
}

export async function removeProductMediaFile(path: string) {
  const trimmedPath = path.trim();

  if (!isStoredProductMediaPath(trimmedPath)) {
    return;
  }

  await remove({ path: trimmedPath });
}

export async function uploadProductMediaFile({
  file,
  kind,
  productId,
  onProgress,
}: UploadProductMediaFileOptions) {
  const extension = validateProductMediaFile(file, kind);
  const uploadPath = createUploadPath(productId, kind, extension);

  await uploadData({
    path: uploadPath,
    data: file,
    options: {
      contentType: file.type,
      onProgress: (progress: UploadProgress) => {
        if (!progress.totalBytes) {
          return;
        }

        onProgress?.(
          Math.round((progress.transferredBytes / progress.totalBytes) * 100),
        );
      },
    },
  }).result;

  return uploadPath;
}
