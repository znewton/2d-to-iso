# 2D to Isometric

Convert a 2D image asset into an isometric perspective image asset.

## Prerequisites

- [Node.js](https://nodejs.org)
- [GraphicsMagick](https://www.graphicsmagick.org)

## Install

```shell
npm install
```

## Run

```shell
# Convert 1 File
node index.mjs [path/to/image] [path/to/output/image]
# Convert all files in a directory
node index.mjs [path/to/input/dir] [path/to/output/dir]
# Output verbose logs
node index.mjs [path/to/image] [path/to/output/image] '{"verbose":true}'
```