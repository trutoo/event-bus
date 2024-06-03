'use strict';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

import compareFunc from 'compare-func';

function createParserOpts() {
  return {
    headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/,
    headerCorrespondence: ['type', 'scope', 'subject'],
    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
    revertPattern: /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w{7,40})\b/i,
    revertCorrespondence: ['header', 'hash'],
  };
}

function whatBump(commits) {
  let level = 2;
  let breakings = 0;
  let features = 0;

  commits.forEach((commit) => {
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
    level,
    reason:
      breakings === 1
        ? `There is ${breakings} BREAKING CHANGE and ${features} features`
        : `There are ${breakings} BREAKING CHANGES and ${features} features`,
  };
}

const templateDir = resolve(process.cwd(), 'node_modules', 'conventional-changelog-angular', 'src', 'templates');

export async function createWriterOpts() {
  const [template, header, commit, footer] = await Promise.all([
    readFile(resolve(templateDir, 'template.hbs'), 'utf-8'),
    readFile(resolve(templateDir, 'header.hbs'), 'utf-8'),
    readFile(resolve(templateDir, 'commit.hbs'), 'utf-8'),
    readFile(resolve(templateDir, 'footer.hbs'), 'utf-8'),
  ]);
  const writerOpts = getWriterOpts();

  writerOpts.mainTemplate = template;
  writerOpts.headerPartial = header;
  writerOpts.commitPartial = commit;
  writerOpts.footerPartial = footer;

  return writerOpts;
}

function getWriterOpts() {
  return {
    transform: (commit, context) => {
      let discard = true;
      const notes = commit.notes.map((note) => {
        discard = false;

        return {
          ...note,
          title: 'BREAKING CHANGES',
        };
      });

      let type = commit.type;

      if (commit.type === 'feat') {
        type = 'Features';
      } else if (commit.type === 'fix') {
        type = 'Bug Fixes';
      } else if (commit.type === 'perf') {
        type = 'Performance Improvements';
      } else if (commit.type === 'chore' && commit.scope === 'deps') {
        commit.type = 'Dependency Updates';
        commit.scope = '';
      } else if (commit.type === 'revert' || commit.revert) {
        type = 'Reverts';
      } else if (discard) {
        // Move up earlier to filter below
        return;
      } else if (commit.type === 'k8s') {
        commit.type = 'Kubernetes';
      } else if (commit.type === 'docs') {
        type = 'Documentation';
      } else if (commit.type === 'style') {
        type = 'Styles';
      } else if (commit.type === 'refactor') {
        type = 'Code Refactoring';
      } else if (commit.type === 'test') {
        type = 'Tests';
      } else if (commit.type === 'build') {
        type = 'Build System';
      } else if (commit.type === 'ci') {
        type = 'Continuous Integration';
      } else if (commit.type === 'chore') {
        commit.type = 'Chore';
      }

      const scope = commit.scope === '*' ? '' : commit.scope;
      const shortHash = typeof commit.hash === 'string' ? commit.hash.substring(0, 7) : commit.shortHash;

      const issues = [];
      let subject = commit.subject;

      if (typeof subject === 'string') {
        let url = context.repository ? `${context.host}/${context.owner}/${context.repository}` : context.repoUrl;
        if (url) {
          url = `${url}/issues/`;
          // Issue URLs.
          subject = subject.replace(/#([0-9]+)/g, (_, issue) => {
            issues.push(issue);
            return `[#${issue}](${url}${issue})`;
          });
        }
        if (context.host) {
          // User URLs.
          subject = subject.replace(/\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g, (_, username) => {
            if (username.includes('/')) {
              return `@${username}`;
            }

            return `[@${username}](${context.host}/${username})`;
          });
        }
      }

      // remove references that already appear in the subject
      const references = commit.references.filter((reference) => !issues.includes(reference.issue));

      return {
        notes,
        type,
        scope,
        shortHash,
        subject,
        references,
      };
    },
    groupBy: 'type',
    commitGroupsSort: 'title',
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    notesSort: compareFunc,
  };
}

export default async function createPreset() {
  return {
    parser: createParserOpts(),
    writer: await createWriterOpts(),
    whatBump,
  };
}
