'use strict';

const fs = require('fs-promise'),
      colors = require('colors'),
      exec = require('mz/child_process').exec,
      inquirer = require('inquirer');

class SiteRepo {
  constructor(repoName, pushBranch) {
    this.repoName = repoName;
    this.pushBranch = pushBranch;
  }

  init() {
    return this.inferRepo()
    .then(() => this.checkRemoteBranchExists());
  }

  inferRepo () {
    let promise;
    if ( this.repoName.endsWith('.git') ) {
      this.pushRepo = this.repoName;
      promise = Promise.resolve(this);
    } else {
      promise = exec(`git config remote.${this.repoName}.url`)
      .then(output => {
        let repo = output[0].split('\n')[0];
        this.pushRepo = repo.replace('https://github.com', 'git@github.com');
        return this;
      })
    }
    return promise
    .then(() => {
      console.log(`Inferred REPO ${this.pushRepo}`);
      return this;
    });
  }

  checkRemoteBranchExists () {
    return exec(`git ls-remote --heads ${this.pushRepo} ${this.pushBranch}`)
    .then(output => {
      let head = output[0].split('\n')[0];
      this.remoteBranchExists = head.length > 0;
      return this.remoteBranchExists;
    })
  }

  clone(clonePath) {
    if (this.remoteBranchExists) {
      console.log(colors.green(`${this.pushBranch} branch exists, pushing updates`));
      console.log(`git clone --branch ${this.pushBranch} ${this.pushRepo} ${clonePath}`)
      return exec(`git clone --branch ${this.pushBranch} ${this.pushRepo} ${clonePath}`)
    } else {
      console.log(colors.green(`${this.pushBranch} branch does not exist, creating branch`));
      return exec(`git clone ${this.pushRepo} ${clonePath}`)
      .then(() => exec(`git -C ${clonePath} checkout --orphan ${this.pushBranch}`))
      .then(() => exec(`git -C ${clonePath} rm -rf .`));
    }
  }

  push(deployment) {
    let quiet = process.env.PF_GHPAGES_QUIET;
    return deployment.deploymentFolder.isClean()
    .then(clean => {
      if (clean) {
        return Promise.reject('Site directory clean, no changes to commit.')
      } else {
        return exec(`git -C github.io commit -q -a -m "Added files from commit #${deployment.localClone.sha}"`);
      }
    })
    .then(() => {
      console.log(`Pushing commit ${deployment.localClone.sha} to repo ${this.pushRepo}.`);
      if (quiet === 'true') {
        return Promise.resolve({
          push: true
        });
      } else {
        return inquirer.prompt([{
          type: 'confirm',
          name: 'push',
          message: colors.yellow(`Push ${deployment.siteFolder.path} to repo ${this.pushRepo}/${this.pushBranch}?`),
          default: true
        }])
      }
    })
    .then(answers => {
      if (answers.push) {
        return exec(`git -C github.io push ${this.pushRepo} ${this.pushBranch}:${this.pushBranch}`);
      } else {
        return Promise.reject('Push aborted.');
      }
    });
  }
}

module.exports = SiteRepo;