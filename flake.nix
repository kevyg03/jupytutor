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
            pkgs.stdenv.cc.cc.lib
            pkgs.zlib
          ];
          env = {
            PIP_DISABLE_PIP_VERSION_CHECK = "1";
            PYTHONNOUSERSITE = "1";
          };
          shellHook = ''
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
            pip install numpy otter-grader datascience
            echo "Installing JupyterLab + kernel in venv"
            pip install jupyterlab ipykernel
            python -m ipykernel install --user --name jupytutor-venv --display-name "Jupytutor (venv)"
            # echo "Next: jlpm install"
            jlpm install
            # echo "Then: pip install -e ."
            pip install -e .
            jupyter labextension develop . --overwrite
            echo "jupytutor dev shell ready"
            echo "Run JupyterLab: jupyter lab"
          '';
        };
      });
}
