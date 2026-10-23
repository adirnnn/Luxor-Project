from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_devuelve_mensaje_de_estado():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "El API del chatbot está funcionando correctamente."}
