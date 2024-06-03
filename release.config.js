export default {
  dryRun: false,
  ci: false,
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        config: './tools/changelog.js',
        releaseRules: [{ type: 'chore', scope: 'deps', release: 'patch' }],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        config: './tools/changelog.js',
      },
    ],
    '@semantic-release/changelog',
    [
      '@semantic-release/npm',
      {
        tarballDir: 'dist',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [{ path: 'dist/*.tgz', label: 'Distribution package' }],
      },
    ],
    [
      '@semantic-release/exec',
      {
        successCmd: 'echo "VERSION=${nextRelease.version}" >> $GITHUB_ENV',
      },
    ],
  ],
};
