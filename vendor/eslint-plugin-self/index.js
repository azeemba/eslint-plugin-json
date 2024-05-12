'use strict';

const plugin = require('../..');
const selfPlugin = Object.assign({}, plugin);

const pkgName = require('../../package.json').name;
let pluginName;
if (pkgName[0] === "@") {
  const matches = pkgName.match(/^(@[^/]+)\/eslint-plugin(?:-(.*))?$/);
  pluginName = matches.slice(1, 3).filter(Boolean).join('/');
} else {
  pluginName = pkgName.replace(/^eslint-plugin-/, '');
}

function createRuleset(rules) {
  return Object.keys(rules).reduce((newRules, oldRuleName) => {
    const newRuleName = oldRuleName.startsWith(`${pluginName}/`)
      ? `self${oldRuleName.slice(oldRuleName.indexOf('/'))}`
      : oldRuleName;

    newRules[newRuleName] = rules[oldRuleName];
    return newRules;
  }, {});
}

if (plugin.configs) {
  selfPlugin.configs = Object.assign({}, plugin.configs);

  Object.keys(plugin.configs).forEach(configName => {
    const config = plugin.configs[configName];
    selfPlugin.configs[configName] = Object.assign({}, config);
    if (config.extends) {
      selfPlugin.configs[configName].extends = [].concat(config.extends)
        .map(extendsName => extendsName.replace(`plugin:${pluginName}/`, 'plugin:self/'));
    }
    if (config.plugins) {
      selfPlugin.configs[configName].plugins = [].concat(config.plugins)
        .map(enabledPluginName => enabledPluginName.replace(pluginName, 'self'));
    }
    if (config.rules) {
      selfPlugin.configs[configName].rules = createRuleset(config.rules);
    }
    if (config.overrides) {
      selfPlugin.configs[configName].overrides = [].concat(config.overrides)
        .map((override) => {
          if (!override.rules) return override;
          return Object.assign(
            {},
            override,
            {rules: createRuleset(override.rules)}
          );
        })
    }
  });
}

module.exports = selfPlugin;
