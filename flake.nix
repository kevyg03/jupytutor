{
  description = "Development shell for jupytutor";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        pythonEnv = pkgs.python311.withPackages (ps: [
          ps.pip
        ]);
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pythonEnv
            pkgs.nodejs_20
            pkgs.yarn
            pkgs.git
            pkgs.screen
            pkgs.ncurses
            pkgs.stdenv.cc.cc.lib
            pkgs.zlib
          ];
          env = {
            PIP_DISABLE_PIP_VERSION_CHECK = "1";
            PYTHONNOUSERSITE = "1";
          };
          shellHook = ''
            export SHELL=${pkgs.bashInteractive}/bin/bash
            export TERMINFO_DIRS="${pkgs.ncurses}/share/terminfo''${TERMINFO_DIRS:+:$TERMINFO_DIRS}"
            export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
            if [ ! -d .venv ]; then
              echo "Creating .venv (first run)"
              ${pkgs.python311}/bin/python -m venv .venv
            fi
            # Activate repo-local venv so pip installs are writable.
            . .venv/bin/activate
            echo "Virtualenv active: .venv"
            echo "Installing environment packages (numpy, otter-grader, datascience)"
            pip install --upgrade pip
            pip install build twine hatchling hatch-jupyter-builder
            pip install numpy otter-grader datascience
            echo "Installing JupyterLab + kernel in venv"
            pip install jupyterlab ipykernel notebook==7.5.0
            echo "Installing classic Notebook + enabling server extension"
            python -m ipykernel install --user --name jupytutor-venv --display-name "Jupytutor (venv)"
            # echo "Next: jlpm install"
            jlpm install
            # echo "Then: pip install -e ."
            pip install -e .
            jupyter server extension enable notebook
            jupyter labextension develop . --overwrite
            echo "jupytutor dev shell ready"
            echo "Run JupyterLab: jupyter lab"
            echo "Or, to build prod release: jlpm install; jlpm build:prod; python -m build"
            echo "(to clean first: jlpm clean:all && rm -rf dist build *.egg-info jupytutor/labextension)"
          '';
        };
      });
}
