import dedent from "dedent";

import type { InvalidTestCase } from "~/tests/helpers/util";

const tests: ReadonlyArray<InvalidTestCase> = [
  {
    code: "function foo(arg: ReadonlySet<string>) {}",
    optionsSet: [[{ parameters: "Immutable" }]],
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 14,
      },
    ],
  },
  {
    code: "function foo(arg: ReadonlyMap<string, string>) {}",
    optionsSet: [[{ parameters: "Immutable" }]],
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 14,
      },
    ],
  },
  {
    code: "function foo(arg1: { foo: string }, arg2: { foo: number }) {}",
    optionsSet: [[{ parameters: "ReadonlyShallow" }]],
    output:
      "function foo(arg1: Readonly<{ foo: string }>, arg2: Readonly<{ foo: number }>) {}",
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 14,
      },
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 37,
      },
    ],
  },
  {
    code: "function foo(arg1: { foo: string }, arg2: { foo: number }) {}",
    optionsSet: [
      [{ parameters: "ReadonlyDeep" }],
      [{ parameters: "Immutable" }],
    ],
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 14,
      },
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 37,
      },
    ],
  },
  {
    code: dedent`
      class Foo {
        constructor(
          private readonly arg1: readonly string[],
          public readonly arg2: readonly string[],
          protected readonly arg3: readonly string[],
          readonly arg4: readonly string[],
        ) {}
      }
    `,
    optionsSet: [[{ parameters: "Immutable" }]],
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 3,
        column: 22,
      },
      {
        messageId: "parameter",
        type: "Identifier",
        line: 4,
        column: 21,
      },
      {
        messageId: "parameter",
        type: "Identifier",
        line: 5,
        column: 24,
      },
      {
        messageId: "parameter",
        type: "Identifier",
        line: 6,
        column: 14,
      },
    ],
  },
  {
    code: dedent`
      interface Foo {
        (arg: readonly string[]): void;
      }
    `,
    optionsSet: [[{ parameters: "Immutable" }]],
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 2,
        column: 4,
      },
    ],
  },
  {
    code: dedent`
      interface Foo {
        new (arg: readonly string[]): void;
      }
    `,
    optionsSet: [[{ parameters: "Immutable" }]],
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 2,
        column: 8,
      },
    ],
  },
  // Class Parameter Properties.
  {
    code: dedent`
      class Klass {
        constructor (
          public publicProp: string,
          protected protectedProp: string,
          private privateProp: string,
      ) { }
      }
    `,
    optionsSet: [[]],
    output: dedent`
      class Klass {
        constructor (
          public readonly publicProp: string,
          protected readonly protectedProp: string,
          private readonly privateProp: string,
      ) { }
      }
    `,
    errors: [
      {
        messageId: "propertyModifier",
        type: "TSParameterProperty",
        line: 3,
        column: 5,
      },
      {
        messageId: "propertyModifier",
        type: "TSParameterProperty",
        line: 4,
        column: 5,
      },
      {
        messageId: "propertyModifier",
        type: "TSParameterProperty",
        line: 5,
        column: 5,
      },
    ],
  },
  {
    code: "function foo(arg0: { foo: string | number }, arg1: { foo: string | number }): arg0 is { foo: number } {}",
    optionsSet: [[{ parameters: "ReadonlyShallow" }]],
    output:
      "function foo(arg0: { foo: string | number }, arg1: Readonly<{ foo: string | number }>): arg0 is { foo: number } {}",
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 46,
      },
    ],
  },
  {
    code: "function foo(arg0: { foo: string | number }, arg1: { foo: string | number }): arg0 is { foo: number } {}",
    optionsSet: [
      [{ parameters: "ReadonlyDeep" }],
      [{ parameters: "Immutable" }],
    ],
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 46,
      },
    ],
  },
  {
    code: "function foo(arg1: { foo: string }) {}",
    optionsSet: [
      [
        {
          parameters: "ReadonlyShallow",
          fixer: {
            ReadonlyDeep: {
              pattern: "^(.+)$",
              replace: "ReadonlyDeep<$1>",
            },
          },
        },
      ],
    ],
    output: "function foo(arg1: Readonly<{ foo: string }>) {}",
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 14,
      },
    ],
  },
  {
    code: "function foo(arg1: { foo: string }) {}",
    optionsSet: [
      [
        {
          parameters: "ReadonlyDeep",
          fixer: {
            ReadonlyDeep: {
              pattern: "^(.+)$",
              replace: "ReadonlyDeep<$1>",
            },
          },
        },
      ],
    ],
    output: "function foo(arg1: ReadonlyDeep<{ foo: string }>) {}",
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 14,
      },
    ],
  },
  {
    code: "function foo(arg1: { foo: { bar: string } }) {}",
    optionsSet: [
      [
        {
          parameters: "ReadonlyDeep",
          fixer: {
            ReadonlyDeep: {
              pattern: "^(?:Readonly<(.+)>|(.+))$",
              replace: "ReadonlyDeep<$1$2>",
            },
          },
        },
      ],
    ],
    output: "function foo(arg1: ReadonlyDeep<{ foo: { bar: string } }>) {}",
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 14,
      },
    ],
  },
  {
    code: "function foo(arg1: Readonly<{ foo: { bar: string } }>) {}",
    optionsSet: [
      [
        {
          parameters: "ReadonlyDeep",
          fixer: {
            ReadonlyDeep: {
              pattern: "^(?:Readonly<(.+)>|(.+))$",
              replace: "ReadonlyDeep<$1$2>",
            },
          },
        },
      ],
    ],
    output: "function foo(arg1: ReadonlyDeep<{ foo: { bar: string } }>) {}",
    errors: [
      {
        messageId: "parameter",
        type: "Identifier",
        line: 1,
        column: 14,
      },
    ],
  },
];

export default tests;
