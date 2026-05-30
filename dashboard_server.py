import http.server
import socketserver
import json
import sqlite3
import os
import urllib.parse

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DB_PATH = r"C:\Users\Administrator\.n8n\database.sqlite"

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS for Chrome Extension requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/get-showcase':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            products = []
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                # Ensure custom showcase table exists
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tiktok_showcase_products (
                        product_id TEXT PRIMARY KEY,
                        name TEXT,
                        image_url TEXT,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("SELECT product_id, name, image_url FROM tiktok_showcase_products ORDER BY name ASC;")
                rows = cursor.fetchall()
                for row in rows:
                    products.append({
                        "product_id": row[0],
                        "name": row[1],
                        "image_url": row[2]
                    })
                conn.close()
            except Exception as e:
                print("Error getting showcase products:", e)
                
            self.wfile.write(json.dumps(products).encode('utf-8'))
        else:
            # Fallback to standard static file serving
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/sync-showcase':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                products = payload.get('products', [])
                
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tiktok_showcase_products (
                        product_id TEXT PRIMARY KEY,
                        name TEXT,
                        image_url TEXT,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                
                for p in products:
                    cursor.execute("""
                        INSERT OR REPLACE INTO tiktok_showcase_products (product_id, name, image_url, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP);
                    """, (p['product_id'], p['name'], p['image_url']))
                
                conn.commit()
                conn.close()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {"status": "success", "message": f"Synced {len(products)} products"}
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                print("Error syncing showcase products:", e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {"status": "error", "message": str(e)}
                self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    # Change working directory to ensure correct static file serving path
    os.chdir(DIRECTORY)
    # Allow port reuse to avoid 'Address already in use' during rapid restarts
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Serving HTTP with API endpoints on port {PORT}...")
        httpd.serve_forever()
