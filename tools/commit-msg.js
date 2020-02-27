'use strict';
const commit = require('fs').readFileSync(process.env.HUSKY_GIT_PARAMS, 'utf8');

if (/^(merge|chore\((release|deps)\): .+)/i.test(commit)) {
  process.exit(0);
}

if (!/^(feat|fix|perf|k8s|revert|docs|style|refactor|test|build|ci|)(\(.+?\))?: .+/.test(commit)) {
  console.warn(
    'Git commit message should lead with a type, followed by an optional scope in parentheses, then a colon, a space, and a message.',
  );

  console.warn(
    'Valid types are feat|fix|perf|k8s|revert|docs|style|refactor|test|build|ci and special merge|chore(deps)|chore(release).',
  );

  console.warn('Features, fixes and performance changes should include a task id if applicable.');
  console.warn('Example: "feat(typeahead): #1337 added keyboard interaction".');

  console.warn('All other commits follow the standard semantics.');
  console.warn('Example: "ci(changelog): build step added for conventional changelogs".');

  process.exit(1);
}
