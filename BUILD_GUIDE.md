# Build and Publishing Guide for jupytutor

## Overview

This guide explains how to build and publish the jupytutor package to PyPI, ensuring all React components and JavaScript assets are included.

## What Was Fixed

The original configuration was missing the `hatch-jupyter-builder` in the build requirements, which caused the JavaScript/React components to not be built during package creation. The following changes were made:

1. **pyproject.toml updates:**
   - Added `hatch-jupyter-builder>=0.5` to `build-system.requires`
   - Added `[tool.hatch.build.targets.wheel]` section with artifacts
   - Added `install-pre-commit-hook = false` to jupyter-builder configuration

2. **Created MANIFEST.in:**
   - Ensures all source files, styles, and built assets are included in the source distribution

## Prerequisites

Before building, ensure you have:

- Python >= 3.9
- Node.js and npm/yarn
- `jlpm` (JupyterLab package manager)

Install build dependencies:

```bash
pip install build hatchling hatch-jupyter-builder jupyterlab
```

## Building the Package

### 1. Clean Previous Builds

```bash
# Clean JavaScript build artifacts
jlpm clean:all

# Clean Python build artifacts
rm -rf dist/ build/ *.egg-info
rm -rf jupytutor/labextension
```

### 2. Build JavaScript/TypeScript Components

```bash
# Install npm dependencies
jlpm install

# Build the labextension
jlpm build:prod
```

This will:

- Compile TypeScript to JavaScript
- Bundle React components
- Create the labextension in `jupytutor/labextension/`

### 3. Build Python Package

```bash
# Build both wheel and source distribution
python -m build
```

This will:

- Trigger the `hatch-jupyter-builder` to build the extension
- Create the wheel (`.whl`) in `dist/`
- Create the source distribution (`.tar.gz`) in `dist/`

### 4. Verify the Build

Check that the wheel contains the labextension:

```bash
# List contents of the wheel
unzip -l dist/jupytutor-*.whl | grep labextension

# You should see entries like:
# share/jupyter/labextensions/jupytutor/static/...
# share/jupyter/labextensions/jupytutor/package.json
```

Or use a tool like `check-wheel-contents`:

```bash
pip install check-wheel-contents
check-wheel-contents dist/jupytutor-*.whl
```

## Publishing to PyPI

### Test PyPI (Recommended First)

1. Register at https://test.pypi.org/
2. Create an API token
3. Upload:

```bash
pip install twine
twine upload --repository testpypi dist/*
```

4. Test installation:

```bash
pip install --index-url https://test.pypi.org/simple/ jupytutor
```

### Production PyPI

1. Register at https://pypi.org/
2. Create an API token
3. Upload:

```bash
twine upload dist/*
```

## Development Installation

For development, use editable install:

```bash
# Install in development mode
pip install -e .

# In another terminal, watch for changes
jlpm watch
```

## Troubleshooting

### React Components Not Showing Up

If React components aren't appearing after installation:

1. Check that labextension is installed:

```bash
jupyter labextension list
```

2. Rebuild the extension:

```bash
jlpm build:prod
```

3. Verify the built files exist:

```bash
ls -la jupytutor/labextension/static/
```

4. Check browser console for errors

### Build Failures

If the build fails:

1. Ensure all dependencies are installed:

```bash
jlpm install
pip install -e ".[dev]"
```

2. Clear all caches:

```bash
jlpm clean:all
rm -rf node_modules
rm -rf ~/.jupyter/lab/staging
jlpm install
```

3. Check for TypeScript errors:

```bash
jlpm build:lib
```

## Key Files

- `pyproject.toml` - Python package configuration
- `package.json` - JavaScript package configuration
- `MANIFEST.in` - Source distribution file inclusion rules
- `jupytutor/labextension/` - Built JavaScript assets (auto-generated)
- `src/` - TypeScript/React source code
- `style/` - CSS styles

## CI/CD Integration

For automated publishing, you can use GitHub Actions. Example workflow:

```yaml
name: Publish to PyPI

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          pip install build twine
          npm install -g yarn

      - name: Build
        run: |
          jlpm install
          jlpm build:prod
          python -m build

      - name: Publish
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
        run: twine upload dist/*
```

## Version Management

The package version is managed through `package.json` using `hatch-nodejs-version`. To bump the version:

```bash
# Update version in package.json
npm version patch  # or minor, or major

# Commit the change
git add package.json
git commit -m "Bump version to X.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```
