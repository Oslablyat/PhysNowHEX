# CoolProp 8.0.0 browser distribution

Unmodified official JavaScript + WASM binaries, downloaded from:

- https://sourceforge.net/projects/coolprop/files/CoolProp/8.0.0/Javascript/coolprop.js/download
- https://sourceforge.net/projects/coolprop/files/CoolProp/8.0.0/Javascript/coolprop.wasm/download
- License: https://github.com/CoolProp/CoolProp/blob/v8.0.0/LICENSE

WASM SHA-256 (matches SourceForge):
`28a83d839ab69c7e6ea480298955ce223b6507dc6ffb83349dd31f1540867307`

MIT license is retained in LICENSE. Local package.json only marks this directory
as ES modules for the Node-based verification tests. The browser loads the
library lazily in a module Worker, without a CDN or a server-side property API.
