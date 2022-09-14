import type { Linter } from "eslint";

const config: Linter.Config = {
  rules: {
    "functional/no-let": "error",
    "functional/immutable-data": "error",
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      rules: {
        "functional/no-method-signature": "warn",
        "functional/prefer-immutable-parameter-types": "error",
        "functional/prefer-readonly-type": "error",
        "functional/type-declaration-immutability": "error",
      },
    },
  ],
};

export default config;
