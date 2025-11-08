"""
Server extension handlers for jupytutor configuration
"""
import json
import os
from pathlib import Path
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado


class ConfigHandler(APIHandler):
    """Handler for loading jupytutor configuration from user's home directory"""

    @tornado.web.authenticated
    def get(self):
        """Get the jupytutor configuration from ~/.config/jupytutor/config.json"""
        try:
            # Get the config file path from user's home directory
            config_path = Path.home() / ".config" / "jupytutor" / "config.json"
            
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config_data = json.load(f)
                    self.finish(json.dumps({
                        "status": "success",
                        "config": config_data
                    }))
            else:
                # Config file doesn't exist
                self.set_status(404)
                self.finish(json.dumps({
                    "status": "not_found",
                    "message": f"Config file not found at {config_path}"
                }))
        except json.JSONDecodeError as e:
            # Invalid JSON
            self.set_status(400)
            self.finish(json.dumps({
                "status": "error",
                "message": f"Invalid JSON in config file: {str(e)}"
            }))
        except Exception as e:
            # Other errors
            self.set_status(500)
            self.finish(json.dumps({
                "status": "error",
                "message": f"Error reading config: {str(e)}"
            }))


def setup_handlers(web_app):
    """Setup the handlers for the server extension"""
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    
    # Register the config handler
    handlers = [
        (url_path_join(base_url, "jupytutor", "config"), ConfigHandler)
    ]
    
    web_app.add_handlers(host_pattern, handlers)

