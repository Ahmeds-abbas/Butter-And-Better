import { useCallback, useEffect, useMemo, useState } from "react";
import { dataClient } from "../lib/amplifyClient";

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
  description: string;
  imageKey: string;
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
  description: string;
  nationwideDelivery: boolean;
  manchesterDelivery: boolean;
  collectionAvailable: boolean;
  variants: VariantDraft[];
};

type ProductMessage = {
  type: "success" | "error";
  text: string;
};

type NewVariantDraft = {
  draftId: string;
  name: string;
  priceInPounds: string;
  isActive: boolean;
};

type NewProductDraft = {
  name: string;
  category: string;
  description: string;
  isActive: boolean;
  nationwideDelivery: boolean;
  manchesterDelivery: boolean;
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

function createDraftFromProduct(product: AdminProduct): ProductDraft {
  return {
    name: product.name,
    category: product.category,
    description: product.description,
    nationwideDelivery: product.nationwideDelivery,
    manchesterDelivery: product.manchesterDelivery,
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
    name: "",
    category: "",
    description: "",
    isActive: true,
    nationwideDelivery: true,
    manchesterDelivery: true,
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
            description: product.description ?? "",
            imageKey: product.imageKey ?? "",
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
        description: product.description,
        imageKey: product.imageKey,
        isActive: nextIsActive,
        nationwideDelivery: product.nationwideDelivery,
        manchesterDelivery: product.manchesterDelivery,
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
    setEditingProductId(product.id);
    setProductDraft(createDraftFromProduct(product));
    setValidationMessages([]);
    setProductMessages((currentMessages) =>
      removeProductMessage(currentMessages, product.id),
    );
  }

  function cancelEditingProduct() {
    setEditingProductId(null);
    setProductDraft(null);
    setValidationMessages([]);
  }

  function openCreatePanel() {
    setEditingProductId(null);
    setProductDraft(null);
    setValidationMessages([]);
    setIsCreatePanelOpen(true);
    setCreateMessage(null);
    setCreateValidationMessages({});
  }

  function cancelCreateProduct() {
    setIsCreatePanelOpen(false);
    setNewProductDraft(createBlankProductDraft());
    setCreateValidationMessages({});
    setCreateMessage(null);
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
        description: productDraft.description.trim(),
        imageKey: product.imageKey,
        isActive: product.isActive,
        nationwideDelivery: productDraft.nationwideDelivery,
        manchesterDelivery: productDraft.manchesterDelivery,
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
        description: productDraft.description.trim(),
        nationwideDelivery: productDraft.nationwideDelivery,
        manchesterDelivery: productDraft.manchesterDelivery,
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

  async function createProduct() {
    const messages = validateNewProductDraft(newProductDraft);

    if (Object.keys(messages).length > 0) {
      setCreateValidationMessages(messages);
      return;
    }

    const productId = createId("product");
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
        imageKey: "",
        isActive: newProductDraft.isActive,
        nationwideDelivery: newProductDraft.nationwideDelivery,
        manchesterDelivery: newProductDraft.manchesterDelivery,
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
        description: newProductDraft.description.trim(),
        imageKey: "",
        isActive: newProductDraft.isActive,
        nationwideDelivery: newProductDraft.nationwideDelivery,
        manchesterDelivery: newProductDraft.manchesterDelivery,
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
      setIsCreatePanelOpen(false);
    } catch (error) {
      console.error("Failed to create product:", error);
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
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh catalogue"}
        </button>
      </section>

      {!isLoading && !loadError && (
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

      {isLoading && (
        <section className="admin-state-message" aria-live="polite">
          <p>Loading products...</p>
        </section>
      )}

      {!isLoading && loadError && (
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

      {!isLoading && !loadError && actionError && (
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

      {!isLoading && !loadError && (
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
                    checked={newProductDraft.manchesterDelivery}
                    disabled={isCreatingProduct}
                    onChange={(event) =>
                      updateNewProductDraft(
                        "manchesterDelivery",
                        event.target.checked,
                      )
                    }
                  />
                  <span>Manchester delivery</span>
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
            {products.map((product) => (
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
                      product.manchesterDelivery
                        ? "admin-option-enabled"
                        : "admin-option-disabled"
                    }
                  >
                    Manchester
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
                    disabled={savingProductId === product.id}
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
                    disabled={updatingProductId === product.id}
                    onClick={() => void toggleProductAvailability(product)}
                  >
                    {updatingProductId === product.id
                      ? "Updating..."
                      : product.isActive
                        ? "Disable product"
                        : "Enable product"}
                  </button>
                </div>

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
                          checked={productDraft.manchesterDelivery}
                          disabled={savingProductId === product.id}
                          onChange={(event) =>
                            updateProductDraft(
                              "manchesterDelivery",
                              event.target.checked,
                            )
                          }
                        />
                        <span>Manchester delivery</span>
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
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default AdminPage;
