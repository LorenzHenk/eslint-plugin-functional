# Readonly Type (readonly-type)

This rule enforces consistently using either `readonly` keywords or `Readonly<T>`.

## Rule Details

There are two ways to declare type literals as readonly, either by specifying that each
property of the type is readonly using the `readonly` keyword, or by wrapping the type
in `Readonly`.

This rule is designed to enforce a consistent way of doing this.

### ❌ Incorrect

<!-- eslint-skip -->

```ts
/* eslint functional/readonly-type: ["error", "keyword"] */

type Foo = Readonly<{
  bar: string;
  baz: number;
}>;

```

<!-- eslint-skip -->

```ts
/* eslint functional/readonly-type: ["error", "generic"] */

type Foo = {
  readonly bar: string;
  readonly baz: number;
};

```

### ✅ Correct

```ts
/* eslint functional/readonly-type: ["error", "keyword"] */

type Foo = {
  readonly bar: string;
  readonly baz: number;
};

type Foo2 = {
  readonly bar: string;
  baz: number
};
```

```ts
/* eslint functional/readonly-type: ["error", "generic"] */

type Foo = Readonly<{
  bar: string;
  baz: number;
}>;

// No issue as it's not fully readonly.
type Foo2 = {
  readonly bar: string;
  baz: number
};
```

## Options

This rule takes a single string option, either `generic` | `keyword`.

### Default Options

```ts
const defaults = "generic";
```

### `generic`

Enforce using `Readonly<T>` instead of marking all props as readonly.

### `keyword`

Enforce using `readonly` keyword for all props instead of wrapping with `Readonly`.
