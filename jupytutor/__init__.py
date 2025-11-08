try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'jupytutor' outside a proper installation.")
    __version__ = "dev"


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "jupytutor"
    }]


def _jupyter_server_extension_points():
    """
    Returns a list of dictionaries with metadata describing
    where to find the server extension
    """
    return [{
        "module": "jupytutor"
    }]


def _load_jupyter_server_extension(server_app):
    """
    Load the jupytutor server extension
    """
    from .handlers import setup_handlers
    
    web_app = server_app.web_app
    setup_handlers(web_app)
    
    server_app.log.info("jupytutor server extension loaded")
