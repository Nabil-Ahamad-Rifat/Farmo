const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: let Metro see workspace packages (packages/shared-types etc.)
// Deliberately NOT setting resolver.disableHierarchicalLookup — expo-doctor
// flags that as a risky override, and disabling it caused Metro to resolve
// react/react-dom to the workspace-root hoisted copies (matching apps/web's
// pinned version) instead of the SDK-matched copies nested under this
// package, which is exactly the "duplicate native module" problem React
// Native can't tolerate. Metro's default hierarchical lookup already
// prefers the nearest node_modules, which is what we want here.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
