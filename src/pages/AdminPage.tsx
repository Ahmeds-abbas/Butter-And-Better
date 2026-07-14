import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminOrdersPanel from "../components/admin/AdminOrdersPanel";
import AdminSectionTabs from "../components/admin/AdminSectionTabs";
import { dataClient } from "../lib/amplifyClient";
import { resolveProductMediaUrl } from "../lib/productImages";
import {
  parseStoredMediaPaths,
  removeProductMediaFile,
  uploadProductMediaFile,
  type ProductMediaKind,
} from "../lib/productMediaUpload";
import type { AdminSection } from "../types/admin";

type AdminVariant = {
  id: string;
  productId: string;
  name: string;
  priceInPence: number;
  isActive: boolean;
  stockQuantity: number | null;
  sortOrder: number | null;
};

type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  merchandisingLabel: string;
  description: string;
  imageKey: string;
  imageAltText: string;
  galleryImageUrls: string;
  videoUrl: string;
  isActive: boolean;
  nationwideDelivery: boolean;
  manchesterDelivery: boolean;
  collectionAvailable: boolean;
  variants: AdminVariant[];
};

type ProductUpdateInput = Parameters<
  typeof dataClient.models.Product.update
>[0];
type ProductVariantUpdateInput = Parameters<
  typeof dataClient.models.ProductVariant.update
>[0];
type ProductCreateInput = Parameters<
  typeof dataClient.models.Product.create
>[0];
type ProductVariantCreateInput = Parameters<
  typeof dataClient.models.ProductVariant.create
>[0];
type ProductDeleteInput = Parameters<
  typeof dataClient.models.Product.delete
>[0];
type ProductVariantDeleteInput = Parameters<
  typeof dataClient.models.ProductVariant.delete
>[0];

type VariantDraft = {
  id: string;
  name: string;
  priceInPounds: string;
  isActive: boolean;
};

type ProductDraft = {
  name: string;
  category: string;
  merchandisingLabel: string;
  description: string;
  imageKey: string;
  imageAltText: string;
  galleryImageUrls: string;
  videoUrl: string;
  nationwideDelivery: boolean;
  collectionAvailable: boolean;
  variants: VariantDraft[];
};

type ProductMessage = {
  type: "success" | "error";
  text: string;
};

type ProductMediaField = "galleryImageUrls" | "imageKey" | "videoUrl";
type ProductMediaPreview = {
  galleryImageUrls: string[];
  imageKey: string;
  videoUrl: string;
};

type NewVariantDraft = {
  draftId: string;
  name: string;
  priceInPounds: string;
  isActive: boolean;
};

type NewProductDraft = {
  id: string;
  name: string;
  category: string;
  merchandisingLabel: string;
  description: string;
  imageKey: string;
  imageAltText: string;
  galleryImageUrls: string;
  videoUrl: string;
  isActive: boolean;
  nationwideDelivery: boolean;
  collectionAvailable: boolean;
  variants: NewVariantDraft[];
};

type CreateValidationMessages = Record<string, string>;

const pricePattern = /^\d+(\.\d{1,2})?$/;

function createId(prefix: string) {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

function createSlug(name: string, id: string) {
  const normalizedName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${normalizedName || "product"}-${id.slice(-8)}`;
}

function formatPenceAsPounds(priceInPence: number) {
  return (priceInPence / 100).toFixed(2);
}

function parsePoundsToPence(price: string) {
  const trimmedPrice = price.trim();

  if (!pricePattern.test(trimmedPrice)) {
    return null;
  }

  const [pounds, pence = ""] = trimmedPrice.split(".");
  const normalizedPence = pence.padEnd(2, "0");

  return Number(pounds) * 100 + Number(normalizedPence);
}

function normalizeOptionalText(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function appendStoredMediaPaths(currentValue: string, storedPaths: string[]) {
  const currentStoredPaths = parseStoredMediaPaths(currentValue);

  return [...currentStoredPaths, ...storedPaths].join("\n");
}

function getRemovedStoredMediaPaths(previousValue: string, nextValue: string) {
  const nextPaths = new Set(parseStoredMediaPaths(nextValue));

  return parseStoredMediaPaths(previousValue).filter(
    (previousPath) => !nextPaths.has(previousPath),
  );
}

function getMediaKindForField(field: ProductMediaField): ProductMediaKind {
  if (field === "videoUrl") {
    return "video";
  }

  if (field === "galleryImageUrls") {
    return "gallery";
  }

  return "main";
}

function createEmptyMediaPreview(): ProductMediaPreview {
  return {
    galleryImageUrls: [],
    imageKey: "",
    videoUrl: "",
  };
}

async function resolveMediaPreviewFromFields(fields: {
  galleryImageUrls: string;
  imageKey: string;
  videoUrl: string;
}) {
  const [imageKey, galleryImageUrls, videoUrl] = await Promise.all([
    resolveProductMediaUrl(fields.imageKey),
    Promise.all(
      parseStoredMediaPaths(fields.galleryImageUrls).map((path) =>
        resolveProductMediaUrl(path),
      ),
    ),
    resolveProductMediaUrl(fields.videoUrl),
  ]);

  return {
    galleryImageUrls: galleryImageUrls.filter(Boolean),
    imageKey,
    videoUrl,
  };
}

function createDraftFromProduct(product: AdminProduct): ProductDraft {
  return {
    name: product.name,
    category: product.category,
    merchandisingLabel: product.merchandisingLabel,
    description: product.description,
    imageKey: product.imageKey,
    imageAltText: product.imageAltText,
    galleryImageUrls: product.galleryImageUrls,
    videoUrl: product.videoUrl,
    nationwideDelivery: product.nationwideDelivery,
    collectionAvailable: product.collectionAvailable,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      priceInPounds: formatPenceAsPounds(variant.priceInPence),
      isActive: variant.isActive,
    })),
  };
}

function createBlankVariantDraft(): NewVariantDraft {
  return {
    draftId: createId("variant-draft"),
    name: "",
    priceInPounds: "",
    isActive: true,
  };
}

function createBlankProductDraft(): NewProductDraft {
  return {
    id: createId("product"),
    name: "",
    category: "",
    merchandisingLabel: "",
    description: "",
    imageKey: "",
    imageAltText: "",
    galleryImageUrls: "",
    videoUrl: "",
    isActive: true,
    nationwideDelivery: true,
    collectionAvailable: true,
    variants: [createBlankVariantDraft()],
  };
}

function removeProductMessage(
  messages: Record<string, ProductMessage>,
  productId: string,
) {
  return Object.fromEntries(
    Object.entries(messages).filter(([messageProductId]) => {
      return messageProductId !== productId;
    }),
  );
}

function AdminPage() {
  const [activeSection, setActiveSection] =
    useState<AdminSection>("products");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(
    null,
  );
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [productMessages, setProductMessages] = useState<
    Record<string, ProductMessage>
  >({});
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [newProductDraft, setNewProductDraft] = useState<NewProductDraft>(() =>
    createBlankProductDraft(),
  );
  const [createValidationMessages, setCreateValidationMessages] =
    useState<CreateValidationMessages>({});
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [createMessage, setCreateMessage] = useState<ProductMessage | null>(
    null,
  );
  const [uploadingMediaTarget, setUploadingMediaTarget] = useState<
    string | null
  >(null);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<
    Record<string, number>
  >({});
  const [newProductMediaPreview, setNewProductMediaPreview] =
    useState<ProductMediaPreview>(() => createEmptyMediaPreview());
  const [productMediaPreviews, setProductMediaPreviews] = useState<
    Record<string, ProductMediaPreview>
  >({});
  const [pendingDeleteProduct, setPendingDeleteProduct] =
    useState<AdminProduct | null>(null);
  const [deleteConfirmationValue, setDeleteConfirmationValue] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState("");
  const [retryProductDeleteOnly, setRetryProductDeleteOnly] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState("");
  const deleteConfirmationInputRef = useRef<HTMLInputElement | null>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const productResponse = await dataClient.models.Product.list({
        authMode: "userPool",
      });

      if (productResponse.errors?.length) {
        throw new Error(
          productResponse.errors.map((error) => error.message).join(", "),
        );
      }

      const loadedProducts: AdminProduct[] = await Promise.all(
        productResponse.data.map(async (product) => {
          const variantResponse = await product.variants({
            authMode: "userPool",
          });

          if (variantResponse.errors?.length) {
            throw new Error(
              variantResponse.errors
                .map((error) => error.message)
                .join(", "),
            );
          }

          return {
            id: product.id,
            name: product.name,
            slug: product.slug,
            category: product.category,
            merchandisingLabel: product.merchandisingLabel ?? "",
            description: product.description ?? "",
            imageKey: product.imageKey ?? "",
            imageAltText: product.imageAltText ?? "",
            galleryImageUrls: product.galleryImageUrls ?? "",
            videoUrl: product.videoUrl ?? "",
            isActive: product.isActive,
            nationwideDelivery: product.nationwideDelivery,
            manchesterDelivery: product.manchesterDelivery,
            collectionAvailable: product.collectionAvailable,
            variants: variantResponse.data
              .map((variant) => ({
                id: variant.id,
                productId: variant.productId,
                name: variant.name,
                priceInPence: variant.priceInPence,
                isActive: variant.isActive,
                stockQuantity: variant.stockQuantity ?? null,
                sortOrder: variant.sortOrder ?? null,
              }))
              .sort(
                (first, second) =>
                  (first.sortOrder ?? 0) - (second.sortOrder ?? 0),
              ),
          };
        }),
      );

      loadedProducts.sort((first, second) =>
        first.name.localeCompare(second.name),
      );

      setProducts(loadedProducts);
    } catch (error) {
      console.error("Failed to load admin products:", error);
      setLoadError("Could not load the product catalogue.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  useEffect(() => {
    if (pendingDeleteProduct) {
      deleteConfirmationInputRef.current?.focus();
    }
  }, [pendingDeleteProduct]);

  useEffect(() => {
    if (!pendingDeleteProduct || deletingProductId) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPendingDeleteProduct(null);
        setDeleteConfirmationValue("");
        setDeleteError("");
        setRetryProductDeleteOnly(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [deletingProductId, pendingDeleteProduct]);

  useEffect(() => {
    let isCancelled = false;

    if (!isCreatePanelOpen) {
      return;
    }

    async function hydrateNewProductPreview() {
      const preview = await resolveMediaPreviewFromFields({
        galleryImageUrls: newProductDraft.galleryImageUrls,
        imageKey: newProductDraft.imageKey,
        videoUrl: newProductDraft.videoUrl,
      });

      if (!isCancelled) {
        setNewProductMediaPreview(preview);
      }
    }

    void hydrateNewProductPreview();

    return () => {
      isCancelled = true;
    };
  }, [
    isCreatePanelOpen,
    newProductDraft.galleryImageUrls,
    newProductDraft.imageKey,
    newProductDraft.videoUrl,
  ]);

  useEffect(() => {
    let isCancelled = false;

    if (!editingProductId || !productDraft) {
      return;
    }

    async function hydrateProductPreview() {
      const preview = await resolveMediaPreviewFromFields({
        galleryImageUrls: productDraft.galleryImageUrls,
        imageKey: productDraft.imageKey,
        videoUrl: productDraft.videoUrl,
      });

      if (!isCancelled) {
        setProductMediaPreviews((currentPreviews) => ({
          ...currentPreviews,
          [editingProductId]: preview,
        }));
      }
    }

    void hydrateProductPreview();

    return () => {
      isCancelled = true;
    };
  }, [
    editingProductId,
    productDraft,
    productDraft?.galleryImageUrls,
    productDraft?.imageKey,
    productDraft?.videoUrl,
  ]);

  const catalogueStats = useMemo(() => {
    const activeProducts = products.filter((product) => product.isActive);
    const totalVariants = products.reduce(
      (total, product) => total + product.variants.length,
      0,
    );

    return {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      inactiveProducts: products.length - activeProducts.length,
      totalVariants,
    };
  }, [products]);

  async function toggleProductAvailability(product: AdminProduct) {
    const nextIsActive = !product.isActive;

    setUpdatingProductId(product.id);
    setActionError("");

    try {
      const updateInput = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        merchandisingLabel: normalizeOptionalText(product.merchandisingLabel),
        description: product.description,
        imageKey: product.imageKey,
        imageAltText: product.imageAltText,
        galleryImageUrls: product.galleryImageUrls,
        videoUrl: product.videoUrl,
        isActive: nextIsActive,
        nationwideDelivery: product.nationwideDelivery,
        manchesterDelivery: false,
        collectionAvailable: product.collectionAvailable,
      } as unknown as ProductUpdateInput;

      const response = await dataClient.models.Product.update(updateInput, {
        authMode: "userPool",
      });

      if (response.errors?.length || !response.data) {
        throw new Error(
          response.errors?.map((error) => error.message).join(", ") ??
            "No product returned after update.",
        );
      }

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id
            ? {
                ...currentProduct,
                isActive: response.data?.isActive ?? nextIsActive,
              }
            : currentProduct,
        ),
      );
    } catch (error) {
      console.error("Failed to update product:", error);
      setActionError(
        `Could not update ${product.name}. The other products are unchanged.`,
      );
    } finally {
      setUpdatingProductId(null);
    }
  }

  function sortProductsByName(nextProducts: AdminProduct[]) {
    return [...nextProducts].sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  }

  function startEditingProduct(product: AdminProduct) {
    setIsCreatePanelOpen(false);
    setPendingDeleteProduct(null);
    setDeleteConfirmationValue("");
    setDeleteError("");
    setRetryProductDeleteOnly(false);
    setDeleteSuccessMessage("");
    setEditingProductId(product.id);
    setProductDraft(createDraftFromProduct(product));
    setProductMediaPreviews((currentPreviews) => ({
      ...currentPreviews,
      [product.id]: createEmptyMediaPreview(),
    }));
    setValidationMessages([]);
    setProductMessages((currentMessages) =>
      removeProductMessage(currentMessages, product.id),
    );
  }

  function cancelEditingProduct() {
    const originalProduct = products.find(
      (product) => product.id === editingProductId,
    );

    if (originalProduct && productDraft) {
      void removeStoredMediaPaths([
        ...getRemovedStoredMediaPaths(productDraft.imageKey, originalProduct.imageKey),
        ...getRemovedStoredMediaPaths(
          productDraft.galleryImageUrls,
          originalProduct.galleryImageUrls,
        ),
        ...getRemovedStoredMediaPaths(productDraft.videoUrl, originalProduct.videoUrl),
      ]);
    }

    if (editingProductId) {
      setProductMediaPreviews((currentPreviews) => ({
        ...currentPreviews,
        [editingProductId]: createEmptyMediaPreview(),
      }));
    }

    setEditingProductId(null);
    setProductDraft(null);
    setValidationMessages([]);
  }

  function openCreatePanel() {
    setEditingProductId(null);
    setProductDraft(null);
    setValidationMessages([]);
    setPendingDeleteProduct(null);
    setDeleteConfirmationValue("");
    setDeleteError("");
    setRetryProductDeleteOnly(false);
    setDeleteSuccessMessage("");
    setIsCreatePanelOpen(true);
    setNewProductMediaPreview(createEmptyMediaPreview());
    setCreateMessage(null);
    setCreateValidationMessages({});
  }

  function cancelCreateProduct() {
    void removeStoredMediaPaths([
      ...parseStoredMediaPaths(newProductDraft.imageKey),
      ...parseStoredMediaPaths(newProductDraft.galleryImageUrls),
      ...parseStoredMediaPaths(newProductDraft.videoUrl),
    ]);
    setIsCreatePanelOpen(false);
    setNewProductDraft(createBlankProductDraft());
    setNewProductMediaPreview(createEmptyMediaPreview());
    setCreateValidationMessages({});
    setCreateMessage(null);
  }

  function openDeleteConfirmation(product: AdminProduct) {
    setEditingProductId(null);
    setProductDraft(null);
    setValidationMessages([]);
    setIsCreatePanelOpen(false);
    setCreateValidationMessages({});
    setCreateMessage(null);
    setPendingDeleteProduct(product);
    setDeleteConfirmationValue("");
    setDeleteError("");
    setRetryProductDeleteOnly(false);
    setDeleteSuccessMessage("");
    setProductMessages((currentMessages) =>
      removeProductMessage(currentMessages, product.id),
    );
  }

  function cancelDeleteConfirmation() {
    setPendingDeleteProduct(null);
    setDeleteConfirmationValue("");
    setDeleteError("");
    setRetryProductDeleteOnly(false);
  }

  function updateProductDraft(
    field: Exclude<keyof ProductDraft, "variants">,
    value: string | boolean,
  ) {
    setProductDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            [field]: value,
          }
        : currentDraft,
    );
  }

  function updateVariantDraft(
    variantId: string,
    field: keyof Omit<VariantDraft, "id">,
    value: string | boolean,
  ) {
    setProductDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            variants: currentDraft.variants.map((variant) =>
              variant.id === variantId
                ? {
                    ...variant,
                    [field]: value,
                  }
                : variant,
            ),
          }
        : currentDraft,
    );
  }

  function updateNewProductDraft(
    field: Exclude<keyof NewProductDraft, "variants">,
    value: string | boolean,
  ) {
    setNewProductDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  async function uploadMediaFiles(
    files: FileList | null,
    field: ProductMediaField,
    productId: string,
    uploadTarget: string,
  ) {
    if (!files || files.length === 0) {
      return [];
    }

    const uploadableFiles = Array.from(files);
    const mediaKind = getMediaKindForField(field);

    return Promise.all(
      uploadableFiles.map((file, index) => {
        const fileTarget = `${uploadTarget}-${index}`;

        return uploadProductMediaFile({
          file,
          kind: mediaKind,
          productId,
          onProgress: (progress) => {
            setMediaUploadProgress((currentProgress) => ({
              ...currentProgress,
              [fileTarget]: progress,
              [uploadTarget]: Math.max(
                currentProgress[uploadTarget] ?? 0,
                progress,
              ),
            }));
          },
        });
      }),
    );
  }

  async function resolveMediaPreviews(paths: string[]) {
    return (
      await Promise.all(paths.map((path) => resolveProductMediaUrl(path)))
    ).filter(Boolean);
  }

  async function removeStoredMediaPaths(paths: string[]) {
    await Promise.allSettled(paths.map((path) => removeProductMediaFile(path)));
  }

  async function handleNewProductMediaUpload(
    field: ProductMediaField,
    files: FileList | null,
  ) {
    const uploadTarget = `new-${field}`;

    setUploadingMediaTarget(uploadTarget);
    setActionError("");
    setCreateMessage(null);
    setMediaUploadProgress((currentProgress) => ({
      ...currentProgress,
      [uploadTarget]: 0,
    }));

    try {
      const uploadedPaths = await uploadMediaFiles(
        files,
        field,
        newProductDraft.id,
        uploadTarget,
      );

      if (uploadedPaths.length === 0) {
        return;
      }

      const previewUrls = await resolveMediaPreviews(uploadedPaths);
      const previousValue = newProductDraft[field];

      setNewProductDraft((currentDraft) => ({
        ...currentDraft,
        [field]:
          field === "galleryImageUrls"
            ? appendStoredMediaPaths(currentDraft.galleryImageUrls, uploadedPaths)
            : uploadedPaths[0],
      }));
      setNewProductMediaPreview((currentPreview) => ({
        ...currentPreview,
        [field]:
          field === "galleryImageUrls"
            ? [...currentPreview.galleryImageUrls, ...previewUrls]
            : previewUrls[0] ?? "",
      }));
      if (field !== "galleryImageUrls" && typeof previousValue === "string") {
        await removeStoredMediaPaths(parseStoredMediaPaths(previousValue));
      }
      setCreateMessage({
        type: "success",
        text: "Media uploaded. Save the product to keep these changes.",
      });
    } catch (error) {
      console.error("Failed to upload product media:", error);
      setActionError(
        error instanceof Error
          ? error.message
          : "Media upload failed. Please try again.",
      );
    } finally {
      setUploadingMediaTarget(null);
      setMediaUploadProgress((currentProgress) => ({
        ...currentProgress,
        [uploadTarget]: 0,
      }));
    }
  }

  async function handleProductMediaUpload(
    product: AdminProduct,
    field: ProductMediaField,
    files: FileList | null,
  ) {
    const uploadTarget = `${product.id}-${field}`;

    setUploadingMediaTarget(uploadTarget);
    setActionError("");
    setMediaUploadProgress((currentProgress) => ({
      ...currentProgress,
      [uploadTarget]: 0,
    }));
    setProductMessages((currentMessages) =>
      removeProductMessage(currentMessages, product.id),
    );

    try {
      const uploadedPaths = await uploadMediaFiles(
        files,
        field,
        product.id,
        uploadTarget,
      );

      if (uploadedPaths.length === 0) {
        return;
      }

      const previewUrls = await resolveMediaPreviews(uploadedPaths);
      setProductDraft((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              [field]:
                field === "galleryImageUrls"
                  ? appendStoredMediaPaths(
                      currentDraft.galleryImageUrls,
                      uploadedPaths,
                    )
                  : uploadedPaths[0],
            }
          : currentDraft,
      );
      setProductMediaPreviews((currentPreviews) => {
        const currentProductPreview =
          currentPreviews[product.id] ?? createEmptyMediaPreview();

        return {
          ...currentPreviews,
          [product.id]: {
            ...currentProductPreview,
            [field]:
              field === "galleryImageUrls"
                ? [
                    ...currentProductPreview.galleryImageUrls,
                    ...previewUrls,
                  ]
                : previewUrls[0] ?? "",
          },
        };
      });
      setProductMessages((currentMessages) => ({
        ...currentMessages,
        [product.id]: {
          type: "success",
          text: "Media uploaded. Save changes to publish it on the site.",
        },
      }));
    } catch (error) {
      console.error("Failed to upload product media:", error);
      setProductMessages((currentMessages) => ({
        ...currentMessages,
        [product.id]: {
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Media upload failed. Please try again.",
        },
      }));
    } finally {
      setUploadingMediaTarget(null);
      setMediaUploadProgress((currentProgress) => ({
        ...currentProgress,
        [uploadTarget]: 0,
      }));
    }
  }

  async function removeNewProductMedia(field: ProductMediaField, index?: number) {
    const currentValue = newProductDraft[field];

    if (field === "galleryImageUrls") {
      const currentPaths = parseStoredMediaPaths(newProductDraft.galleryImageUrls);
      const nextPaths =
        typeof index === "number"
          ? currentPaths.filter((_, pathIndex) => pathIndex !== index)
          : [];
      const removedPaths =
        typeof index === "number" ? currentPaths.slice(index, index + 1) : currentPaths;

      await removeStoredMediaPaths(removedPaths);
      updateNewProductDraft("galleryImageUrls", nextPaths.join("\n"));
      setNewProductMediaPreview((currentPreview) => ({
        ...currentPreview,
        galleryImageUrls:
          typeof index === "number"
            ? currentPreview.galleryImageUrls.filter(
                (_, previewIndex) => previewIndex !== index,
              )
            : [],
      }));
      return;
    }

    await removeStoredMediaPaths(parseStoredMediaPaths(currentValue));
    updateNewProductDraft(field, "");
    setNewProductMediaPreview((currentPreview) => ({
      ...currentPreview,
      [field]: "",
    }));
  }

  async function removeProductMedia(
    product: AdminProduct,
    field: ProductMediaField,
    index?: number,
  ) {
    const currentValue = productDraft?.[field] ?? product[field];

    if (field === "galleryImageUrls") {
      const currentPaths = parseStoredMediaPaths(currentValue);
      const originalPaths = new Set(parseStoredMediaPaths(product[field]));
      const nextPaths =
        typeof index === "number"
          ? currentPaths.filter((_, pathIndex) => pathIndex !== index)
          : [];
      const removedPaths =
        typeof index === "number" ? currentPaths.slice(index, index + 1) : currentPaths;

      await removeStoredMediaPaths(
        removedPaths.filter((path) => !originalPaths.has(path)),
      );
      updateProductDraft("galleryImageUrls", nextPaths.join("\n"));
      setProductMediaPreviews((currentPreviews) => {
        const currentProductPreview =
          currentPreviews[product.id] ?? createEmptyMediaPreview();

        return {
          ...currentPreviews,
          [product.id]: {
            ...currentProductPreview,
            galleryImageUrls:
              typeof index === "number"
                ? currentProductPreview.galleryImageUrls.filter(
                    (_, previewIndex) => previewIndex !== index,
                  )
                : [],
          },
        };
      });
      return;
    }

    const originalPaths = new Set(parseStoredMediaPaths(product[field]));
    await removeStoredMediaPaths(
      parseStoredMediaPaths(currentValue).filter((path) => !originalPaths.has(path)),
    );
    updateProductDraft(field, "");
    setProductMediaPreviews((currentPreviews) => {
      const currentProductPreview =
        currentPreviews[product.id] ?? createEmptyMediaPreview();

      return {
        ...currentPreviews,
        [product.id]: {
          ...currentProductPreview,
          [field]: "",
        },
      };
    });
  }

  function updateNewVariantDraft(
    draftId: string,
    field: keyof Omit<NewVariantDraft, "draftId">,
    value: string | boolean,
  ) {
    setNewProductDraft((currentDraft) => ({
      ...currentDraft,
      variants: currentDraft.variants.map((variant) =>
        variant.draftId === draftId
          ? {
              ...variant,
              [field]: value,
            }
          : variant,
      ),
    }));
  }

  function addNewVariantDraft() {
    setNewProductDraft((currentDraft) => ({
      ...currentDraft,
      variants: [...currentDraft.variants, createBlankVariantDraft()],
    }));
  }

  function removeNewVariantDraft(draftId: string) {
    setNewProductDraft((currentDraft) => {
      if (currentDraft.variants.length === 1) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        variants: currentDraft.variants.filter(
          (variant) => variant.draftId !== draftId,
        ),
      };
    });
  }

  function validateProductDraft(draft: ProductDraft) {
    const messages: string[] = [];

    if (draft.name.trim() === "") {
      messages.push("Product name is required.");
    }

    if (draft.category.trim() === "") {
      messages.push("Category is required.");
    }

    if (draft.description.trim() === "") {
      messages.push("Description is required.");
    }

    for (const variant of draft.variants) {
      if (variant.name.trim() === "") {
        messages.push("Every variant needs a name.");
      }

      if (parsePoundsToPence(variant.priceInPounds) === null) {
        messages.push(
          `${variant.name.trim() || "Every variant"} needs a valid price with no more than two decimals.`,
        );
      }
    }

    return [...new Set(messages)];
  }

  function validateNewProductDraft(draft: NewProductDraft) {
    const messages: CreateValidationMessages = {};

    if (draft.name.trim() === "") {
      messages.name = "Product name is required.";
    }

    if (draft.category.trim() === "") {
      messages.category = "Category is required.";
    }

    if (draft.description.trim() === "") {
      messages.description = "Description is required.";
    }

    if (draft.variants.length === 0) {
      messages.variants = "Add at least one variant.";
    }

    const seenVariantNames = new Set<string>();

    draft.variants.forEach((variant, index) => {
      const variantName = variant.name.trim();
      const nameKey = `variant-${variant.draftId}-name`;
      const priceKey = `variant-${variant.draftId}-price`;

      if (variantName === "") {
        messages[nameKey] = `Variant ${index + 1} name is required.`;
      } else {
        const normalizedName = variantName.toLowerCase();

        if (seenVariantNames.has(normalizedName)) {
          messages[nameKey] = "Variant names must be unique.";
        }

        seenVariantNames.add(normalizedName);
      }

      if (variant.priceInPounds.trim() === "") {
        messages[priceKey] = `Variant ${index + 1} price is required.`;
      } else if (parsePoundsToPence(variant.priceInPounds) === null) {
        messages[priceKey] =
          "Enter a valid non-negative price with no more than two decimals.";
      }
    });

    return messages;
  }

  async function saveProductChanges(product: AdminProduct) {
    if (!productDraft) {
      return;
    }

    const nextValidationMessages = validateProductDraft(productDraft);

    if (nextValidationMessages.length > 0) {
      setValidationMessages(nextValidationMessages);
      return;
    }

    const nextVariants = productDraft.variants.map((variantDraft) => {
      const priceInPence = parsePoundsToPence(variantDraft.priceInPounds);

      if (priceInPence === null) {
        throw new Error("Invalid price.");
      }

      return {
        ...variantDraft,
        priceInPence,
      };
    });

    setSavingProductId(product.id);
    setValidationMessages([]);
    setProductMessages((currentMessages) =>
      removeProductMessage(currentMessages, product.id),
    );

    try {
      const productInput = {
        id: product.id,
        name: productDraft.name.trim(),
        slug: product.slug,
        category: productDraft.category.trim(),
        merchandisingLabel: normalizeOptionalText(
          productDraft.merchandisingLabel,
        ),
        description: productDraft.description.trim(),
        imageKey: normalizeOptionalText(productDraft.imageKey),
        imageAltText: normalizeOptionalText(productDraft.imageAltText),
        galleryImageUrls: normalizeOptionalText(productDraft.galleryImageUrls),
        videoUrl: normalizeOptionalText(productDraft.videoUrl),
        isActive: product.isActive,
        nationwideDelivery: productDraft.nationwideDelivery,
        manchesterDelivery: false,
        collectionAvailable: productDraft.collectionAvailable,
      } as unknown as ProductUpdateInput;

      const productResponse = await dataClient.models.Product.update(
        productInput,
        {
          authMode: "userPool",
        },
      );

      if (productResponse.errors?.length || !productResponse.data) {
        throw new Error(
          productResponse.errors?.map((error) => error.message).join(", ") ??
            "No product returned after update.",
        );
      }

      const changedVariantDrafts = nextVariants.filter((variantDraft) => {
        const originalVariant = product.variants.find(
          (variant) => variant.id === variantDraft.id,
        );

        return (
          originalVariant &&
          (originalVariant.name !== variantDraft.name.trim() ||
            originalVariant.priceInPence !== variantDraft.priceInPence ||
            originalVariant.isActive !== variantDraft.isActive)
        );
      });

      for (const variantDraft of changedVariantDrafts) {
        const originalVariant = product.variants.find(
          (variant) => variant.id === variantDraft.id,
        );

        if (!originalVariant) {
          continue;
        }

        const variantInput = {
          id: originalVariant.id,
          productId: originalVariant.productId,
          name: variantDraft.name.trim(),
          priceInPence: variantDraft.priceInPence,
          isActive: variantDraft.isActive,
          stockQuantity: originalVariant.stockQuantity,
          sortOrder: originalVariant.sortOrder,
        } as unknown as ProductVariantUpdateInput;

        const variantResponse =
          await dataClient.models.ProductVariant.update(variantInput, {
            authMode: "userPool",
          });

        if (variantResponse.errors?.length || !variantResponse.data) {
          throw new Error(
            variantResponse.errors?.map((error) => error.message).join(", ") ??
              `No variant returned after updating ${variantDraft.name}.`,
          );
        }
      }

      const updatedProduct: AdminProduct = {
        ...product,
        name: productDraft.name.trim(),
        category: productDraft.category.trim(),
        merchandisingLabel: productDraft.merchandisingLabel,
        description: productDraft.description.trim(),
        imageKey: productDraft.imageKey.trim(),
        imageAltText: productDraft.imageAltText.trim(),
        galleryImageUrls: productDraft.galleryImageUrls.trim(),
        videoUrl: productDraft.videoUrl.trim(),
        nationwideDelivery: productDraft.nationwideDelivery,
        manchesterDelivery: false,
        collectionAvailable: productDraft.collectionAvailable,
        variants: product.variants.map((variant) => {
          const savedVariant = nextVariants.find(
            (variantDraft) => variantDraft.id === variant.id,
          );

          return savedVariant
            ? {
                ...variant,
                name: savedVariant.name.trim(),
                priceInPence: savedVariant.priceInPence,
                isActive: savedVariant.isActive,
              }
            : variant;
        }),
      };

      await removeStoredMediaPaths([
        ...getRemovedStoredMediaPaths(product.imageKey, updatedProduct.imageKey),
        ...getRemovedStoredMediaPaths(
          product.galleryImageUrls,
          updatedProduct.galleryImageUrls,
        ),
        ...getRemovedStoredMediaPaths(product.videoUrl, updatedProduct.videoUrl),
      ]);

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id ? updatedProduct : currentProduct,
        ),
      );
      setProductMessages((currentMessages) => ({
        ...currentMessages,
        [product.id]: {
          type: "success",
          text: `${updatedProduct.name} was updated.`,
        },
      }));
      setEditingProductId(null);
      setProductDraft(null);
      setProductMediaPreviews((currentPreviews) => ({
        ...currentPreviews,
        [product.id]: createEmptyMediaPreview(),
      }));
    } catch (error) {
      console.error("Failed to save product:", error);
      setProductMessages((currentMessages) => ({
        ...currentMessages,
        [product.id]: {
          type: "error",
          text: `Could not save ${product.name}. The catalogue is unchanged.`,
        },
      }));
    } finally {
      setSavingProductId(null);
    }
  }

  async function cleanupCreatedProduct(
    productId: string,
    createdVariantIds: string[],
  ) {
    for (const variantId of createdVariantIds) {
      try {
        const deleteVariantInput = {
          id: variantId,
        } as unknown as ProductVariantDeleteInput;

        await dataClient.models.ProductVariant.delete(deleteVariantInput, {
          authMode: "userPool",
        });
      } catch (error) {
        console.error(`Failed to clean up variant ${variantId}:`, error);
      }
    }

    try {
      const deleteProductInput = {
        id: productId,
      } as unknown as ProductDeleteInput;

      await dataClient.models.Product.delete(deleteProductInput, {
        authMode: "userPool",
      });
    } catch (error) {
      console.error(`Failed to clean up product ${productId}:`, error);
    }
  }

  async function deleteProductPermanently(product: AdminProduct) {
    const deleteVariantsFirst = !retryProductDeleteOnly;

    setDeletingProductId(product.id);
    setDeleteError("");
    setDeleteSuccessMessage("");

    try {
      if (deleteVariantsFirst) {
        for (const variant of product.variants) {
          const deleteVariantInput = {
            id: variant.id,
          } as unknown as ProductVariantDeleteInput;

          const variantResponse = await dataClient.models.ProductVariant.delete(
            deleteVariantInput,
            {
              authMode: "userPool",
            },
          );

          if (variantResponse.errors?.length) {
            throw new Error(
              variantResponse.errors
                .map((error) => error.message)
                .join(", "),
            );
          }
        }
      }
    } catch (error) {
      console.error(`Failed to delete variants for ${product.name}:`, error);
      setDeleteError(
        `Could not delete every variant for ${product.name}. The product was not deleted, and the catalogue is unchanged.`,
      );
      setDeletingProductId(null);
      return;
    }

    try {
      const deleteProductInput = {
        id: product.id,
      } as unknown as ProductDeleteInput;

      const productResponse = await dataClient.models.Product.delete(
        deleteProductInput,
        {
          authMode: "userPool",
        },
      );

      if (productResponse.errors?.length) {
        throw new Error(
          productResponse.errors.map((error) => error.message).join(", "),
        );
      }

      await removeStoredMediaPaths([
        ...parseStoredMediaPaths(product.imageKey),
        ...parseStoredMediaPaths(product.galleryImageUrls),
        ...parseStoredMediaPaths(product.videoUrl),
      ]);

      setProducts((currentProducts) =>
        currentProducts.filter(
          (currentProduct) => currentProduct.id !== product.id,
        ),
      );
      setDeleteSuccessMessage(`${product.name} was permanently deleted.`);
      setPendingDeleteProduct(null);
      setDeleteConfirmationValue("");
      setDeleteError("");
      setRetryProductDeleteOnly(false);
    } catch (error) {
      console.error(`Failed to delete product ${product.name}:`, error);

      const productWithoutVariants = {
        ...product,
        variants: [],
      };

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id
            ? productWithoutVariants
            : currentProduct,
        ),
      );
      setPendingDeleteProduct(productWithoutVariants);
      setRetryProductDeleteOnly(true);
      setDeleteError(
        `The variants were deleted, but ${product.name} could not be deleted. Retry the product delete; the product is still shown so you do not lose track of it.`,
      );
    } finally {
      setDeletingProductId(null);
    }
  }

  async function createProduct() {
    const messages = validateNewProductDraft(newProductDraft);

    if (Object.keys(messages).length > 0) {
      setCreateValidationMessages(messages);
      return;
    }

    const productId = newProductDraft.id;
    const productSlug = createSlug(newProductDraft.name, productId);
    const createdVariantIds: string[] = [];
    const nextVariants = newProductDraft.variants.map((variant, index) => {
      const priceInPence = parsePoundsToPence(variant.priceInPounds);

      if (priceInPence === null) {
        throw new Error("Invalid price.");
      }

      return {
        id: createId("variant"),
        productId,
        name: variant.name.trim(),
        priceInPence,
        isActive: variant.isActive,
        stockQuantity: null,
        sortOrder: index + 1,
      };
    });

    setIsCreatingProduct(true);
    setCreateValidationMessages({});
    setCreateMessage(null);

    try {
      const productInput = {
        id: productId,
        name: newProductDraft.name.trim(),
        slug: productSlug,
        description: newProductDraft.description.trim(),
        category: newProductDraft.category.trim(),
        merchandisingLabel: normalizeOptionalText(
          newProductDraft.merchandisingLabel,
        ),
        imageKey: normalizeOptionalText(newProductDraft.imageKey),
        imageAltText: normalizeOptionalText(newProductDraft.imageAltText),
        galleryImageUrls: normalizeOptionalText(newProductDraft.galleryImageUrls),
        videoUrl: normalizeOptionalText(newProductDraft.videoUrl),
        isActive: newProductDraft.isActive,
        nationwideDelivery: newProductDraft.nationwideDelivery,
        manchesterDelivery: false,
        collectionAvailable: newProductDraft.collectionAvailable,
      } as unknown as ProductCreateInput;

      const productResponse = await dataClient.models.Product.create(
        productInput,
        {
          authMode: "userPool",
        },
      );

      if (productResponse.errors?.length || !productResponse.data) {
        throw new Error(
          productResponse.errors?.map((error) => error.message).join(", ") ??
            "No product returned after create.",
        );
      }

      try {
        for (const variant of nextVariants) {
          const variantInput = {
            id: variant.id,
            productId: variant.productId,
            name: variant.name,
            priceInPence: variant.priceInPence,
            isActive: variant.isActive,
            stockQuantity: variant.stockQuantity,
            sortOrder: variant.sortOrder,
          } as unknown as ProductVariantCreateInput;

          const variantResponse =
            await dataClient.models.ProductVariant.create(variantInput, {
              authMode: "userPool",
            });

          if (variantResponse.errors?.length || !variantResponse.data) {
            throw new Error(
              variantResponse.errors
                ?.map((error) => error.message)
                .join(", ") ?? `No variant returned after creating ${variant.name}.`,
            );
          }

          createdVariantIds.push(variant.id);
        }
      } catch (error) {
        await cleanupCreatedProduct(productId, createdVariantIds);
        throw error;
      }

      const createdProduct: AdminProduct = {
        id: productId,
        name: newProductDraft.name.trim(),
        slug: productSlug,
        category: newProductDraft.category.trim(),
        merchandisingLabel: newProductDraft.merchandisingLabel,
        description: newProductDraft.description.trim(),
        imageKey: newProductDraft.imageKey.trim(),
        imageAltText: newProductDraft.imageAltText.trim(),
        galleryImageUrls: newProductDraft.galleryImageUrls.trim(),
        videoUrl: newProductDraft.videoUrl.trim(),
        isActive: newProductDraft.isActive,
        nationwideDelivery: newProductDraft.nationwideDelivery,
        manchesterDelivery: false,
        collectionAvailable: newProductDraft.collectionAvailable,
        variants: nextVariants,
      };

      setProducts((currentProducts) =>
        sortProductsByName([...currentProducts, createdProduct]),
      );
      setProductMessages((currentMessages) => ({
        ...currentMessages,
        [productId]: {
          type: "success",
          text: `${createdProduct.name} was created.`,
        },
      }));
      setNewProductDraft(createBlankProductDraft());
      setNewProductMediaPreview(createEmptyMediaPreview());
      setIsCreatePanelOpen(false);
    } catch (error) {
      console.error("Failed to create product:", error);
      await removeStoredMediaPaths([
        ...parseStoredMediaPaths(newProductDraft.imageKey),
        ...parseStoredMediaPaths(newProductDraft.galleryImageUrls),
        ...parseStoredMediaPaths(newProductDraft.videoUrl),
      ]);
      setNewProductDraft((currentDraft) => ({
        ...currentDraft,
        imageKey: "",
        galleryImageUrls: "",
        videoUrl: "",
      }));
      setNewProductMediaPreview(createEmptyMediaPreview());
      setCreateMessage({
        type: "error",
        text: "Could not create the product. The existing catalogue is unchanged.",
      });
    } finally {
      setIsCreatingProduct(false);
    }
  }

  return (
    <main className="page admin-dashboard">
      <section className="page-header admin-dashboard-header">
        <div>
          <p className="eyebrow">Admin dashboard</p>
          <h1>Manage Butter & Better</h1>
          <p>Manage products, availability, prices and delivery options.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadProducts()}
          disabled={activeSection !== "products" || isLoading}
        >
          {isLoading && activeSection === "products"
            ? "Refreshing..."
            : "Refresh catalogue"}
        </button>
      </section>

      <AdminSectionTabs
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {activeSection === "products" && !isLoading && !loadError && (
        <section className="admin-stats" aria-label="Catalogue summary">
          <article className="admin-stat-card">
            <span>Total products</span>
            <strong>{catalogueStats.totalProducts}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Available</span>
            <strong>{catalogueStats.activeProducts}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Unavailable</span>
            <strong>{catalogueStats.inactiveProducts}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Total variants</span>
            <strong>{catalogueStats.totalVariants}</strong>
          </article>
        </section>
      )}

      {activeSection === "products" && isLoading && (
        <section className="admin-state-message" aria-live="polite">
          <p>Loading products...</p>
        </section>
      )}

      {activeSection === "products" && !isLoading && loadError && (
        <section className="admin-state-message" role="alert">
          <h2>Something went wrong</h2>
          <p>{loadError}</p>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadProducts()}
          >
            Try again
          </button>
        </section>
      )}

      {activeSection === "products" && !isLoading && !loadError && actionError && (
        <div className="admin-action-error" role="alert">
          <span>{actionError}</span>

          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setActionError("")}
          >
            ×
          </button>
        </div>
      )}

      {activeSection === "products" &&
        !isLoading &&
        !loadError &&
        deleteSuccessMessage && (
        <div className="admin-product-message admin-product-message-success">
          {deleteSuccessMessage}
        </div>
      )}

      {activeSection === "products" && !isLoading && !loadError && (
        <section className="admin-products">
          <div className="section-heading admin-products-heading">
            <div>
              <p className="eyebrow">Catalogue</p>
              <h2>Products</h2>
            </div>

            <button
              type="button"
              className="primary-button"
              disabled={isCreatingProduct}
              onClick={openCreatePanel}
            >
              Add product
            </button>
          </div>

          {isCreatePanelOpen && (
            <form
              className="admin-edit-panel admin-create-panel"
              onSubmit={(event) => {
                event.preventDefault();
                void createProduct();
              }}
            >
              <div className="admin-edit-heading">
                <div>
                  <p className="eyebrow">New product</p>
                  <h4>Add product</h4>
                </div>

                {isCreatingProduct && <span>Creating...</span>}
              </div>

              {createMessage && (
                <div
                  className={`admin-product-message admin-product-message-${createMessage.type}`}
                  role="alert"
                >
                  {createMessage.text}
                </div>
              )}

              {createValidationMessages.variants && (
                <div className="validation-summary" role="alert">
                  <p>{createValidationMessages.variants}</p>
                </div>
              )}

              <div className="admin-edit-grid">
                <label>
                  <span>Product name</span>
                  <input
                    type="text"
                    value={newProductDraft.name}
                    disabled={isCreatingProduct}
                    onChange={(event) =>
                      updateNewProductDraft("name", event.target.value)
                    }
                  />
                  {createValidationMessages.name && (
                    <p className="form-error">
                      {createValidationMessages.name}
                    </p>
                  )}
                </label>

                <label>
                  <span>Category</span>
                  <input
                    type="text"
                    value={newProductDraft.category}
                    disabled={isCreatingProduct}
                    onChange={(event) =>
                      updateNewProductDraft("category", event.target.value)
                    }
                  />
                  {createValidationMessages.category && (
                    <p className="form-error">
                      {createValidationMessages.category}
                    </p>
                  )}
                </label>

                <label>
                  <span>Shop label</span>
                  <select
                    value={newProductDraft.merchandisingLabel}
                    disabled={isCreatingProduct}
                    onChange={(event) =>
                      updateNewProductDraft(
                        "merchandisingLabel",
                        event.target.value,
                      )
                    }
                  >
                    <option value="">None</option>
                    <option value="Best Seller">Best Seller</option>
                    <option value="New Drop">New Drop</option>
                  </select>
                </label>

                <label className="admin-edit-wide">
                  <span>Description</span>
                  <textarea
                    value={newProductDraft.description}
                    disabled={isCreatingProduct}
                    rows={3}
                    onChange={(event) =>
                      updateNewProductDraft("description", event.target.value)
                    }
                  />
                  {createValidationMessages.description && (
                    <p className="form-error">
                      {createValidationMessages.description}
                    </p>
                  )}
                </label>
              </div>

              <fieldset className="admin-edit-options admin-media-options">
                <legend>Product media</legend>

                <label>
                  <span>Main image upload</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    disabled={
                      isCreatingProduct ||
                      uploadingMediaTarget === "new-imageKey"
                    }
                    onChange={(event) => {
                      void handleNewProductMediaUpload(
                        "imageKey",
                        event.target.files,
                      );
                      event.currentTarget.value = "";
                    }}
                  />
                  {uploadingMediaTarget === "new-imageKey" && (
                    <p className="admin-inline-note">
                      Uploading image... {mediaUploadProgress["new-imageKey"] ?? 0}%
                    </p>
                  )}
                </label>

                <label>
                  <span>Stored main image path</span>
                  <input
                    type="text"
                    value={newProductDraft.imageKey}
                    disabled={isCreatingProduct}
                    placeholder="Upload an image to fill this"
                    onChange={(event) =>
                      updateNewProductDraft("imageKey", event.target.value)
                    }
                  />
                </label>

                {(newProductMediaPreview.imageKey ||
                  newProductDraft.imageKey) && (
                  <div className="admin-media-preview">
                    {newProductMediaPreview.imageKey && (
                      <img
                        src={newProductMediaPreview.imageKey}
                        alt="Main product upload preview"
                      />
                    )}
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isCreatingProduct}
                      onClick={() => void removeNewProductMedia("imageKey")}
                    >
                      Remove main image
                    </button>
                  </div>
                )}

                <label>
                  <span>Image alt text</span>
                  <input
                    type="text"
                    value={newProductDraft.imageAltText}
                    disabled={isCreatingProduct}
                    placeholder="Describe the product photo"
                    onChange={(event) =>
                      updateNewProductDraft("imageAltText", event.target.value)
                    }
                  />
                </label>

                <label>
                  <span>Gallery image uploads</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    multiple
                    disabled={
                      isCreatingProduct ||
                      uploadingMediaTarget === "new-galleryImageUrls"
                    }
                    onChange={(event) => {
                      void handleNewProductMediaUpload(
                        "galleryImageUrls",
                        event.target.files,
                      );
                      event.currentTarget.value = "";
                    }}
                  />
                  {uploadingMediaTarget === "new-galleryImageUrls" && (
                    <p className="admin-inline-note">
                      Uploading gallery...{" "}
                      {mediaUploadProgress["new-galleryImageUrls"] ?? 0}%
                    </p>
                  )}
                </label>

                <label>
                  <span>Stored gallery image paths</span>
                  <textarea
                    value={newProductDraft.galleryImageUrls}
                    disabled={isCreatingProduct}
                    rows={4}
                    placeholder="Upload gallery images to fill this"
                    onChange={(event) =>
                      updateNewProductDraft(
                        "galleryImageUrls",
                        event.target.value,
                      )
                    }
                  />
                </label>

                {(newProductMediaPreview.galleryImageUrls.length > 0 ||
                  newProductDraft.galleryImageUrls) && (
                  <div className="admin-media-preview-grid">
                    {parseStoredMediaPaths(newProductDraft.galleryImageUrls).map(
                      (path, index) => (
                        <div key={`${path}-${index}`} className="admin-media-preview">
                          {newProductMediaPreview.galleryImageUrls[index] && (
                            <img
                              src={newProductMediaPreview.galleryImageUrls[index]}
                              alt={`Gallery upload preview ${index + 1}`}
                            />
                          )}
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={isCreatingProduct}
                            onClick={() =>
                              void removeNewProductMedia(
                                "galleryImageUrls",
                                index,
                              )
                            }
                          >
                            Remove gallery image
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}

                <label>
                  <span>Short video upload</span>
                  <input
                    type="file"
                    accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                    disabled={
                      isCreatingProduct ||
                      uploadingMediaTarget === "new-videoUrl"
                    }
                    onChange={(event) => {
                      void handleNewProductMediaUpload(
                        "videoUrl",
                        event.target.files,
                      );
                      event.currentTarget.value = "";
                    }}
                  />
                  {uploadingMediaTarget === "new-videoUrl" && (
                    <p className="admin-inline-note">
                      Uploading video... {mediaUploadProgress["new-videoUrl"] ?? 0}%
                    </p>
                  )}
                </label>

                <label>
                  <span>Stored video path</span>
                  <input
                    type="text"
                    value={newProductDraft.videoUrl}
                    disabled={isCreatingProduct}
                    placeholder="Upload a video to fill this"
                    onChange={(event) =>
                      updateNewProductDraft("videoUrl", event.target.value)
                    }
                  />
                </label>

                {(newProductMediaPreview.videoUrl ||
                  newProductDraft.videoUrl) && (
                  <div className="admin-media-preview">
                    {newProductMediaPreview.videoUrl && (
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={newProductMediaPreview.videoUrl}
                      />
                    )}
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isCreatingProduct}
                      onClick={() => void removeNewProductMedia("videoUrl")}
                    >
                      Remove video
                    </button>
                  </div>
                )}
              </fieldset>

              <fieldset className="admin-edit-options">
                <legend>Status and delivery</legend>

                <label>
                  <input
                    type="checkbox"
                    checked={newProductDraft.isActive}
                    disabled={isCreatingProduct}
                    onChange={(event) =>
                      updateNewProductDraft("isActive", event.target.checked)
                    }
                  />
                  <span>Product active</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={newProductDraft.nationwideDelivery}
                    disabled={isCreatingProduct}
                    onChange={(event) =>
                      updateNewProductDraft(
                        "nationwideDelivery",
                        event.target.checked,
                      )
                    }
                  />
                  <span>Nationwide delivery</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={newProductDraft.collectionAvailable}
                    disabled={isCreatingProduct}
                    onChange={(event) =>
                      updateNewProductDraft(
                        "collectionAvailable",
                        event.target.checked,
                      )
                    }
                  />
                  <span>Collection available</span>
                </label>
              </fieldset>

              <div className="admin-edit-variants">
                <div className="admin-variant-heading">
                  <h4>Variants</h4>
                  <span>{newProductDraft.variants.length}</span>
                </div>

                {newProductDraft.variants.map((variant, index) => {
                  const nameError =
                    createValidationMessages[
                      `variant-${variant.draftId}-name`
                    ];
                  const priceError =
                    createValidationMessages[
                      `variant-${variant.draftId}-price`
                    ];

                  return (
                    <div key={variant.draftId} className="admin-edit-variant">
                      <label>
                        <span>Variant name</span>
                        <input
                          type="text"
                          value={variant.name}
                          disabled={isCreatingProduct}
                          onChange={(event) =>
                            updateNewVariantDraft(
                              variant.draftId,
                              "name",
                              event.target.value,
                            )
                          }
                        />
                        {nameError && <p className="form-error">{nameError}</p>}
                      </label>

                      <label>
                        <span>Price in pounds</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={variant.priceInPounds}
                          disabled={isCreatingProduct}
                          onChange={(event) =>
                            updateNewVariantDraft(
                              variant.draftId,
                              "priceInPounds",
                              event.target.value,
                            )
                          }
                        />
                        {priceError && (
                          <p className="form-error">{priceError}</p>
                        )}
                      </label>

                      <label className="admin-edit-checkbox">
                        <input
                          type="checkbox"
                          checked={variant.isActive}
                          disabled={isCreatingProduct}
                          onChange={(event) =>
                            updateNewVariantDraft(
                              variant.draftId,
                              "isActive",
                              event.target.checked,
                            )
                          }
                        />
                        <span>Variant active</span>
                      </label>

                      <div className="admin-create-variant-actions">
                        <span>Sort order {index + 1}</span>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={
                            isCreatingProduct ||
                            newProductDraft.variants.length === 1
                          }
                          onClick={() =>
                            removeNewVariantDraft(variant.draftId)
                          }
                        >
                          Remove variant
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="secondary-button admin-add-variant-button"
                  disabled={isCreatingProduct}
                  onClick={addNewVariantDraft}
                >
                  Add variant
                </button>
              </div>

              <div className="admin-edit-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isCreatingProduct}
                >
                  {isCreatingProduct ? "Creating..." : "Create product"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={isCreatingProduct}
                  onClick={cancelCreateProduct}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="admin-product-grid">
            {products.map((product) => {
              const productMediaPreview =
                productMediaPreviews[product.id] ?? createEmptyMediaPreview();

              return (
              <article
                key={product.id}
                className={`admin-product-card ${
                  product.isActive ? "" : "admin-product-card-inactive"
                }`}
              >
                {productMessages[product.id] && (
                  <div
                    className={`admin-product-message admin-product-message-${productMessages[product.id].type}`}
                    role="status"
                  >
                    {productMessages[product.id].text}
                  </div>
                )}

                <div className="admin-product-top">
                  <div>
                    <p className="eyebrow">{product.category}</p>
                    <h3>{product.name}</h3>
                  </div>

                  <span
                    className={`admin-status-badge ${
                      product.isActive
                        ? "admin-status-active"
                        : "admin-status-inactive"
                    }`}
                  >
                    {product.isActive ? "Available" : "Unavailable"}
                  </span>
                </div>

                <p className="admin-product-description">
                  {product.description}
                </p>

                <div className="admin-delivery-options">
                  <span
                    className={
                      product.nationwideDelivery
                        ? "admin-option-enabled"
                        : "admin-option-disabled"
                    }
                  >
                    Nationwide
                  </span>

                  <span
                    className={
                      product.collectionAvailable
                        ? "admin-option-enabled"
                        : "admin-option-disabled"
                    }
                  >
                    Collection
                  </span>
                </div>

                <div className="admin-variant-list">
                  <div className="admin-variant-heading">
                    <h4>Variants</h4>
                    <span>{product.variants.length}</span>
                  </div>

                  {product.variants.length === 0 ? (
                    <p>No variants added.</p>
                  ) : (
                    product.variants.map((variant) => (
                      <div key={variant.id} className="admin-variant-row">
                        <div>
                          <span>{variant.name}</span>
                          <small>
                            {variant.isActive ? "Active" : "Inactive"}
                          </small>
                        </div>

                        <strong>
                          £{(variant.priceInPence / 100).toFixed(2)}
                        </strong>
                      </div>
                    ))
                  )}
                </div>

                <div className="admin-product-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      savingProductId === product.id ||
                      deletingProductId === product.id
                    }
                    onClick={() => startEditingProduct(product)}
                  >
                    Edit product
                  </button>

                  <button
                    type="button"
                    className={
                      product.isActive
                        ? "secondary-button"
                        : "primary-button"
                    }
                    disabled={
                      updatingProductId === product.id ||
                      deletingProductId === product.id
                    }
                    onClick={() => void toggleProductAvailability(product)}
                  >
                    {updatingProductId === product.id
                      ? "Updating..."
                      : product.isActive
                        ? "Disable product"
                        : "Enable product"}
                  </button>
                </div>

                <div className="admin-danger-zone">
                  <button
                    type="button"
                    className="destructive-button"
                    disabled={
                      editingProductId === product.id ||
                      isCreatingProduct ||
                      savingProductId === product.id ||
                      updatingProductId === product.id ||
                      deletingProductId === product.id
                    }
                    onClick={() => openDeleteConfirmation(product)}
                  >
                    Delete product
                  </button>
                </div>

                {pendingDeleteProduct?.id === product.id && (
                  <section
                    className="admin-delete-panel"
                    role="dialog"
                    aria-labelledby={`delete-product-${product.id}`}
                  >
                    <div className="admin-delete-heading">
                      <div>
                        <p className="eyebrow">Permanent delete</p>
                        <h4 id={`delete-product-${product.id}`}>
                          Delete {pendingDeleteProduct.name}
                        </h4>
                      </div>

                      {deletingProductId === product.id && (
                        <span>Deleting...</span>
                      )}
                    </div>

                    <p className="admin-delete-warning">
                      This permanently deletes the product and its{" "}
                      {pendingDeleteProduct.variants.length} variant
                      {pendingDeleteProduct.variants.length === 1 ? "" : "s"}.
                      This cannot be undone.
                    </p>

                    {deleteError && (
                      <div className="validation-summary" role="alert">
                        <p>{deleteError}</p>
                      </div>
                    )}

                    <label className="admin-delete-confirmation">
                      <span>
                        Type "{pendingDeleteProduct.name}" to confirm
                      </span>
                      <input
                        ref={deleteConfirmationInputRef}
                        type="text"
                        value={deleteConfirmationValue}
                        disabled={deletingProductId === product.id}
                        onChange={(event) =>
                          setDeleteConfirmationValue(event.target.value)
                        }
                      />
                    </label>

                    <div className="admin-delete-actions">
                      <button
                        type="button"
                        className="destructive-button"
                        disabled={
                          deletingProductId === product.id ||
                          deleteConfirmationValue.trim() !==
                            pendingDeleteProduct.name
                        }
                        onClick={() =>
                          void deleteProductPermanently(pendingDeleteProduct)
                        }
                      >
                        {deletingProductId === product.id
                          ? "Deleting..."
                          : retryProductDeleteOnly
                            ? "Retry product delete"
                            : "Permanently delete"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={deletingProductId === product.id}
                        onClick={cancelDeleteConfirmation}
                      >
                        Cancel
                      </button>
                    </div>
                  </section>
                )}

                {editingProductId === product.id && productDraft && (
                  <form
                    className="admin-edit-panel"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveProductChanges(product);
                    }}
                  >
                    <div className="admin-edit-heading">
                      <div>
                        <p className="eyebrow">Editing</p>
                        <h4>{product.name}</h4>
                      </div>

                      {savingProductId === product.id && (
                        <span>Saving...</span>
                      )}
                    </div>

                    {validationMessages.length > 0 && (
                      <div className="validation-summary" role="alert">
                        {validationMessages.map((message) => (
                          <p key={message}>{message}</p>
                        ))}
                      </div>
                    )}

                    <div className="admin-edit-grid">
                      <label>
                        <span>Product name</span>
                        <input
                          type="text"
                          value={productDraft.name}
                          disabled={savingProductId === product.id}
                          onChange={(event) =>
                            updateProductDraft("name", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        <span>Category</span>
                        <input
                          type="text"
                          value={productDraft.category}
                          disabled={savingProductId === product.id}
                          onChange={(event) =>
                            updateProductDraft("category", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        <span>Shop label</span>
                        <select
                          value={productDraft.merchandisingLabel}
                          disabled={savingProductId === product.id}
                          onChange={(event) =>
                            updateProductDraft(
                              "merchandisingLabel",
                              event.target.value,
                            )
                          }
                        >
                          <option value="">None</option>
                          <option value="Best Seller">Best Seller</option>
                          <option value="New Drop">New Drop</option>
                        </select>
                      </label>

                      <label className="admin-edit-wide">
                        <span>Description</span>
                        <textarea
                          value={productDraft.description}
                          disabled={savingProductId === product.id}
                          rows={3}
                          onChange={(event) =>
                            updateProductDraft(
                              "description",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    <fieldset className="admin-edit-options admin-media-options">
                      <legend>Product media</legend>

                      <label>
                        <span>Main image upload</span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          disabled={
                            savingProductId === product.id ||
                            uploadingMediaTarget === `${product.id}-imageKey`
                          }
                          onChange={(event) => {
                            void handleProductMediaUpload(
                              product,
                              "imageKey",
                              event.target.files,
                            );
                            event.currentTarget.value = "";
                          }}
                        />
                        {uploadingMediaTarget === `${product.id}-imageKey` && (
                          <p className="admin-inline-note">
                            Uploading image...{" "}
                            {mediaUploadProgress[`${product.id}-imageKey`] ?? 0}
                            %
                          </p>
                        )}
                      </label>

                      <label>
                        <span>Stored main image path</span>
                        <input
                          type="text"
                          value={productDraft.imageKey}
                          disabled={savingProductId === product.id}
                          placeholder="Upload an image to fill this"
                          onChange={(event) =>
                            updateProductDraft("imageKey", event.target.value)
                          }
                        />
                      </label>

                      {(productMediaPreview.imageKey ||
                        productDraft.imageKey) && (
                        <div className="admin-media-preview">
                          {productMediaPreview.imageKey && (
                            <img
                              src={productMediaPreview.imageKey}
                              alt="Main product upload preview"
                            />
                          )}
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={savingProductId === product.id}
                            onClick={() =>
                              void removeProductMedia(product, "imageKey")
                            }
                          >
                            Remove main image
                          </button>
                        </div>
                      )}

                      <label>
                        <span>Image alt text</span>
                        <input
                          type="text"
                          value={productDraft.imageAltText}
                          disabled={savingProductId === product.id}
                          placeholder="Describe the product photo"
                          onChange={(event) =>
                            updateProductDraft(
                              "imageAltText",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>Gallery image uploads</span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          multiple
                          disabled={
                            savingProductId === product.id ||
                            uploadingMediaTarget ===
                              `${product.id}-galleryImageUrls`
                          }
                          onChange={(event) => {
                            void handleProductMediaUpload(
                              product,
                              "galleryImageUrls",
                              event.target.files,
                            );
                            event.currentTarget.value = "";
                          }}
                        />
                        {uploadingMediaTarget ===
                          `${product.id}-galleryImageUrls` && (
                          <p className="admin-inline-note">
                            Uploading gallery...{" "}
                            {mediaUploadProgress[
                              `${product.id}-galleryImageUrls`
                            ] ?? 0}
                            %
                          </p>
                        )}
                      </label>

                      <label>
                        <span>Stored gallery image paths</span>
                        <textarea
                          value={productDraft.galleryImageUrls}
                          disabled={savingProductId === product.id}
                          rows={4}
                          placeholder="Upload gallery images to fill this"
                          onChange={(event) =>
                            updateProductDraft(
                              "galleryImageUrls",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      {(productMediaPreview.galleryImageUrls.length > 0 ||
                        productDraft.galleryImageUrls) && (
                        <div className="admin-media-preview-grid">
                          {parseStoredMediaPaths(
                            productDraft.galleryImageUrls,
                          ).map((path, index) => (
                            <div
                              key={`${path}-${index}`}
                              className="admin-media-preview"
                            >
                              {productMediaPreview.galleryImageUrls[index] && (
                                <img
                                  src={
                                    productMediaPreview.galleryImageUrls[index]
                                  }
                                  alt={`Gallery upload preview ${index + 1}`}
                                />
                              )}
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={savingProductId === product.id}
                                onClick={() =>
                                  void removeProductMedia(
                                    product,
                                    "galleryImageUrls",
                                    index,
                                  )
                                }
                              >
                                Remove gallery image
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <label>
                        <span>Short video upload</span>
                        <input
                          type="file"
                          accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                          disabled={
                            savingProductId === product.id ||
                            uploadingMediaTarget === `${product.id}-videoUrl`
                          }
                          onChange={(event) => {
                            void handleProductMediaUpload(
                              product,
                              "videoUrl",
                              event.target.files,
                            );
                            event.currentTarget.value = "";
                          }}
                        />
                        {uploadingMediaTarget === `${product.id}-videoUrl` && (
                          <p className="admin-inline-note">
                            Uploading video...{" "}
                            {mediaUploadProgress[`${product.id}-videoUrl`] ?? 0}
                            %
                          </p>
                        )}
                      </label>

                      <label>
                        <span>Stored video path</span>
                        <input
                          type="text"
                          value={productDraft.videoUrl}
                          disabled={savingProductId === product.id}
                          placeholder="Upload a video to fill this"
                          onChange={(event) =>
                            updateProductDraft("videoUrl", event.target.value)
                          }
                        />
                      </label>

                      {(productMediaPreview.videoUrl ||
                        productDraft.videoUrl) && (
                        <div className="admin-media-preview">
                          {productMediaPreview.videoUrl && (
                            <video
                              controls
                              playsInline
                              preload="metadata"
                              src={productMediaPreview.videoUrl}
                            />
                          )}
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={savingProductId === product.id}
                            onClick={() =>
                              void removeProductMedia(product, "videoUrl")
                            }
                          >
                            Remove video
                          </button>
                        </div>
                      )}
                    </fieldset>

                    <fieldset className="admin-edit-options">
                      <legend>Delivery options</legend>

                      <label>
                        <input
                          type="checkbox"
                          checked={productDraft.nationwideDelivery}
                          disabled={savingProductId === product.id}
                          onChange={(event) =>
                            updateProductDraft(
                              "nationwideDelivery",
                              event.target.checked,
                            )
                          }
                        />
                        <span>Nationwide delivery</span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          checked={productDraft.collectionAvailable}
                          disabled={savingProductId === product.id}
                          onChange={(event) =>
                            updateProductDraft(
                              "collectionAvailable",
                              event.target.checked,
                            )
                          }
                        />
                        <span>Collection available</span>
                      </label>
                    </fieldset>

                    <div className="admin-edit-variants">
                      <div className="admin-variant-heading">
                        <h4>Variants</h4>
                        <span>{productDraft.variants.length}</span>
                      </div>

                      {productDraft.variants.map((variant) => (
                        <div key={variant.id} className="admin-edit-variant">
                          <label>
                            <span>Variant name</span>
                            <input
                              type="text"
                              value={variant.name}
                              disabled={savingProductId === product.id}
                              onChange={(event) =>
                                updateVariantDraft(
                                  variant.id,
                                  "name",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>Price in pounds</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={variant.priceInPounds}
                              disabled={savingProductId === product.id}
                              onChange={(event) =>
                                updateVariantDraft(
                                  variant.id,
                                  "priceInPounds",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <label className="admin-edit-checkbox">
                            <input
                              type="checkbox"
                              checked={variant.isActive}
                              disabled={savingProductId === product.id}
                              onChange={(event) =>
                                updateVariantDraft(
                                  variant.id,
                                  "isActive",
                                  event.target.checked,
                                )
                              }
                            />
                            <span>Variant active</span>
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="admin-edit-actions">
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={savingProductId === product.id}
                      >
                        {savingProductId === product.id
                          ? "Saving..."
                          : "Save changes"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={savingProductId === product.id}
                        onClick={cancelEditingProduct}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </article>
              );
            })}
          </div>
        </section>
      )}

      {activeSection === "orders" && <AdminOrdersPanel />}
    </main>
  );
}

export default AdminPage;
