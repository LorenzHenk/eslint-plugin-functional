import dedent from "dedent";

import type { ValidTestCase } from "~/tests/helpers/util";

const tests: ValidTestCase[] = [
  {
    // No typedef for `f` therefore no error (when not assuming types).
    code: `const foo = x => f(x);`,
    optionsSet: [[]],
  },
  // Default parameters.
  {
    code: dedent`
      function f(x, y = 10) {}
      const foo = x => f(x);
    `,
    optionsSet: [[]],
  },
];

export default tests;
