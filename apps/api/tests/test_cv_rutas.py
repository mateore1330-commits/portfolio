"""Dónde busca el CV a Chrome, las fuentes y el retrato (INFRA-03: en Docker van en su sitio)."""

import importlib


def test_por_defecto_las_de_la_web(monkeypatch):
    for clave in ("CV_FUENTES", "CV_RETRATO", "CV_CHROME_SIN_SANDBOX"):
        monkeypatch.delenv(clave, raising=False)
    from api.cv import generar

    generar = importlib.reload(generar)
    assert generar.FUENTES.parts[-3:] == ("web", "node_modules", "@fontsource-variable")
    assert generar.RETRATO.name == "retrato-400.jpg"
    assert generar.SIN_SANDBOX is False


def test_desde_la_configuracion(monkeypatch, tmp_path):
    monkeypatch.setenv("CV_FUENTES", str(tmp_path / "fuentes"))
    monkeypatch.setenv("CV_RETRATO", str(tmp_path / "retrato.jpg"))
    monkeypatch.setenv("CV_CHROME_SIN_SANDBOX", "1")
    from api.cv import generar

    try:
        generar = importlib.reload(generar)
        assert generar.FUENTES == tmp_path / "fuentes"
        assert generar.RETRATO == tmp_path / "retrato.jpg"
        assert generar.SIN_SANDBOX is True
    finally:
        monkeypatch.undo()
        importlib.reload(generar)
