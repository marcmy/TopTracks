'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGs(relativePaths, extras = {}) {
  const context = vm.createContext({
    console,
    Object,
    Math,
    Number,
    String,
    Array,
    JSON,
    Date,
    Error,
    RegExp,
    isFinite,
    ...extras
  });
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(__dirname, '..', relativePath);
    vm.runInContext(fs.readFileSync(absolutePath, 'utf8'), context, {
      filename: absolutePath
    });
  }
  return context;
}

module.exports = { loadGs };
