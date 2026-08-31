# Windows example-suite fixture copy remediation

The P1-O06 scope and Authority amendment post-merge quality run on protected main `4d0aedd2a9b696e1ebea8b49ec60b487449583c1` exposed a Windows-only timeout in `tests/contract/example-suite.test.mjs`. The failing test creates three isolated Contract repositories. Each isolation copied package-local `node_modules` and generated `dist` directories even though neither is an authority input to the fixture mutation or Contract loader.

The remediation keeps the existing timeout and all assertions unchanged. The shared Contract test helper now excludes only generated `node_modules` and `dist` path segments while copying repository authority into the temporary fixture. Schema, inventory, registry, examples, runtime validation and failure semantics remain unchanged.

This is P1-O02 test-infrastructure remediation under the existing `tests/contract/**` scope. It does not alter Contract authority, accepted ADRs, production Runtime behavior, workflow definitions or the unique required `verify` producer. Independent immutable-head verification, exact merge and protected-main post-merge qualification remain required.
