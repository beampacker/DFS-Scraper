import http.server
import socketserver
import json
import os

RESULTS_FOLDER = r"C:\pp_ev_model\results"

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/results_index.json":
            data = {}

            for fname in os.listdir(RESULTS_FOLDER):
                if fname.endswith(".json"):
                    with open(os.path.join(RESULTS_FOLDER, fname), "r") as f:
                        result = json.load(f)

                        # Key format example: "Giannis AntetokounmpoPRA"
                        key = f"{result['player']}{result['stat_type']}"
                        data[key] = result

            response = json.dumps(data).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(response)
        else:
            # Any other request → 404
            self.send_response(404)
            self.end_headers()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"[MINISERVER] Running at http://localhost:{PORT}/results_index.json")
    httpd.serve_forever()
