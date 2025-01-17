const { execSync } = require('child_process');
const crypto = require('crypto');
const {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync
} = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const IMAGE_NAME = 'donalffons/opencascade.js:2.0.0-beta.371bbb0';
const OPEN_CASCADE_DIR = 'lib';
const VERSION_FILE_NAME = 'jupytercad.opencascade.version';
const VERSION_FILE_PATH = path.join(OPEN_CASCADE_DIR, VERSION_FILE_NAME);
const BUILD_FILE_NAME = 'build.yml';

function computeHash(filePath) {
  const hashSum = crypto.createHash('sha256');
  hashSum.update(readFileSync(filePath));
  const buildHash = hashSum.digest('hex');
  return buildHash;
}

/**
 * Check if we should re-build occ by using the hash of
 * the build configuration file.
 *
 */
function checkNeedsRebuild() {
  const buildHash = computeHash(BUILD_FILE_NAME);
  let needsRebuild = true;
  if (existsSync(VERSION_FILE_PATH)) {
    const currentHash = readFileSync(VERSION_FILE_PATH, {
      encoding: 'utf8',
      flag: 'r'
    });

    if (currentHash === buildHash) {
      needsRebuild = false;
    }
  }

  return needsRebuild;
}

/**
 * Build occ by using docker.
 *
 */
function build() {
  execSync(`docker pull ${IMAGE_NAME}`);

  copyFileSync(BUILD_FILE_NAME, path.join(OPEN_CASCADE_DIR, BUILD_FILE_NAME));

  execSync(
    `docker run --rm -v "$(pwd):/src" -u "$(id -u):$(id -g)" ${IMAGE_NAME} ${BUILD_FILE_NAME}`,
    { cwd: OPEN_CASCADE_DIR }
  );
}

/**
 * Add new symbols to the config file, filter duplications
 * and sort symbol name
 *
 */
function updateBuildConfig(newSymbol) {
  const buildConfig = yaml.load(readFileSync(BUILD_FILE_NAME, 'utf8'));
  const bindings = [
    ...buildConfig.mainBuild.bindings,
    ...newSymbol.map(i => ({
      symbol: i
    }))
  ];
  const filtered = bindings.filter(
    (value, index, array) =>
      index === array.findIndex(t => t.symbol === value.symbol)
  );
  const sorted = filtered.sort((item1, item2) =>
    item1.symbol.localeCompare(item2.symbol)
  );
  buildConfig.mainBuild.bindings = sorted;
  writeFileSync(BUILD_FILE_NAME, yaml.dump(buildConfig, { quotingType: '"' }));
}

if (require.main === module) {
  if (!existsSync(OPEN_CASCADE_DIR)) {
    mkdirSync(OPEN_CASCADE_DIR);
  }

  let newSymbol = [];
  const args = process.argv.slice(2);
  if (args.length > 1 && args[0] === '--add') {
    [_, ...newSymbol] = [...args];
  }

  if (newSymbol.length > 0 || checkNeedsRebuild()) {
    updateBuildConfig(newSymbol);
    build();
    writeFileSync(VERSION_FILE_PATH, computeHash(BUILD_FILE_NAME));
  }
}
