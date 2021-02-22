/// <reference types="node" />
/// <reference types="jest" />

declare module 'jsonschema/lib/helpers' {
  function deepCompareStrict(actual: any, expected: any): boolean;
}
