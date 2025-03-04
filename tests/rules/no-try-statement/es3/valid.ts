import type { ValidTestCase } from "~/tests/helpers/util";

const tests: ValidTestCase[] = [
  {
    code: `var x = 0;`,
    optionsSet: [[]],
  },
  {
    code: `try {} catch (e) {}`,
    optionsSet: [[{ allowCatch: true }]],
  },
  {
    code: `try {} finally {}`,
    optionsSet: [[{ allowFinally: true }]],
  },
];

export default tests;
