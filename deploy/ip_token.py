import re
from websockify.token_plugins import BasePlugin

class IpToken(BasePlugin):
    def lookup(self, token):
        if re.fullmatch(r"(\d{1,3}\.){3}\d{1,3}", token):
            return (token, 5900)
        return None
