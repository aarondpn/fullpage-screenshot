<div align="center">
  <img src="public/icon-128.png" alt="Full Page Screenshot" width="96">
  <h1>Full Page Screenshot</h1>
  <p>A browser extension that captures full-page screenshots of any web page. Works on Chrome and Firefox.</p>
  <video src="https://github.com/user-attachments/assets/f58651db-9f91-4da6-821d-851ac76605e4" autoplay loop muted></video>
</div>

## Install

1. Download the latest zip for your browser from [Releases](../../releases/latest)
2. **Chrome**: Go to `chrome://extensions`, enable "Developer mode", and drag the zip onto the page
3. **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select the zip

## Development

Requires [Node.js](https://nodejs.org/) >= 20 and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm dev          # Chrome
pnpm dev:firefox  # Firefox
```

## Built with

- [WXT](https://wxt.dev/) — framework for building browser extensions
- [jsPDF](https://github.com/parallax/jsPDF) — PDF export

## License

[MIT](LICENSE)
