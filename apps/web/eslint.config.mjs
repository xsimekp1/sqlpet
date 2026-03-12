import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    name: "no-empty-select-item-value",
    meta: {
      type: "problem",
      docs: {
        description: "Disallow Select.Item with empty string value",
        category: "Best Practices",
        recommended: true,
      },
      messages: {
        noEmptyValue: "Select.Item must not have an empty string value. Use a non-empty placeholder like 'none' or 'empty' instead.",
      },
    },
    create(context) {
      return {
        JSXAttribute(node) {
          const parent = node.parent;
          if (!parent || parent.type !== "JSXElement") return;
          if (parent.name.name !== "SelectItem") return;
          if (node.name.name !== "value") return;
          
          const value = node.value;
          if (!value) return;
          
          if (value.type === "Literal" && value.value === "") {
            context.report({
              node,
              messageId: "noEmptyValue",
            });
          }
          if (value.type === "JSXExpressionContainer") {
            const expr = value.expression;
            if (expr.type === "Literal" && expr.value === "") {
              context.report({
                node,
                messageId: "noEmptyValue",
              });
            }
          }
        },
      };
    },
  },
];

export default eslintConfig;
