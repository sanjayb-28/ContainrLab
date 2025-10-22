from backend.app.routers.terminal import _build_runner_ws_url


def test_build_runner_ws_url_http():
    url = _build_runner_ws_url("abc123", "/bin/bash", base_url="http://runnerd:8080")
    assert url == "ws://runnerd:8080/terminal/abc123?shell=%2Fbin%2Fbash"


def test_build_runner_ws_url_https_path():
    url = _build_runner_ws_url("xyz", "/bin/sh", base_url="https://example.com/api")
    assert url == "wss://example.com/api/terminal/xyz?shell=%2Fbin%2Fsh"


def test_build_runner_ws_url_bare_host():
    url = _build_runner_ws_url("foo", "/bin/sh", base_url="runnerd:8080")
    assert url == "ws://runnerd:8080/terminal/foo?shell=%2Fbin%2Fsh"
