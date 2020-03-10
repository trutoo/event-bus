/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';
const Q = require('q');
const compareFunc = require('compare-func');
const readFile = Q.denodeify(require('fs').readFile);
const resolve = require('path').resolve;

const parserOpts = {
  headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/,
  headerCorrespondence: ['type', 'scope', 'subject'],
  noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
  revertPattern: /^revert:\s([\s\S]*?)\s*This reverts commit (\w*)\./,
  revertCorrespondence: ['header', 'hash'],
};

const recommendedBumpOpts = {
  parserOpts,

  whatBump: commits => {
    let level = 2;
    let breakings = 0;
    let features = 0;

    commits.forEach(commit => {
      if (commit.notes.length > 0) {
        breakings += commit.notes.length;
        level = 0;
      } else if (commit.type === 'feat') {
        features += 1;
        if (level === 2) {
          level = 1;
        }
      }
    });

    return {
      level: level,
      reason:
        breakings === 1
          ? `There is ${breakings} BREAKING CHANGE and ${features} features`
          : `There are ${breakings} BREAKING CHANGES and ${features} features`,
    };
  },
};

function getWriterOpts() {
  return {
    transform: (commit, context) => {
      let discard = true;
      const issues = [];

      commit.notes.forEach(note => {
        note.title = 'BREAKING CHANGES';
        discard = false;
      });

      if (commit.type === 'feat') {
        commit.type = 'Features';
      } else if (commit.type === 'fix') {
        commit.type = 'Bug Fixes';
      } else if (commit.type === 'perf') {
        commit.type = 'Performance Improvements';
      } else if (commit.type === 'chore' && commit.scope === 'deps') {
        commit.type = 'Dependency Updates';
        commit.scope = '';
      } else if (discard) {
        // Move up earlier to filter below
        return;
      } else if (commit.type === 'k8s') {
        commit.type = 'Kubernetes';
      } else if (commit.type === 'revert') {
        commit.type = 'Reverts';
      } else if (commit.type === 'docs') {
        commit.type = 'Documentation';
      } else if (commit.type === 'style') {
        commit.type = 'Styles';
      } else if (commit.type === 'refactor') {
        commit.type = 'Code Refactoring';
      } else if (commit.type === 'test') {
        commit.type = 'Tests';
      } else if (commit.type === 'build') {
        commit.type = 'Build System';
      } else if (commit.type === 'ci') {
        commit.type = 'Continuous Integration';
      } else if (commit.type === 'chore') {
        commit.type = 'Chore';
      }

      if (commit.scope === '*') {
        commit.scope = '';
      }

      if (typeof commit.hash === 'string') {
        commit.shortHash = commit.hash.substring(0, 7);
      }

      if (typeof commit.subject === 'string') {
        let url;
        if (context.packageData.bugs)
          url = typeof context.packageData.bugs == 'object' ? context.packageData.bugs.url : context.packageData.bugs;
        else if (context.repository) url = `${context.host}/${context.owner}/${context.repository}/issues/`;
        else url = context.repoUrl;
        if (!url.endsWith('/')) url += '/';

        if (url) {
          // Issue URLs.
          commit.subject = commit.subject.replace(/#(\d+)/g, (_, issue) => {
            issues.push(issue);
            return `[#${issue}](${url}${issue})`;
          });
        }

        if (context.host) {
          // User URLs.
          commit.subject = commit.subject.replace(/\B@([\w0-9](?:-?[\w0-9/]){0,38})/g, (_, username) => {
            if (username.includes('/')) {
              return `@${username}`;
            }

            return `[@${username}](${context.host}/${username})`;
          });
        }
      }

      // remove references that already appear in the subject
      commit.references = commit.references.filter(reference => {
        if (issues.indexOf(reference.issue) === -1) {
          return true;
        }

        return false;
      });

      return commit;
    },
    groupBy: 'type',
    commitGroupsSort: 'title',
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    notesSort: compareFunc,
  };
}

const templates = resolve(process.cwd(), 'node_modules', 'conventional-changelog-angular', 'templates');

module.exports = Q.all([
  readFile(resolve(templates, 'template.hbs'), 'utf-8'),
  readFile(resolve(templates, 'header.hbs'), 'utf-8'),
  readFile(resolve(templates, 'commit.hbs'), 'utf-8'),
  readFile(resolve(templates, 'footer.hbs'), 'utf-8'),
]).spread((template, header, commit, footer) => {
  const writerOpts = getWriterOpts();

  writerOpts.mainTemplate = template;
  writerOpts.headerPartial = header;
  writerOpts.commitPartial = commit;
  writerOpts.footerPartial = footer;

  return { recommendedBumpOpts, parserOpts, writerOpts };
});
