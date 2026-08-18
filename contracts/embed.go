package contracts

import "embed"

// Files contains the authoritative runtime and API contracts.
//
//go:embed *.json openapi.yaml
var Files embed.FS
