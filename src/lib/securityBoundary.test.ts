import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readTypeScriptFiles(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return readTypeScriptFiles(path);
      }

      return /\.tsx?$/.test(entry.name) ? readFileSync(path, "utf8") : "";
    })
    .join("\n");
}

test("public clients cannot create checkout or loyalty records directly", () => {
  const dataSchema = readFileSync("amplify/data/resource.ts", "utf8");
  const frontendSource = readTypeScriptFiles("src");

  assert.doesNotMatch(dataSchema, /allow\.guest\(\)\.to\(\["create"\]\)/);
  assert.doesNotMatch(
    dataSchema,
    /allow\.owner\(\)\.to\(\["create", "read"\]\)/,
  );
  assert.doesNotMatch(frontendSource, /models\.Order\.create\(/);
  assert.doesNotMatch(frontendSource, /models\.OrderItem\.create\(/);
  assert.doesNotMatch(frontendSource, /models\.CustomerProfile\.create\(/);
});
