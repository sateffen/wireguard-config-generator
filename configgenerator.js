#!/usr/bin/node
const fs = require('node:fs');
const path = require('node:path');
const {execSync} = require('node:child_process');

/**
 * Key of general-config-key in the config-file.
 */
const GENERAL_CONFIG_KEY = '__config';

/**
 * Loads and validates the config from given path.
 * @param {string} configFilePath The path given as process-arg, where to find the config file.
 * @return {object} The loaded and validated config object.
 */
function loadConfigFile(configFilePath) {
    const resolvedPath = path.resolve(__dirname, configFilePath);
    const potentialConfig = require(resolvedPath);

    if (potentialConfig === null || typeof potentialConfig !== 'object') {
        throw new TypeError('Config is not an object or null');
    }

    return potentialConfig;
}

/**
 * Prepares the ouptut directory for the config files, i.e. makes sure the directory
 * exists and such.
 * @param {string} outputDir The output directory.
 */
function prepareOutputDir(outputDir) {
    console.log(`Writing output to "${outputDir}"`);

    fs.mkdirSync(outputDir, {recursive: true});
}

/**
 * Writes the host config with given parameters.
 * @param {string} outputDir The output-dir to write the output-file to.
 * @param {string} entryName The entry-name to write the config for. This value is used as output-file-name.
 * @param {string[]} lines The lines of the file to write. Get concatinated by new lines on its way.
 */
function writeHostConfig(outputDir, entryName, lines) {
    const outputFile = path.join(outputDir, entryName + '.conf');

    fs.writeFileSync(outputFile, lines.join('\n'));
    console.log(`Wrote host configuration for ${entryName} to "${outputFile}"`);
}

/**
 * Executes the config-generator. Acts as main-entrypoint when used as script.
 * @param {string[]} processArgs The list of arguments that got passed along.
 */
function main(processArgs) {
    if (processArgs.length !== 1) {
        throw new Error('Expected exactly one argument, the config-file. but got', processArgs.length);
    }

    const config = loadConfigFile(processArgs[0]);

    const generalConfig = config[GENERAL_CONFIG_KEY] ?? {};
    const listenPort = generalConfig.listenPort ?? 51820;
    const outputDir = path.resolve(__dirname, generalConfig.outputDir ?? './output');
    const pskCache = {};

    prepareOutputDir(outputDir);

    // first, generate the key-pairs:
    for (const key of Object.keys(config)) {
        if (key === GENERAL_CONFIG_KEY) {
            continue;
        }

        const member = config[key];
        member['key'] = execSync('wg genkey').toString().trim();
        member['crt'] = execSync('wg pubkey', {input: member.key}).toString().trim();
    }

    // then generate the actual config-files:
    for (const key of Object.keys(config)) {
        // just skip the general config.
        if (key === GENERAL_CONFIG_KEY) {
            continue;
        }

        // first setup the host itself.
        const host = config[key];
        const lines = [
            `[Interface] # ${key}`,
            `Address = ${host.Address}`,
            `ListenPort = ${listenPort}`,
            `PrivateKey = ${host.key}`,
        ];

        if (generalConfig.fullMesh === false && typeof host.Endpoint !== 'string' && typeof generalConfig.clientDNS === 'string') {
            lines.push(`DNS = ${generalConfig.clientDNS}`);
        }

        lines.push('');

        // now generate everything for every peer.
        for (const innerKey of Object.keys(config)) {
            if (
                // if the inner key is not pointing to any peer
                innerKey === GENERAL_CONFIG_KEY ||
                innerKey === key ||
                // or we are not in full-mesh mode and this is a peer2peer connection
                (
                    generalConfig.fullMesh === false &&
                    typeof host.Endpoint !== 'string' &&
                    typeof config[innerKey].Endpoint !== 'string'
                )
            ) {
                // just skip it.
                continue;
            }

            const peer = config[innerKey];
            const pskName = [key, innerKey].sort().join();

            if (!(pskName in pskCache)) {
                pskCache[pskName] = execSync('wg genpsk').toString().trim();
            }

            lines.push(...[
                `[Peer] # ${innerKey}`,
                `PublicKey = ${peer.crt}`,
                `PresharedKey = ${pskCache[pskName]}`,
                `AllowedIPs = ${peer.AllowedIPs}`,
            ]);

            if (typeof peer.Endpoint === 'string') {
                lines.push(`Endpoint = ${peer.Endpoint}:${listenPort}`);
            }

            lines.push('');
        }

        writeHostConfig(outputDir, key, lines);
    }
}

// If this file was called directly, we execute, otherwise it's a lib-call or a test.
if (require.main === module) {
    // throw away the first 2 args, as they are the node-interpreter and the script itself.
    main(process.argv.slice(2));
}

// Export everything for library use or tests.
module.exports = {
    loadConfigFile,
    prepareOutputDir,
    writeHostConfig,
    main,
};
