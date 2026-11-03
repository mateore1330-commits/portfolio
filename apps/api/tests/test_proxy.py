"""La IP del visitante detrás de Caddy (INFRA-03): solo se cree a los proxies de PROXIES."""

from flask import request


def cliente_que_dice_la_ip(monkeypatch, proxies):
    if proxies is None:
        monkeypatch.delenv("PROXIES", raising=False)
    else:
        monkeypatch.setenv("PROXIES", proxies)
    from api import create_app

    app = create_app()

    @app.get("/api/prueba-ip")
    def prueba_ip():
        return {"ip": request.remote_addr}

    return app.test_client()


def pedir(cliente):
    # Caddy (10.0.0.2) añade la IP del visitante al final; lo que venga antes, inventado.
    respuesta = cliente.get("/api/prueba-ip", headers={"X-Forwarded-For": "6.6.6.6, 81.0.0.7"},
                            environ_base={"REMOTE_ADDR": "10.0.0.2"})
    return respuesta.json["ip"]


def test_sin_proxies_no_se_cree_la_cabecera(monkeypatch):
    assert pedir(cliente_que_dice_la_ip(monkeypatch, None)) == "10.0.0.2"


def test_con_un_proxy_se_toma_la_del_visitante(monkeypatch):
    assert pedir(cliente_que_dice_la_ip(monkeypatch, "1")) == "81.0.0.7"
