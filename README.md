# vs-rest-api

A [Visual Studio Code](https://code.visualstudio.com/) (VS Code) extension that provides a REST API to control your editor.

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=9J3ZR95RJE2BA) [![](https://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?fid=o62pkd&url=https%3A%2F%2Fgithub.com%2Fmkloubert%2Fvs-rest-api)

## Table of contents

1. [Install](#install-)
2. [How to use](#how-to-use-)
   * [Settings](#settings-)
         * [Users](#users-)
   * [Build-in endpoints](#build-in-endpoints-)
   * [Custom endpoints](#custom-endpoints-)

## Install [[&uarr;](#table-of-contents)]

Launch VS Code Quick Open (Ctrl+P), paste the following command, and press enter:

```bash
ext install vs-rest-api
```

Or search for things like `vs-deploy` in your editor.

## How to use [[&uarr;](#table-of-contents)]

### Settings [[&uarr;](#how-to-use-)]

Open (or create) your `settings.json` in your `.vscode` subfolder of your workspace.

Add a `deploy` section:

```json
{
    "rest.api": {
        "autoStart": true,
        "openInBrowser": true,
        "port": 1781
    }
}
```

This example will run the host on port `1781` on startup and opens the URL `https://localhost:1781/` in your default application, like your browser.

#### Users [[&uarr;](#settings-)]

### Build-in endpoints [[&uarr;](#how-to-use-)]

### Custom endpoints [[&uarr;](#how-to-use-)]
