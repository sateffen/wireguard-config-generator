# WireGuard Config Generator

This is a little helper-script for generating wg-quick configurations for a complete
WireGuard network.

The script just needs a json-config file describing your network, and generates
everything according to that json-config file. All generated wg-config-files are
INI files for use with *wg-quick*. For more details about *wg-quick* see
[HERE](https://wiki.archlinux.org/title/WireGuard#wg-quick).

IMPORTANT: This script will generate new public-, private- and preshared-keys each
run, so you have to deploy all configs at once, and can't just add one host at one
time.

## Requirements

You need Node.js to execute this script. Node.js v16+ should work fine. You don't need
to install any modules, as there are no external NPM-dependencies.

Additionally, you need to install WireGuard on the host you're executing this script.
The script will call the `wg` command internally to generate all secrets.

## Configuration

The configuration file is just a simple JSON-object containing the description for each
host you want to generate a configuration for, so basically:

```js
{
    "<host-1>": {...host-1-config},
    "<host-2>": {...host-2-config}
}
```

There is one special hostname: `__config`. This key represents the general configuration
of the generator. You can use the following options:

```js
{
    "__config": {
        /**
         * This key specifies the listen port for your network.
         * @type {number}
         * @required
         */
        "listenPort": 51820,
        /**
         * Specifies the output-directory. This directory is relative to this config-file.
         * @type {string}
         * @required
         */
        "outputDir": "output/",
        /**
         * Whether to generate a full-mesh or a half-mesh.
         * In a full-mesh each peer knows each other, so every peer has all other peers in
         * its configuration.
         * In a half-mesh each peer is either a "server" or a "client". Every server has the
         * "Endpoint" option set, while "clients" don't have an "Endpoint" set. The reasoning
         * is, that the Endpoint represents an internet routable address, therefore describes
         * a server. In a half-mesh servers know each other server, as well als each client,
         * but the clients only know the servers and no other clients.
         * @type {boolean}
         * @default {true}
         */
        "fullMesh": false,
        /**
         * This option is only relevant if `__config.fullMesh=false`. If this is set, each
         * client in the configuration gets the *DNS* value set to the value provided here.
         * @type {string}
         * @default {null}
         */
        "clientDNS": "10.0.0.1"
    }
}
```

All other keys get interpreted as peers, where you can use the following options:

```js {
    /**
     * The network-address to apply to the generated wg-network-interface.
     * @type {string}
     * @required
     */
    "Address": "10.0.0.1/24",
    /**
     * All allowed IPs of this peer. This can be a comma separated list of multiple CIDRs.
     * @type {string}
     * @required
     */
    "AllowedIPs": "10.0.0.1/32",
    /**
     * The public reachable endpoint of this node.
     * @type {string}
     * @default {null}
     */
    "Endpoint": "1.2.3.4"
}```
