import requests

# Test login endpoint
url = "http://localhost:8000/api/auth/login"
data = {
    "email": "admin@gmail.com",
    "password": "admin"
}

try:
    response = requests.post(url, data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
