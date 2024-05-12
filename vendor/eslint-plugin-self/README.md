# eslint-plugin-self

When writing an ESLint plugin, it's often useful to use the plugin's rules to lint the plugin's own codebase. You can use `eslint-plugin-self` to do that.

## Usage

```
npm install eslint-plugin-self --save-dev
```

Note: `eslint-plugin-self` must be installed locally (it will not work if installed globally), and the project that installs it must be a functioning ESLint plugin.

Add the following to your config file:

```json
{
  "plugins": [
    "self"
  ]
}
```

Then you can use your plugin's rules, with the `self/` prefix:

```json
{
  "rules": {
    "self/my-custom-rule": "error"
  }
}
```

You can also use your plugin's configs, or anything else exported by your plugin:

```json
{
  "extends": [
    "plugin:self/some-config"
  ]
}
```
