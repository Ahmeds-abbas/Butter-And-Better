import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "butterAndBetterProductMedia",
  isDefault: true,
  access: (allow) => ({
    "product-images/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read"]),
      allow.groups(["Admin"]).to(["read", "write", "delete"]),
    ],
    "product-videos/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read"]),
      allow.groups(["Admin"]).to(["read", "write", "delete"]),
    ],
  }),
});
