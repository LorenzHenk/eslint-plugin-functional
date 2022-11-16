import type { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { deepmerge } from "deepmerge-ts";
import { Immutability } from "is-immutable-type";
import type { JSONSchema4 } from "json-schema";

import type { IgnoreClassesOption } from "~/common/ignore-options";
import {
  ignoreClassesOptionSchema,
  shouldIgnoreClasses,
  shouldIgnoreInFunction,
  shouldIgnorePattern,
} from "~/common/ignore-options";
import type { ESFunctionType } from "~/util/node-types";
import type { RuleResult } from "~/util/rule";
import {
  createRule,
  getReturnTypesOfFunction,
  getTypeImmutabilityOfNode,
  getTypeImmutabilityOfType,
  isImplementationOfOverload,
} from "~/util/rule";
import {
  hasID,
  isDefined,
  isFunctionLike,
  isIdentifier,
  isPropertyDefinition,
  isTSParameterProperty,
  isTSTypePredicate,
} from "~/util/typeguard";

/**
 * The name of this rule.
 */
export const name = "prefer-immutable-types" as const;

type RawEnforcement =
  | Exclude<Immutability | keyof typeof Immutability, "Unknown" | "Mutable">
  | "None"
  | false;

type Option = IgnoreClassesOption & {
  enforcement: RawEnforcement;
  ignoreInferredTypes: boolean;
  ignoreNamePattern?: string[] | string;
  ignoreTypePattern?: string[] | string;
};

type FixerConfigRaw = {
  pattern: string;
  replace: string;
};

type FixerConfig = {
  pattern: RegExp;
  replace: string;
};

/**
 * The options this rule can take.
 */
type Options = [
  Option & {
    parameters?: Partial<Option> | RawEnforcement;
    returnTypes?: Partial<Option> | RawEnforcement;
    variables?:
      | Partial<
          Option & {
            ignoreInFunctions?: boolean;
          }
        >
      | RawEnforcement;
    fixer:
      | {
          ReadonlyShallow: FixerConfigRaw | FixerConfigRaw[] | false;
          ReadonlyDeep: FixerConfigRaw | FixerConfigRaw[] | false;
          Immutable: FixerConfigRaw | FixerConfigRaw[] | false;
        }
      | false;
  }
];

/**
 * The enum options for the level of enforcement.
 */
const enforcementEnumOptions = [
  ...Object.values(Immutability).filter(
    (i) =>
      i !== Immutability.Unknown &&
      i !== Immutability[Immutability.Unknown] &&
      i !== Immutability.Mutable &&
      i !== Immutability[Immutability.Mutable]
  ),
  "None",
  false,
];

/**
 * The non-shorthand schema for each option.
 */
const optionExpandedSchema: JSONSchema4 = deepmerge(ignoreClassesOptionSchema, {
  enforcement: {
    type: ["string", "number", "boolean"],
    enum: enforcementEnumOptions,
  },
  ignoreInferredTypes: {
    type: "boolean",
  },
  ignoreNamePattern: {
    type: ["string", "array"],
    items: {
      type: "string",
    },
  },
  ignoreTypePattern: {
    type: ["string", "array"],
    items: {
      type: "string",
    },
  },
});

/**
 * The schema for each option.
 */
const optionSchema: JSONSchema4 = {
  oneOf: [
    {
      type: "object",
      properties: optionExpandedSchema,
      additionalProperties: false,
    },
    {
      type: ["string", "number", "boolean"],
      enum: enforcementEnumOptions,
    },
  ],
};

/**
 * The schema for each fixer config.
 */
const fixerSchema: JSONSchema4 = {
  oneOf: [
    {
      type: "boolean",
      enum: [false],
    },
    {
      type: "object",
      properties: {
        pattern: { type: "string" },
        replace: { type: "string" },
      },
      additionalProperties: false,
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          replace: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  ],
};

/**
 * The schema for the rule options.
 */
const schema: JSONSchema4 = [
  {
    type: "object",
    properties: deepmerge(optionExpandedSchema, {
      parameters: optionSchema,
      returnTypes: optionSchema,
      variables: {
        oneOf: [
          {
            type: "object",
            properties: deepmerge(optionExpandedSchema, {
              ignoreInFunctions: {
                type: "boolean",
              },
            }),
            additionalProperties: false,
          },
          {
            type: ["string", "number", "boolean"],
            enum: enforcementEnumOptions,
          },
        ],
      },
      fixer: {
        oneOf: [
          {
            type: "boolean",
            enum: [false],
          },
          {
            type: "object",
            properties: {
              ReadonlyShallow: fixerSchema,
              ReadonlyDeep: fixerSchema,
              Immutable: fixerSchema,
            },
            additionalProperties: false,
          },
        ],
      },
    }),
    additionalProperties: false,
  },
];

/**
 * The default options for the rule.
 */
const defaultOptions: Options = [
  {
    enforcement: Immutability.Immutable,
    ignoreInferredTypes: false,
    ignoreClasses: false,
    fixer: {
      ReadonlyShallow: [
        {
          pattern: "^(Array|Map|Set)<(.+)>$",
          replace: "Readonly$1<$2>",
        },
        {
          pattern: "^(.+)$",
          replace: "Readonly<$1>",
        },
      ],
      ReadonlyDeep: false,
      Immutable: false,
    },
  },
];

/**
 * Get a fixer that uses the user config.
 */
function getConfiuredFixer<T extends TSESTree.Node>(
  node: T,
  context: TSESLint.RuleContext<keyof typeof errorMessages, Options>,
  configs: FixerConfig[]
): NonNullable<Descriptor["fix"]> | null {
  const text = context.getSourceCode().getText(node).replace(/\s+/gmu, " ");
  const config = configs.find((c) => c.pattern.test(text));
  if (config === undefined) {
    return null;
  }
  return (fixer) =>
    fixer.replaceText(node, text.replace(config.pattern, config.replace));
}

/**
 * The possible error messages.
 */
const errorMessages = {
  parameter:
    'Parameter should have an immutability of at least "{{ expected }}" (actual: "{{ actual }}").',
  returnType:
    'Return type should have an immutability of at least "{{ expected }}" (actual: "{{ actual }}").',
  variable:
    'Variable should have an immutability of at least "{{ expected }}" (actual: "{{ actual }}").',
  propertyImmutability:
    'Property should have an immutability of at least "{{ expected }}" (actual: "{{ actual }}").',
  propertyModifier: "Property should have a readonly modifier.",
} as const;

/**
 * The meta data for this rule.
 */
const meta: ESLintUtils.NamedCreateRuleMeta<keyof typeof errorMessages> = {
  type: "suggestion",
  docs: {
    description:
      "Require function parameters to be typed as certain immutability",
    recommended: "error",
  },
  fixable: "code",
  messages: errorMessages,
  schema,
};

type Descriptor = RuleResult<
  keyof typeof errorMessages,
  Options
>["descriptors"][number];

/**
 * Get the level of enforcement from the raw value given.
 */
function parseEnforcement(rawEnforcement: RawEnforcement) {
  return rawEnforcement === "None"
    ? false
    : typeof rawEnforcement === "string"
    ? Immutability[rawEnforcement]
    : rawEnforcement;
}

/**
 * Get the fixer config for the the given enforcement level from the raw config given.
 */
function parseFixerConfigs(
  allRawConfigs: Options[0]["fixer"],
  enforcement: Immutability
): FixerConfig[] | false {
  if (allRawConfigs === false) {
    return false;
  }
  const key = Immutability[enforcement] as keyof typeof allRawConfigs;
  const rawConfigs =
    allRawConfigs[key] ??
    (defaultOptions[0].fixer === false ? false : defaultOptions[0].fixer[key]);
  if (rawConfigs === undefined || rawConfigs === false) {
    return [];
  }
  const raws = Array.isArray(rawConfigs) ? rawConfigs : [rawConfigs];
  return raws.map((r) => ({
    ...r,
    pattern: new RegExp(r.pattern, "u"),
  }));
}

/**
 * Get the parameter type violations.
 */
function getParameterTypeViolations(
  node: ESFunctionType,
  context: TSESLint.RuleContext<keyof typeof errorMessages, Options>,
  options: Options
): Descriptor[] {
  const [optionsObject] = options;
  const { parameters: rawOption, fixer: rawFixerConfig } = optionsObject;
  const {
    enforcement: rawEnforcement,
    ignoreInferredTypes: rawIgnoreInferredTypes,
    ignoreClasses,
    ignoreNamePattern,
    ignoreTypePattern,
  } = typeof rawOption === "object"
    ? rawOption
    : {
        enforcement: rawOption,
        ignoreInferredTypes: optionsObject.ignoreInferredTypes,
        ignoreClasses: optionsObject.ignoreClasses,
        ignoreNamePattern: optionsObject.ignoreNamePattern,
        ignoreTypePattern: optionsObject.ignoreTypePattern,
      };

  const enforcement = parseEnforcement(
    rawEnforcement ?? optionsObject.enforcement
  );
  if (
    enforcement === false ||
    shouldIgnoreClasses(node, context, ignoreClasses)
  ) {
    return [];
  }

  const fixerConfigs = parseFixerConfigs(rawFixerConfig, enforcement);

  const ignoreInferredTypes =
    rawIgnoreInferredTypes ?? optionsObject.ignoreInferredTypes;

  return node.params
    .map((param): Descriptor | undefined => {
      if (shouldIgnorePattern(param, context, ignoreNamePattern)) {
        return undefined;
      }

      const parameterProperty = isTSParameterProperty(param);
      if (parameterProperty && param.readonly !== true) {
        return {
          node: param,
          messageId: "propertyModifier",
          fix:
            rawFixerConfig === false
              ? null
              : (fixer) => fixer.insertTextBefore(param.parameter, "readonly "),
        };
      }

      const actualParam = parameterProperty ? param.parameter : param;

      if (
        // inferred types
        (ignoreInferredTypes && actualParam.typeAnnotation === undefined) ||
        // ignored
        (actualParam.typeAnnotation !== undefined &&
          shouldIgnorePattern(
            actualParam.typeAnnotation,
            context,
            ignoreTypePattern
          )) ||
        // type guard
        (node.returnType !== undefined &&
          isTSTypePredicate(node.returnType.typeAnnotation) &&
          isIdentifier(node.returnType.typeAnnotation.parameterName) &&
          isIdentifier(actualParam) &&
          actualParam.name ===
            node.returnType.typeAnnotation.parameterName.name)
      ) {
        return undefined;
      }

      const immutability = getTypeImmutabilityOfNode(
        actualParam,
        context,
        enforcement
      );

      if (immutability >= enforcement) {
        return undefined;
      }

      const fix =
        fixerConfigs === false || actualParam.typeAnnotation === undefined
          ? null
          : getConfiuredFixer(
              actualParam.typeAnnotation.typeAnnotation,
              context,
              fixerConfigs
            );

      return {
        node: actualParam,
        messageId: "parameter",
        data: {
          actual: Immutability[immutability],
          expected: Immutability[enforcement],
        },
        fix,
      };
    })
    .filter(isDefined);
}

/**
 * Get the return type violations.
 */
function getReturnTypeViolations(
  node: ESFunctionType,
  context: TSESLint.RuleContext<keyof typeof errorMessages, Options>,
  options: Options
): Descriptor[] {
  const [optionsObject] = options;
  const { returnTypes: rawOption, fixer: rawFixerConfig } = optionsObject;
  const {
    enforcement: rawEnforcement,
    ignoreInferredTypes: rawIgnoreInferredTypes,
    ignoreClasses,
    ignoreNamePattern,
    ignoreTypePattern,
  } = typeof rawOption === "object"
    ? rawOption
    : {
        enforcement: rawOption,
        ignoreInferredTypes: optionsObject.ignoreInferredTypes,
        ignoreClasses: optionsObject.ignoreClasses,
        ignoreNamePattern: optionsObject.ignoreNamePattern,
        ignoreTypePattern: optionsObject.ignoreTypePattern,
      };

  const enforcement = parseEnforcement(
    rawEnforcement ?? optionsObject.enforcement
  );

  const ignoreInferredTypes =
    rawIgnoreInferredTypes ?? optionsObject.ignoreInferredTypes;

  if (
    enforcement === false ||
    (ignoreInferredTypes && node.returnType?.typeAnnotation === undefined) ||
    shouldIgnoreClasses(node, context, ignoreClasses) ||
    shouldIgnorePattern(node, context, ignoreNamePattern)
  ) {
    return [];
  }

  const fixerConfigs = parseFixerConfigs(rawFixerConfig, enforcement);

  if (
    node.returnType?.typeAnnotation !== undefined &&
    !isTSTypePredicate(node.returnType.typeAnnotation)
  ) {
    if (shouldIgnorePattern(node.returnType, context, ignoreTypePattern)) {
      return [];
    }

    const immutability = getTypeImmutabilityOfNode(
      node.returnType.typeAnnotation,
      context,
      enforcement
    );

    if (immutability >= enforcement) {
      return [];
    }

    const fix =
      fixerConfigs === false || node.returnType?.typeAnnotation === undefined
        ? null
        : getConfiuredFixer(
            node.returnType.typeAnnotation,
            context,
            fixerConfigs
          );

    return [
      {
        node: node.returnType,
        messageId: "returnType",
        data: {
          actual: Immutability[immutability],
          expected: Immutability[enforcement],
        },
        fix,
      },
    ];
  }

  if (!isFunctionLike(node)) {
    return [];
  }

  const returnTypes = getReturnTypesOfFunction(node, context);
  if (
    returnTypes === null ||
    returnTypes.length !== 1 ||
    isImplementationOfOverload(node, context)
  ) {
    return [];
  }

  const immutability = getTypeImmutabilityOfType(
    returnTypes[0],
    context,
    enforcement
  );

  if (immutability >= enforcement) {
    return [];
  }

  const fix =
    fixerConfigs === false || node.returnType?.typeAnnotation === undefined
      ? null
      : getConfiuredFixer(
          node.returnType.typeAnnotation,
          context,
          fixerConfigs
        );

  return [
    {
      node: hasID(node) && node.id !== null ? node.id : node,
      messageId: "returnType",
      data: {
        actual: Immutability[immutability],
        expected: Immutability[enforcement],
      },
      fix,
    },
  ];
}

/**
 * Check if the given function node violates this rule.
 */
function checkFunction(
  node: ESFunctionType,
  context: TSESLint.RuleContext<keyof typeof errorMessages, Options>,
  options: Options
): RuleResult<keyof typeof errorMessages, Options> {
  const descriptors = [
    ...getParameterTypeViolations(node, context, options),
    ...getReturnTypeViolations(node, context, options),
  ];

  return {
    context,
    descriptors,
  };
}

/**
 * Check if the given function node violates this rule.
 */
function checkVarible(
  node: TSESTree.VariableDeclarator | TSESTree.PropertyDefinition,
  context: TSESLint.RuleContext<keyof typeof errorMessages, Options>,
  options: Options
): RuleResult<keyof typeof errorMessages, Options> {
  const [optionsObject] = options;

  const { variables: rawOption, fixer: rawFixerConfig } = optionsObject;
  const {
    enforcement: rawEnforcement,
    ignoreInferredTypes: rawIgnoreInferredTypes,
    ignoreClasses,
    ignoreNamePattern,
    ignoreTypePattern,
    ignoreInFunctions: rawIgnoreInFunctions,
  } = typeof rawOption === "object"
    ? rawOption
    : {
        enforcement: rawOption,
        ignoreInferredTypes: optionsObject.ignoreInferredTypes,
        ignoreClasses: optionsObject.ignoreClasses,
        ignoreNamePattern: optionsObject.ignoreNamePattern,
        ignoreTypePattern: optionsObject.ignoreTypePattern,
        ignoreInFunctions: false,
      };

  const enforcement = parseEnforcement(
    rawEnforcement ?? optionsObject.enforcement
  );
  const ignoreInFunctions = rawIgnoreInFunctions ?? false;

  if (
    enforcement === false ||
    shouldIgnoreClasses(node, context, ignoreClasses) ||
    shouldIgnoreInFunction(node, context, ignoreInFunctions) ||
    shouldIgnorePattern(node, context, ignoreNamePattern)
  ) {
    return {
      context,
      descriptors: [],
    };
  }

  const isProperty = isPropertyDefinition(node);

  if (isProperty && node.readonly !== true) {
    return {
      context,
      descriptors: [
        {
          node,
          messageId: "propertyModifier",
          fix:
            rawFixerConfig === false
              ? null
              : (fixer) => fixer.insertTextBefore(node.key, "readonly "),
        },
      ],
    };
  }

  const ignoreInferredTypes =
    rawIgnoreInferredTypes ?? optionsObject.ignoreInferredTypes;
  const nodeWithTypeAnnotation = isProperty ? node : node.id;

  if (
    ignoreInferredTypes &&
    nodeWithTypeAnnotation.typeAnnotation === undefined
  ) {
    return {
      context,
      descriptors: [],
    };
  }

  if (
    nodeWithTypeAnnotation.typeAnnotation !== undefined &&
    shouldIgnorePattern(
      nodeWithTypeAnnotation.typeAnnotation,
      context,
      ignoreTypePattern
    )
  ) {
    return {
      context,
      descriptors: [],
    };
  }

  const immutability = getTypeImmutabilityOfNode(
    nodeWithTypeAnnotation,
    context,
    enforcement
  );

  if (immutability >= enforcement) {
    return {
      context,
      descriptors: [],
    };
  }

  const fixerConfigs = parseFixerConfigs(rawFixerConfig, enforcement);
  const fix =
    fixerConfigs === false ||
    nodeWithTypeAnnotation.typeAnnotation === undefined
      ? null
      : getConfiuredFixer(
          nodeWithTypeAnnotation.typeAnnotation.typeAnnotation,
          context,
          fixerConfigs
        );

  return {
    context,
    descriptors: [
      {
        node: nodeWithTypeAnnotation,
        messageId: isProperty ? "propertyImmutability" : "variable",
        data: {
          actual: Immutability[immutability],
          expected: Immutability[enforcement],
        },
        fix,
      },
    ],
  };
}

// Create the rule.
export const rule = createRule<keyof typeof errorMessages, Options>(
  name,
  meta,
  defaultOptions,
  {
    ArrowFunctionExpression: checkFunction,
    FunctionDeclaration: checkFunction,
    FunctionExpression: checkFunction,
    TSCallSignatureDeclaration: checkFunction,
    TSConstructSignatureDeclaration: checkFunction,
    TSDeclareFunction: checkFunction,
    TSEmptyBodyFunctionExpression: checkFunction,
    TSFunctionType: checkFunction,
    TSMethodSignature: checkFunction,
    PropertyDefinition: checkVarible,
    VariableDeclarator: checkVarible,
  }
);
