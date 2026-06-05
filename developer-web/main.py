from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import random
import re
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest
from urllib.request import urlopen

from fastapi import Body, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
API_DIR = DATA_DIR / "api"
LOCAL_STATE_DIR = Path(os.getenv("LOCAL_STATE_DIR") or ("/tmp/stb_arab_state" if os.getenv("VERCEL") else str(DATA_DIR / "local_state")))
LIVE_CACHE_DIR = DATA_DIR / "live_cache"
UPSTREAM_BASE = "https://stbhub.gg"
UPSTREAM_BOOT_TTL_SEC = 15
UPSTREAM_BOOT_CACHE: dict[str, Any] = {"at": 0.0, "payload": None}
FN360_MAP_API_BASE = "https://api.fn360.gg/api/maps"
FN360_MAP_TTL_SEC = 30
FN360_MAP_CACHE: dict[str, Any] = {"code": "", "at": 0.0, "payload": None}
DISCORD_API_BASE = "https://discord.com/api/v10"
DISCORD_USER_AGENT = "STB-Arab OAuth (https://stb-arab.vercel.app, 1.0)"
DISCORD_BOT_USER_AGENT = "STB-Arab Code Bot (https://stb-arab.vercel.app, 1.0)"
AUDIO_STEM_ALIASES = {
    "burbaloni-lulilolli": "burbaloni-loliloli",
    "burbalona-loliloli": "burbaloni-loliloli",
    "grande-rot": "grande-lucky-rot",
}


def configured_cors_origins() -> list[str]:
    origins = {
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://stb-arab.vercel.app",
    }
    for key in ("PUBLIC_SITE_URL", "URL", "DEPLOY_PRIME_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"):
        val = (os.getenv(key) or "").strip()
        if not val:
            continue
        if not re.match(r"^https?://", val, re.I):
            val = "https://" + val
        origins.add(val.rstrip("/"))
    return sorted(origins)


app = FastAPI(title="STB-Arab")
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if cookie_secure(request):
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.url.path in {"/api/me", "/api/collection"} or request.url.path.startswith("/api/auth/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def read_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def read_json_from_text(raw: str, default: Any = None) -> Any:
    try:
        return json.loads(raw)
    except Exception:
        return default


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def data_json(name: str, default: Any = None) -> Any:
    return read_json(DATA_DIR / name, default)


def api_json(path: str, default: Any = None) -> Any:
    index = read_json(DATA_DIR / "api_index.json", {})
    filename = index.get(path)
    if not filename:
        return default
    return read_json(API_DIR / filename, default)


def local_origin(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def ok(payload: Any) -> JSONResponse:
    return JSONResponse(payload)


AUTH_DB_PATH = LOCAL_STATE_DIR / "stb_arab.db"
CODES_OVERRIDE_PATH = LOCAL_STATE_DIR / "codes.json"
CODES_SEEN_PATH = LOCAL_STATE_DIR / "codes_seen.json"
BUNDLED_CODES_SEEN_PATH = DATA_DIR / "codes_seen.json"
SESSION_COOKIE = "stbarab_session"
OAUTH_STATE_COOKIE = "stbarab_oauth_state"
SIGNED_SESSION_PREFIX = "s1"
SESSION_TTL_SEC = 60 * 60 * 24 * 30
OAUTH_STATE_TTL_SEC = 60 * 10


def auth_db() -> sqlite3.Connection:
    LOCAL_STATE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db() -> None:
    with auth_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                global_name TEXT,
                discriminator TEXT,
                avatar_hash TEXT,
                avatar_url TEXT,
                is_admin INTEGER NOT NULL DEFAULT 0,
                is_codes_editor INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS collection_state (
                user_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                hide_from_others INTEGER NOT NULL DEFAULT 0,
                notify_new_codes INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        try:
            conn.execute("ALTER TABLE collection_state ADD COLUMN notify_new_codes INTEGER NOT NULL DEFAULT 0")
        except sqlite3.OperationalError as ex:
            if "duplicate column" not in str(ex).lower():
                raise
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)")
        conn.commit()


def cookie_secure(request: Request) -> bool:
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    return "https" in proto.lower()


def public_origin(request: Request) -> str:
    env_origin = (
        os.getenv("PUBLIC_SITE_URL")
        or os.getenv("URL")
        or os.getenv("DEPLOY_PRIME_URL")
        or os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
        or os.getenv("VERCEL_URL")
        or ""
    ).strip()
    if env_origin:
        if not re.match(r"^https?://", env_origin, re.I):
            env_origin = "https://" + env_origin
        return env_origin.rstrip("/")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "http").split(",")[0].strip()
    if host:
        return f"{proto}://{host}".rstrip("/")
    return local_origin(request)


def discord_redirect_uri(request: Request) -> str:
    configured = (os.getenv("MAIN_DISCORD_REDIRECT_URI") or "").strip()
    if configured:
        return configured
    return public_origin(request) + "/api/auth/discord/callback"


def discord_avatar_url(discord_user: dict[str, Any]) -> str:
    user_id = str(discord_user.get("id") or "").strip()
    avatar = str(discord_user.get("avatar") or "").strip()
    if user_id and avatar:
        ext = "gif" if avatar.startswith("a_") else "png"
        return f"https://cdn.discordapp.com/avatars/{user_id}/{avatar}.{ext}?size=128"
    try:
        idx = int(user_id or "0") % 6
    except ValueError:
        idx = 0
    return f"https://cdn.discordapp.com/embed/avatars/{idx}.png"


def row_to_auth_user(row: sqlite3.Row | dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None

    def get_value(key: str, default: Any = "") -> Any:
        if isinstance(row, dict):
            return row.get(key, default)
        try:
            return row[key]
        except Exception:
            return default

    user_id = str(get_value("id") or "").strip()
    if not user_id:
        return None
    username = str(get_value("username") or "Discord User")
    global_name = str(get_value("global_name") or username)
    discriminator = str(get_value("discriminator") or "0")
    avatar_hash = str(get_value("avatar_hash") or "")
    avatar_url = str(get_value("avatar_url") or "")
    return {
        "id": user_id,
        "username": username,
        "global_name": global_name,
        "discriminator": discriminator,
        "avatar_hash": avatar_hash,
        "avatar_url": avatar_url,
    }


def discord_user_to_auth_user(discord_user: dict[str, Any]) -> dict[str, Any]:
    user_id = str(discord_user.get("id") or "").strip()
    if not user_id:
        raise ValueError("Discord user id is missing")
    username = str(discord_user.get("username") or "Discord User")
    global_name = str(discord_user.get("global_name") or discord_user.get("display_name") or username)
    discriminator = str(discord_user.get("discriminator") or "0")
    avatar_hash = str(discord_user.get("avatar") or "")
    return {
        "id": user_id,
        "username": username,
        "global_name": global_name,
        "discriminator": discriminator,
        "avatar_hash": avatar_hash,
        "avatar_url": discord_avatar_url(discord_user),
    }


def public_user(row: sqlite3.Row | dict[str, Any] | None) -> dict[str, Any] | None:
    user = row_to_auth_user(row)
    if not user:
        return None
    username = str(user.get("username") or "Discord User")
    name = str(user.get("global_name") or username)
    return {
        "id": str(user.get("id") or ""),
        "username": username,
        "name": name,
        "globalName": str(user.get("global_name") or ""),
        "discriminator": str(user.get("discriminator") or "0"),
        "avatarUrl": str(user.get("avatar_url") or ""),
    }


def session_secret_bytes() -> bytes:
    raw = (os.getenv("SESSION_SECRET") or os.getenv("AUTH_SECRET") or "").strip()
    if not raw:
        if os.getenv("VERCEL"):
            return b""
        raw = "stb-arab-local-dev-session-secret"
    return raw.encode("utf-8")


def b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def b64url_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode((text + padding).encode("ascii"))


def create_signed_session_token(row: sqlite3.Row | dict[str, Any]) -> str:
    secret = session_secret_bytes()
    user = row_to_auth_user(row)
    if not secret or not user:
        return ""
    now = int(time.time())
    payload = {
        "v": 1,
        "iat": now,
        "exp": now + SESSION_TTL_SEC,
        "u": user,
    }
    body = b64url_encode(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    sig = b64url_encode(hmac.new(secret, body.encode("ascii"), hashlib.sha256).digest())
    return f"{SIGNED_SESSION_PREFIX}.{body}.{sig}"


def read_signed_session_token(token: str) -> dict[str, Any] | None:
    if not token.startswith(SIGNED_SESSION_PREFIX + "."):
        return None
    secret = session_secret_bytes()
    if not secret:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    _, body, sig = parts
    expected = b64url_encode(hmac.new(secret, body.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(b64url_decode(body).decode("utf-8"))
    except Exception:
        return None
    try:
        exp = int(payload.get("exp") or 0)
    except Exception:
        exp = 0
    if exp <= int(time.time()):
        return None
    user = payload.get("u")
    if not isinstance(user, dict):
        return None
    return row_to_auth_user(user)


def persist_session_user_snapshot(user: dict[str, Any]) -> None:
    safe = row_to_auth_user(user)
    if not safe:
        return
    now = int(time.time())
    try:
        with auth_db() as conn:
            conn.execute(
                """
                INSERT INTO users (
                    id, username, global_name, discriminator, avatar_hash, avatar_url,
                    is_admin, is_codes_editor, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    username = excluded.username,
                    global_name = excluded.global_name,
                    discriminator = excluded.discriminator,
                    avatar_hash = excluded.avatar_hash,
                    avatar_url = excluded.avatar_url,
                    is_admin = 0,
                    is_codes_editor = 0,
                    updated_at = excluded.updated_at
                """,
                (
                    safe["id"],
                    safe["username"],
                    safe["global_name"],
                    safe["discriminator"],
                    safe["avatar_hash"],
                    safe["avatar_url"],
                    now,
                    now,
                ),
            )
            conn.commit()
    except sqlite3.Error:
        return


def session_user(request: Request) -> sqlite3.Row | dict[str, Any] | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    signed_user = read_signed_session_token(token)
    if signed_user:
        persist_session_user_snapshot(signed_user)
        return signed_user
    if token.startswith(SIGNED_SESSION_PREFIX + "."):
        return None
    now = int(time.time())
    with auth_db() as conn:
        row = conn.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ? AND sessions.expires_at > ?
            """,
            (token, now),
        ).fetchone()
        if not row:
            conn.execute("DELETE FROM sessions WHERE token = ? OR expires_at <= ?", (token, now))
            conn.commit()
        return row


def create_signed_session_for_user(user: dict[str, Any]) -> str:
    signed = create_signed_session_token(user)
    if not signed:
        raise ValueError("Session signing is not configured")
    persist_session_user_snapshot(user)
    return signed


def create_session(user_id: str, user_row: sqlite3.Row | dict[str, Any] | None = None) -> str:
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    try:
        with auth_db() as conn:
            conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
            conn.execute(
                "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, user_id, now, now + SESSION_TTL_SEC),
            )
            if not user_row:
                user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.commit()
    except sqlite3.Error:
        pass
    signed = create_signed_session_token(user_row) if user_row else ""
    if signed:
        return signed
    return token


def set_session_cookie(response: RedirectResponse, request: Request, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_SEC,
        httponly=True,
        secure=cookie_secure(request),
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: RedirectResponse, request: Request) -> None:
    secure = cookie_secure(request)
    response.delete_cookie(SESSION_COOKIE, path="/", secure=secure, samesite="lax")
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/", secure=secure, samesite="lax")


def discord_token_request(form: dict[str, str]) -> dict[str, Any]:
    data = urlencode(form).encode("utf-8")
    req = UrlRequest(
        f"{DISCORD_API_BASE}/oauth2/token",
        data=data,
        headers={
            "content-type": "application/x-www-form-urlencoded",
            "accept": "application/json",
            "user-agent": DISCORD_USER_AGENT,
        },
        method="POST",
    )
    with urlopen(req, timeout=15) as res:
        return json.loads(res.read().decode("utf-8"))


def discord_get_current_user(access_token: str) -> dict[str, Any]:
    req = UrlRequest(
        f"{DISCORD_API_BASE}/users/@me",
        headers={
            "authorization": f"Bearer {access_token}",
            "accept": "application/json",
            "user-agent": DISCORD_USER_AGENT,
        },
    )
    with urlopen(req, timeout=15) as res:
        return json.loads(res.read().decode("utf-8"))


def discord_bot_token() -> str:
    return (os.getenv("DISCORD_BOT_TOKEN") or os.getenv("DISCORD_TOKEN") or "").strip()


def discord_bot_json(method: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    token = discord_bot_token()
    if not token:
        raise ValueError("Discord bot token is not configured")
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = UrlRequest(
        f"{DISCORD_API_BASE}{path}",
        data=body,
        headers={
            "authorization": f"Bot {token}",
            "content-type": "application/json",
            "accept": "application/json",
            "user-agent": DISCORD_BOT_USER_AGENT,
        },
        method=method.upper(),
    )
    with urlopen(req, timeout=15) as res:
        raw = res.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def discord_http_reason(stage: str, ex: HTTPError) -> str:
    status = int(getattr(ex, "code", 0) or 0)
    if stage == "token":
        if status in {400, 401, 403}:
            return "discord_token_rejected"
        return f"discord_token_http_{status}"
    if stage == "user":
        if status in {401, 403}:
            return "discord_user_rejected"
        return f"discord_user_http_{status}"
    return f"discord_http_{status}"


def upsert_discord_user(discord_user: dict[str, Any]) -> sqlite3.Row:
    auth_user = discord_user_to_auth_user(discord_user)
    user_id = auth_user["id"]
    now = int(time.time())
    with auth_db() as conn:
        conn.execute(
            """
            INSERT INTO users (
                id, username, global_name, discriminator, avatar_hash, avatar_url,
                is_admin, is_codes_editor, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                global_name = excluded.global_name,
                discriminator = excluded.discriminator,
                avatar_hash = excluded.avatar_hash,
                avatar_url = excluded.avatar_url,
                is_admin = 0,
                is_codes_editor = 0,
                updated_at = excluded.updated_at
            """,
            (
                user_id,
                auth_user["username"],
                auth_user["global_name"],
                auth_user["discriminator"],
                auth_user["avatar_hash"],
                auth_user["avatar_url"],
                now,
                now,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("Discord user was not saved")
        return row


init_auth_db()


def upstream_json(api_path: str, query: dict[str, Any] | None = None, ttl_sec: int = 30) -> Any | None:
    query = {k: v for k, v in (query or {}).items() if v is not None and str(v) != ""}
    cache_key = api_path.strip("/").replace("/", "__")
    if query:
        cache_key += "__" + urlencode(query).replace("&", "__").replace("=", "-")
    cache_path = LIVE_CACHE_DIR / f"{cache_key}.json"

    now = time.time()
    cached = read_json(cache_path)
    if isinstance(cached, dict) and now - float(cached.get("_cachedAt", 0)) < ttl_sec:
        return cached.get("payload")

    url = UPSTREAM_BASE + api_path
    if query:
        url += "?" + urlencode(query)
    try:
        with urlopen(
            UrlRequest(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 STB-Arab-local/1.0",
                },
            ),
            timeout=15,
        ) as response:
            content_type = response.headers.get("Content-Type", "")
            if "json" not in content_type.lower():
                return None
            payload = json.loads(response.read().decode("utf-8"))
            write_json(cache_path, {"_cachedAt": now, "payload": payload})
            return payload
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
        if isinstance(cached, dict):
            return cached.get("payload")
        return None


EMOJI_RE = re.compile(r"[\U0001F000-\U0001FAFF\u2600-\u27BF]\ufe0f?")


def strip_decorative_emoji(value: Any) -> str:
    text = str(value or "")
    text = EMOJI_RE.sub("", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def sanitize_fn360_map_payload(payload: Any, map_payload: dict[str, Any], requested_code: str) -> dict[str, Any] | None:
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        return None
    d = dict(payload["data"])
    code = str(requested_code or d.get("id") or d.get("code") or map_payload.get("fortniteIslandCode") or "3225-0366-8885").strip()
    d["id"] = d.get("id") or code
    d["code"] = code
    d["name"] = str(d.get("name") or "STEAL THE BRAINROT").strip()
    creator = d.get("creator") if isinstance(d.get("creator"), dict) else {}
    d["owner_name"] = d.get("owner_name") or creator.get("name") or "NOM FeRinS"
    d["owner_code"] = d.get("owner_code") or creator.get("id") or "ferins"
    d["image_url"] = d.get("image_url") or d.get("lobby_background_image_url") or "/assets/fn360-island.jpeg"
    d["lobby_background_image_url"] = d.get("lobby_background_image_url") or d.get("image_url") or "/assets/fn360-lobby.jpeg"
    tags = d.get("tags")
    if isinstance(tags, list) and tags:
        d["tags"] = [tag for tag in (strip_decorative_emoji(x) for x in tags) if tag]
    else:
        d["tags"] = ["simulator", "casual", "tycoon"]
    clean_intro = strip_decorative_emoji(d.get("introduction") or "")
    clean_tagline = strip_decorative_emoji(clean_intro or d.get("tagline") or map_payload.get("fortniteIslandNote") or "")
    d["introduction"] = clean_intro or "BUY ALL BRAINROTS\nSTEAL ULTRA RARE BRAINROTS\nEARN OFFLINE"
    d["tagline"] = clean_tagline or d["introduction"]
    if creator:
        clean_creator = dict(creator)
        clean_creator["lookup_bio"] = strip_decorative_emoji(clean_creator.get("lookup_bio") or "")
        d["creator"] = clean_creator
    return {"success": True, "data": d, "timestamp": payload.get("timestamp") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


def fetch_fn360_map(code: str, map_payload: dict[str, Any]) -> dict[str, Any] | None:
    clean_code = str(code or map_payload.get("fortniteIslandCode") or "3225-0366-8885").strip()
    now = time.time()
    cached = FN360_MAP_CACHE.get("payload")
    if (
        isinstance(cached, dict)
        and FN360_MAP_CACHE.get("code") == clean_code
        and now - float(FN360_MAP_CACHE.get("at") or 0) < FN360_MAP_TTL_SEC
    ):
        return cached
    cache_path = LIVE_CACHE_DIR / f"fn360_map__{clean_code.replace('-', '_')}.json"
    disk_cached = read_json(cache_path)
    try:
        with urlopen(
            UrlRequest(
                f"{FN360_MAP_API_BASE}/{clean_code}?t={int(now * 1000)}",
                headers={
                    "Accept": "application/json",
                    "Cache-Control": "no-cache",
                    "User-Agent": "Mozilla/5.0 STB-Arab-local/1.0",
                },
            ),
            timeout=15,
        ) as response:
            payload = json.loads(response.read().decode("utf-8"))
        cleaned = sanitize_fn360_map_payload(payload, map_payload, clean_code)
        if cleaned:
            FN360_MAP_CACHE.update({"code": clean_code, "at": now, "payload": cleaned})
            write_json(cache_path, {"_cachedAt": now, "payload": cleaned})
            return cleaned
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
        if isinstance(disk_cached, dict):
            cleaned = sanitize_fn360_map_payload(disk_cached.get("payload"), map_payload, clean_code)
            if cleaned:
                return cleaned
    return cached if isinstance(cached, dict) else None


def fallback_fn360_map(request: Request, code: str, map_payload: dict[str, Any]) -> dict[str, Any]:
    clean_code = str(code or map_payload.get("fortniteIslandCode") or "3225-0366-8885").strip()
    origin = local_origin(request)
    return {
        "success": True,
        "data": {
            "code": clean_code,
            "id": clean_code,
            "name": "STEAL THE BRAINROT",
            "owner_name": "NOM FeRinS",
            "owner_code": "ferins",
            "image_url": f"{origin}/assets/fn360-island.jpeg",
            "lobby_background_image_url": f"{origin}/assets/fn360-lobby.jpeg",
            "tags": ["simulator", "casual", "tycoon"],
            "introduction": "BUY ALL BRAINROTS\nSTEAL ULTRA RARE BRAINROTS\nEARN OFFLINE",
            "tagline": "BUY ALL BRAINROTS\nSTEAL ULTRA RARE BRAINROTS\nEARN OFFLINE",
            "lastSyncCcu": None,
            "last_updated": int(time.time()),
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def sanitize_blog_payload(payload: Any) -> Any:
    if not isinstance(payload, dict):
        return payload
    out = dict(payload)
    items = out.get("items")
    if isinstance(items, list):
        cleaned_items = []
        for item in items:
            if not isinstance(item, dict):
                cleaned_items.append(item)
                continue
            clean = dict(item)
            for key in ("title", "subtitle", "excerpt", "body", "content"):
                if isinstance(clean.get(key), str):
                    clean[key] = strip_decorative_emoji(clean[key])
            cleaned_items.append(clean)
        out["items"] = cleaned_items
    return out


def upstream_boot() -> dict[str, Any] | None:
    now = time.time()
    cached = UPSTREAM_BOOT_CACHE.get("payload")
    if isinstance(cached, dict) and now - float(UPSTREAM_BOOT_CACHE.get("at") or 0) < UPSTREAM_BOOT_TTL_SEC:
        return cached
    try:
        with urlopen(
            UrlRequest(
                f"{UPSTREAM_BASE}/events?t={int(now * 1000)}",
                headers={
                    "Accept": "text/html,application/xhtml+xml",
                    "Cache-Control": "no-cache",
                    "User-Agent": "Mozilla/5.0 STB-Arab-local/1.0",
                },
            ),
            timeout=15,
        ) as response:
            html = response.read().decode("utf-8", errors="replace")
        match = re.search(r'<script[^>]+id=["\']stbhub-boot["\'][^>]*>([\s\S]*?)</script>', html, re.I)
        if not match:
            return cached if isinstance(cached, dict) else None
        payload = json.loads(base64.b64decode(match.group(1).strip()).decode("utf-8"))
        if isinstance(payload, dict):
            UPSTREAM_BOOT_CACHE["at"] = now
            UPSTREAM_BOOT_CACHE["payload"] = payload
            return payload
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
        pass
    return cached if isinstance(cached, dict) else None


def iso_from_unix(sec: int) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(sec))


def numeric(value: Any, fallback: float = 0) -> float:
    try:
        n = float(value)
        return n if n == n else fallback
    except (TypeError, ValueError):
        return fallback


def event_key_of(event: dict[str, Any] | None) -> str:
    if not isinstance(event, dict):
        return ""
    return str(event.get("eventKey") or event.get("id") or "").strip()


def spawn_event_id_map(payload: dict[str, Any]) -> dict[str, Any]:
    mapping: dict[str, Any] = {
        "galaxy": 1,
        "rainbow": 2,
        "zombie": 3,
        "lucky_rot": 4,
        "dreamy": 5,
        "fire_ice": 6,
        "carnival": 7,
        "darkness": 8,
        "aqua": 9,
        "halloween": 10,
        "galaxy_dreamy": 11,
        "zombie_fire_ice": 12,
        "neon": 13,
        "new_season": 14,
        "chocolate": 15,
        "christmas": 16,
        "toxic": 17,
        "love": 18,
        "void": 19,
        "heaven": 20,
        "crystal": 21,
        "magical": 22,
        "admin": None,
    }

    def absorb(entry: Any) -> None:
        if not isinstance(entry, dict):
            return
        event = entry.get("event") if isinstance(entry.get("event"), dict) else {}
        key = str(entry.get("eventKey") or event.get("eventKey") or "").strip()
        if key and "spawnEventId" in entry:
            mapping[key] = entry.get("spawnEventId")

    for item in payload.get("current") or []:
        absorb(item)
    for item in payload.get("upcoming") or []:
        absorb(item)
    absorb(payload.get("live"))
    absorb(payload.get("next"))
    schedule = payload.get("schedule") if isinstance(payload.get("schedule"), dict) else {}
    for item in schedule.get("perEvent") or []:
        absorb(item)
    return mapping


def realtime_event_row(event: dict[str, Any], now_sec: int, meta: dict[str, Any]) -> dict[str, Any]:
    key = event_key_of(event)
    enabled = event.get("enabled") is True
    duration_sec = int(numeric(event.get("eventDurationSec"), numeric(meta.get("defaultEventDurationSec"), 1200)))
    official_start = int(numeric(event.get("officialStart"), 0))
    utc_weekday = int(time.strftime("%w", time.gmtime(now_sec)))
    weekend = utc_weekday in {0, 6}
    cycle_sec = int(
        numeric(
            event.get("weekendCycleSec") if weekend else event.get("weekdayCycleSec"),
            numeric(event.get("weekdayCycleSec"), numeric(event.get("weekendCycleSec"), 0)),
        )
    )
    row_event = {**event, "eventKey": key, "id": event.get("id", key)}
    if not enabled or not official_start or not cycle_sec:
        return {
            "active": False,
            "cycleSec": None,
            "durationSec": None,
            "enabled": False,
            "event": row_event,
            "nextStart": None,
            "secondsUntil": None,
        }
    window_start = official_start
    if now_sec >= official_start:
        window_start = official_start + ((now_sec - official_start) // cycle_sec) * cycle_sec
    window_end = window_start + duration_sec
    active = window_start <= now_sec < window_end
    next_start = official_start if now_sec < official_start else window_start + cycle_sec
    return {
        "active": active,
        "cycleSec": cycle_sec,
        "durationSec": duration_sec,
        "enabled": True,
        "event": row_event,
        "nextStart": next_start,
        "secondsUntil": max(0, next_start - now_sec),
        "windowEnd": window_end,
        "windowStart": window_start,
    }


def event_summary(row: dict[str, Any], now_sec: int, spawn_ids: dict[str, Any]) -> dict[str, Any]:
    event = row.get("event") if isinstance(row.get("event"), dict) else {}
    key = event_key_of(event)
    starts_at = row.get("nextStart")
    return {
        "eventKey": key,
        "label": event.get("label") or key,
        "spawnEventId": spawn_ids.get(key),
        "startsAt": starts_at,
        "startsAtIso": iso_from_unix(int(starts_at)) if starts_at else None,
        "secondsUntil": max(0, int(starts_at) - now_sec) if starts_at else None,
        "cycleSec": row.get("cycleSec"),
        "activeNow": row.get("active") is True,
    }


def live_summary(row: dict[str, Any], now_sec: int, spawn_ids: dict[str, Any]) -> dict[str, Any]:
    event = row.get("event") if isinstance(row.get("event"), dict) else {}
    key = event_key_of(event)
    window_start = row.get("windowStart")
    window_end = row.get("windowEnd")
    return {
        "eventKey": key,
        "label": event.get("label") or key,
        "spawnEventId": spawn_ids.get(key),
        "windowStart": window_start,
        "windowEnd": window_end,
        "windowStartIso": iso_from_unix(int(window_start)) if window_start else None,
        "windowEndIso": iso_from_unix(int(window_end)) if window_end else None,
        "secondsRemaining": max(0, int(window_end) - now_sec) if window_end else 0,
        "durationSec": row.get("durationSec"),
        "cycleSec": row.get("cycleSec"),
    }


def realtime_events_payload() -> dict[str, Any]:
    base = (
        data_json("live_cache/api__realtime-events.json", {}).get("payload")
        or data_json("bootstrap.json", {}).get("realtime_events_schedule")
        or api_json("/api/realtime-events/schedule", {"ok": True, "events": [], "schedule": {}})
    )
    if not isinstance(base, dict):
        base = {"ok": True, "events": [], "schedule": {}}
    events = base.get("events") if isinstance(base.get("events"), list) else []
    meta = base.get("meta") if isinstance(base.get("meta"), dict) else {}
    now_sec = int(time.time())
    spawn_ids = spawn_event_id_map(base)
    rows = [realtime_event_row(event, now_sec, meta) for event in events if isinstance(event, dict)]
    rows.sort(key=lambda row: (0 if row.get("enabled") else 1, row.get("secondsUntil") if row.get("secondsUntil") is not None else 10**18))
    active_rows = [row for row in rows if row.get("enabled") and row.get("active")]
    upcoming_rows = [row for row in rows if row.get("enabled")]
    next_row = next((row for row in rows if row.get("enabled") and not row.get("active")), upcoming_rows[0] if upcoming_rows else None)
    live = live_summary(active_rows[0], now_sec, spawn_ids) if active_rows else None
    next_payload = None
    if next_row:
        next_payload = {**event_summary(next_row, now_sec, spawn_ids), "durationSec": next_row.get("durationSec")}
    return {
        "ok": True,
        "nowUnix": now_sec,
        "nowIso": iso_from_unix(now_sec),
        "live": live,
        "current": [live_summary(row, now_sec, spawn_ids) for row in active_rows],
        "next": next_payload,
        "upcoming": [event_summary(row, now_sec, spawn_ids) for row in upcoming_rows],
        "meta": meta,
        "events": events,
        "schedule": {
            "nowUnix": now_sec,
            "nowIso": iso_from_unix(now_sec),
            "live": active_rows[0] if active_rows else None,
            "activeNow": active_rows,
            "upNext": next_row,
            "perEvent": rows,
        },
    }


def admin_machine_live_payload() -> dict[str, Any]:
    now_sec = int(time.time())
    schedule = realtime_events_payload()
    rows = schedule.get("schedule", {}).get("perEvent", [])
    admin_row = next((row for row in rows if event_key_of(row.get("event")) == "admin"), None)
    cached = (
        data_json("live_cache/api__admin-machine.json", {}).get("payload")
        or data_json("bootstrap.json", {}).get("admin_machine_live")
        or api_json("/api/admin-machine/live", {"ok": True})
    )
    cloned = json.loads(json.dumps(cached if isinstance(cached, dict) else {"ok": True}, ensure_ascii=False))
    seconds = max(0, int(admin_row.get("nextStart")) - now_sec) if isinstance(admin_row, dict) and admin_row.get("nextStart") else 0
    cloned["ok"] = True
    cloned["serverTimeSec"] = now_sec
    cloned["at"] = now_sec
    cloned["timeExplicit"] = False
    label = cloned.get("countdown", {}).get("label") if isinstance(cloned.get("countdown"), dict) else "Next rotation starts in"
    cloned["countdown"] = {"label": label or "Next rotation starts in", "seconds": seconds}
    return branded_admin_machine_payload(cloned)


def slugify_name(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "brainrot"


def brainrot_slug(row: dict[str, Any]) -> str:
    explicit = str(row.get("slug") or "").strip()
    if explicit:
        return explicit
    styles = row.get("styles")
    if isinstance(styles, list):
        for style in styles:
            if isinstance(style, dict) and style.get("primary") and style.get("slug"):
                return str(style["slug"]).strip()
        for style in styles:
            if isinstance(style, dict) and style.get("slug"):
                return str(style["slug"]).strip()
    return slugify_name(row.get("name"))


def brainrot_audio_stem(row: dict[str, Any]) -> str:
    raw_sound = str(row.get("sound") or "").strip()
    if raw_sound:
        match = re.search(r"/([^/]+)\.(?:wav|m4a)$", raw_sound, flags=re.I)
        if match:
            return AUDIO_STEM_ALIASES.get(match.group(1).lower(), match.group(1).lower())
    return AUDIO_STEM_ALIASES.get(brainrot_slug(row).lower(), brainrot_slug(row).lower())


def brainrots_catalog() -> list[dict[str, Any]]:
    rows = data_json("brainrots.json", [])
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        row = dict(item)
        row["slug"] = brainrot_slug(row)
        out.append(row)
    return out


def public_brainrot(row: dict[str, Any], rolled_type: str = "default", rolled_traits: list[str] | None = None) -> dict[str, Any]:
    audio_stem = brainrot_audio_stem(row)
    return {
        "id": row.get("id"),
        "slug": brainrot_slug(row),
        "name": row.get("name") or "Fusion Result",
        "rarity": row.get("rarity") or "Secret",
        "incomePerSec": row.get("incomePerSec") or 0,
        "price": row.get("price") or 0,
        "rolledType": rolled_type or "default",
        "rolledTraits": rolled_traits or [],
        "sound": f"/assets/audio/{audio_stem}.wav" if audio_stem else "",
    }


def weighted_choice(labels: list[str], weights: list[Any]) -> tuple[str, float]:
    pairs: list[tuple[str, float]] = []
    for label, weight in zip(labels, weights):
        try:
            w = float(weight)
        except (TypeError, ValueError):
            w = 0
        if w > 0:
            pairs.append((label, w))
    if not pairs:
        return (labels[0] if labels else "Secret", 100)
    total = sum(w for _, w in pairs)
    pick = random.uniform(0, total)
    upto = 0.0
    for label, weight in pairs:
        upto += weight
        if pick <= upto:
            return label, weight
    return pairs[-1]


def resolve_machine_column(column: str, catalog: list[dict[str, Any]]) -> dict[str, Any] | None:
    by_name = {str(row.get("name", "")).strip().lower(): row for row in catalog}
    direct = by_name.get(str(column or "").strip().lower())
    if direct:
        return direct

    reference = data_json("eternal_machine_reference.json", {})
    groups = reference.get("machineGroups") if isinstance(reference, dict) else None
    if isinstance(groups, list):
        for group in groups:
            if not isinstance(group, dict):
                continue
            label = str(group.get("label") or "").strip().lower()
            gid = str(group.get("id") or "").strip().lower()
            col = str(column or "").strip().lower()
            if col != label and col != f"group {gid}":
                continue
            members = [m for m in group.get("members", []) if isinstance(m, str)]
            matches = [by_name[m.strip().lower()] for m in members if m.strip().lower() in by_name]
            if matches:
                return random.choice(matches)

    preferred = [row for row in catalog if str(row.get("rarity") or "").lower() in {"secret", "eternal", "goat"}]
    if preferred:
        return random.choice(preferred)
    return random.choice(catalog) if catalog else None


def choose_machine_type() -> str:
    reference = data_json("eternal_machine_reference.json", {})
    type_rates = reference.get("typeRates") if isinstance(reference, dict) else None
    if not isinstance(type_rates, list):
        return "default"
    labels: list[str] = []
    weights: list[Any] = []
    for item in type_rates:
        if not isinstance(item, dict):
            continue
        slug = str(item.get("slug") or "").strip()
        if not slug:
            continue
        labels.append(slug)
        weights.append(item.get("pct", 0))
    return weighted_choice(labels, weights)[0] if labels else "default"


def choose_machine_tier(total_income: float, rates: dict[str, Any]) -> dict[str, Any] | None:
    tiers = rates.get("tiers") if isinstance(rates, dict) else None
    if not isinstance(tiers, list):
        return None
    best: dict[str, Any] | None = None
    total_ms = total_income / 1_000_000
    for tier in tiers:
        if not isinstance(tier, dict):
            continue
        try:
            minimum = float(tier.get("minIncomeMs", 0))
        except (TypeError, ValueError):
            minimum = 0
        if total_ms >= minimum:
            best = tier
    return best or (tiers[0] if tiers and isinstance(tiers[0], dict) else None)


def branded_admin_machine_payload(payload: Any) -> Any:
    if not isinstance(payload, dict):
        return payload
    cloned = json.loads(json.dumps(payload, ensure_ascii=False))
    meta = cloned.get("meta")
    if not isinstance(meta, dict):
        meta = {}
        cloned["meta"] = meta
    meta["discordInvite"] = "https://discord.gg/stb"
    meta["discordLabel"] = "discord.gg/stb"
    meta["intro"] = "Discord STB-Arab for quick updates and alerts."
    return cloned


@app.get("/api/me")
def api_me(request: Request) -> JSONResponse:
    user = public_user(session_user(request))
    return ok({"ok": True, "user": user, "isAdmin": False, "isCodesEditor": False})


@app.get("/api/auth/discord")
def auth_discord(request: Request) -> RedirectResponse:
    client_id = (os.getenv("DISCORD_CLIENT_ID") or "").strip()
    if not client_id:
        return RedirectResponse(url="/?auth=discord_not_configured")
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": client_id,
        "redirect_uri": discord_redirect_uri(request),
        "response_type": "code",
        "scope": "identify",
        "state": state,
        "prompt": "none",
    }
    response = RedirectResponse(url="https://discord.com/oauth2/authorize?" + urlencode(params))
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=OAUTH_STATE_TTL_SEC,
        httponly=True,
        secure=cookie_secure(request),
        samesite="lax",
        path="/",
    )
    return response


@app.get("/api/auth/discord/callback")
def auth_discord_callback(request: Request, code: str = "", state: str = "") -> RedirectResponse:
    expected_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not code or not state or not expected_state or not secrets.compare_digest(state, expected_state):
        response = RedirectResponse(url="/?auth=discord_state")
        clear_auth_cookies(response, request)
        return response
    client_id = (os.getenv("DISCORD_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("DISCORD_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        response = RedirectResponse(url="/?auth=discord_not_configured")
        clear_auth_cookies(response, request)
        return response
    failure_reason = "unknown"
    try:
        try:
            token_payload = discord_token_request(
                {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": discord_redirect_uri(request),
                }
            )
        except HTTPError as ex:
            failure_reason = discord_http_reason("token", ex)
            raise
        access_token = str(token_payload.get("access_token") or "").strip()
        if not access_token:
            failure_reason = "missing_access_token"
            raise ValueError("Discord did not return an access token")
        try:
            discord_user = discord_get_current_user(access_token)
        except HTTPError as ex:
            failure_reason = discord_http_reason("user", ex)
            raise
        auth_user = discord_user_to_auth_user(discord_user)
        try:
            row = upsert_discord_user(discord_user)
            session_token = create_session(str(row["id"]), row)
        except sqlite3.Error:
            session_token = create_signed_session_for_user(auth_user)
        if not session_token:
            failure_reason = "session_create_failed"
            raise ValueError("Session token was not created")
    except HTTPError:
        response = RedirectResponse(url=f"/?auth=discord_failed&reason={failure_reason}")
        clear_auth_cookies(response, request)
        return response
    except Exception:
        response = RedirectResponse(url=f"/?auth=discord_failed&reason={failure_reason}")
        clear_auth_cookies(response, request)
        return response
    response = RedirectResponse(url="/?auth=discord")
    set_session_cookie(response, request, session_token)
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/", secure=cookie_secure(request), samesite="lax")
    return response


@app.get("/api/auth/logout")
def auth_logout(request: Request) -> RedirectResponse:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with auth_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
    response = RedirectResponse(url="/")
    clear_auth_cookies(response, request)
    return response


@app.api_route("/api/site-users/ping", methods=["GET", "POST"])
def site_users_ping() -> JSONResponse:
    return ok({"ok": True, "local": True, "at": int(time.time())})


@app.get("/api/fn360-map")
def fn360_map(request: Request, code: str = "") -> JSONResponse:
    map_payload = data_json("map.json", {})
    island_code = code or map_payload.get("fortniteIslandCode") or "3225-0366-8885"
    live = fetch_fn360_map(island_code, map_payload)
    return ok(live or fallback_fn360_map(request, island_code, map_payload))


@app.get("/api/traits")
def traits() -> JSONResponse:
    return ok(data_json("traits.json", api_json("/api/traits", {"ok": True, "rows": []})))


@app.get("/api/brainrots")
def brainrots() -> JSONResponse:
    rows: list[dict[str, Any]] = []
    for row in brainrots_catalog():
        item = dict(row)
        item.setdefault("sound", f"/assets/audio/{brainrot_audio_stem(item)}.wav")
        rows.append(item)
    return ok({"ok": True, "brainrots": rows, "items": rows, "count": len(rows)})


@app.get("/api/brainrot-types")
def brainrot_types() -> JSONResponse:
    return ok(data_json("brainrot_types.json", {"ok": True, "types": []}))


@app.get("/api/brainrot-icon-sheets")
def brainrot_icon_sheets() -> JSONResponse:
    return ok(data_json("brainrot_icon_sheets.json", {"ok": True, "sheets": []}))


@app.get("/api/catalog-meta")
def catalog_meta() -> JSONResponse:
    return ok(data_json("catalog_meta.json", {"ok": True}))


@app.get("/api/type-mults")
def type_mults() -> JSONResponse:
    return ok(data_json("type_mults.json", {"ok": True, "types": []}))


@app.get("/api/type-spawn-rates")
def type_spawn_rates() -> JSONResponse:
    return ok(data_json("type_spawn_rates.json", {"ok": True, "types": []}))


@app.get("/api/type-spawn-event-tables")
def type_spawn_event_tables() -> JSONResponse:
    return ok(data_json("type_spawn_event_tables.json", {"ok": True, "events": []}))


@app.get("/api/rarity-spawn-engine")
def rarity_spawn_engine() -> JSONResponse:
    return ok(data_json("rarity_spawn_engine.json", {"ok": True}))


@app.get("/api/gadgets")
def gadgets() -> JSONResponse:
    return ok(data_json("gadgets.json", {"ok": True, "items": []}))


@app.get("/api/map")
def map_data() -> JSONResponse:
    return ok(data_json("map.json", {"ok": True}))


@app.get("/api/site-alerts")
def site_alerts() -> JSONResponse:
    return ok(data_json("site_alerts.json", {"ok": True, "alerts": []}))


@app.get("/api/shop")
def shop() -> JSONResponse:
    return ok(data_json("shop.json", {"ok": True, "items": []}))


@app.get("/api/boxrots")
def boxrots() -> JSONResponse:
    return ok(data_json("boxrots.json", api_json("/api/boxrots", {"ok": True, "levels": []})))


@app.get("/api/wheel")
def wheel() -> JSONResponse:
    return ok(data_json("wheel.json", api_json("/api/wheel", {"ok": True, "items": []})))


def normalize_code_row(row: Any) -> dict[str, str] | None:
    if not isinstance(row, dict):
        return None
    code = str(row.get("code") or "").strip()
    reward = str(row.get("reward") or "").strip()
    if not code:
        return None
    return {"code": code, "reward": reward}


def normalize_codes_state(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        payload = {}
    meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
    return {
        "meta": {
            "headline": str(meta.get("headline") or "STEAL THE BRAINROT CODES"),
            "hint": str(meta.get("hint") or "Click a code to mark it as used"),
        },
        "active": [row for row in (normalize_code_row(x) for x in payload.get("active") or []) if row],
        "expired": [row for row in (normalize_code_row(x) for x in payload.get("expired") or []) if row],
    }


def codes_payload() -> dict[str, Any]:
    override = read_json(CODES_OVERRIDE_PATH)
    if isinstance(override, dict):
        return normalize_codes_state(override)
    return normalize_codes_state(data_json("codes.json", api_json("/api/codes", {"ok": True, "active": []})))


def active_code_set(payload: dict[str, Any]) -> set[str]:
    return {str(row.get("code") or "").strip() for row in payload.get("active", []) if str(row.get("code") or "").strip()}


def subscribed_code_users() -> list[dict[str, str]]:
    try:
        with auth_db() as conn:
            rows = conn.execute(
                """
                SELECT users.id, users.username, users.global_name
                FROM collection_state
                JOIN users ON users.id = collection_state.user_id
                WHERE collection_state.notify_new_codes = 1
                """
            ).fetchall()
    except sqlite3.Error:
        return []
    return [
        {
            "id": str(row["id"] or ""),
            "username": str(row["username"] or ""),
            "global_name": str(row["global_name"] or row["username"] or ""),
        }
        for row in rows
        if str(row["id"] or "").strip()
    ]


def code_notification_message(rows: list[dict[str, str]]) -> str:
    clean = [normalize_code_row(row) for row in rows]
    clean = [row for row in clean if row]
    if not clean:
        return ""
    lines = ["New STB-Arab active code" + ("" if len(clean) == 1 else "s") + ":"]
    for row in clean[:10]:
        reward = f" - {row['reward']}" if row.get("reward") else ""
        lines.append(f"{row['code']}{reward}")
    lines.append("Open STB-Arab: https://stb-arab.vercel.app/codes")
    return "\n".join(lines)


def send_code_dm(user_id: str, content: str) -> None:
    channel = discord_bot_json("POST", "/users/@me/channels", {"recipient_id": str(user_id)})
    channel_id = str(channel.get("id") or "").strip()
    if not channel_id:
        raise ValueError("Discord did not return a DM channel")
    discord_bot_json(
        "POST",
        f"/channels/{channel_id}/messages",
        {"content": content, "allowed_mentions": {"parse": []}},
    )


def notify_code_subscribers(rows: list[dict[str, str]]) -> dict[str, Any]:
    content = code_notification_message(rows)
    users = subscribed_code_users()
    result: dict[str, Any] = {
        "configured": bool(discord_bot_token()),
        "subscribers": len(users),
        "sent": 0,
        "failed": 0,
    }
    if not content or not result["configured"] or not users:
        return result
    for user in users:
        try:
            send_code_dm(user["id"], content)
            result["sent"] += 1
        except Exception:
            result["failed"] += 1
    return result


def track_new_active_codes(payload: dict[str, Any]) -> dict[str, Any]:
    current = sorted(active_code_set(payload))
    seen_state = read_json(CODES_SEEN_PATH, read_json(BUNDLED_CODES_SEEN_PATH, {}))
    seen = set(seen_state.get("active") or []) if isinstance(seen_state, dict) else set()
    if not seen:
        write_json(CODES_SEEN_PATH, {"active": current, "updatedAt": int(time.time())})
        return {"new": [], "notification": {"configured": bool(discord_bot_token()), "sent": 0, "failed": 0}}
    fresh = [row for row in payload.get("active", []) if str(row.get("code") or "").strip() not in seen]
    notification = notify_code_subscribers(fresh) if fresh else {"configured": bool(discord_bot_token()), "sent": 0, "failed": 0}
    write_json(CODES_SEEN_PATH, {"active": current, "updatedAt": int(time.time())})
    return {"new": fresh, "notification": notification}


def request_admin_secret_valid(request: Request) -> bool:
    expected = (os.getenv("CODES_ADMIN_TOKEN") or "").strip()
    if not expected:
        return False
    provided = (request.headers.get("x-stb-admin-token") or request.query_params.get("token") or "").strip()
    return bool(provided) and secrets.compare_digest(provided, expected)


@app.get("/api/codes")
def codes() -> JSONResponse:
    payload = codes_payload()
    track_new_active_codes(payload)
    return ok(payload)


@app.post("/api/codes/notify")
def codes_notify(request: Request, payload: dict[str, Any] | None = Body(default=None)) -> JSONResponse:
    if not request_admin_secret_valid(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    rows = payload.get("codes") if isinstance(payload, dict) else []
    clean = [row for row in (normalize_code_row(x) for x in (rows or [])) if row]
    return ok({"ok": True, "notification": notify_code_subscribers(clean)})


@app.post("/api/codes")
def codes_update(request: Request, payload: dict[str, Any] | None = Body(default=None)) -> JSONResponse:
    if not request_admin_secret_valid(request):
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    body = normalize_codes_state(payload)
    previous = codes_payload()
    old_active = active_code_set(previous)
    write_json(CODES_OVERRIDE_PATH, body)
    fresh = [row for row in body.get("active", []) if str(row.get("code") or "").strip() not in old_active]
    notification = notify_code_subscribers(fresh) if fresh else {"configured": bool(discord_bot_token()), "sent": 0, "failed": 0}
    write_json(CODES_SEEN_PATH, {"active": sorted(active_code_set(body)), "updatedAt": int(time.time())})
    return ok({"ok": True, "codes": body, "newActive": fresh, "notification": notification})


@app.get("/api/luckyrots")
def luckyrots() -> JSONResponse:
    return ok(data_json("luckyrots.json", api_json("/api/luckyrots", {"ok": True, "items": []})))


@app.get("/api/llamarots")
def llamarots() -> JSONResponse:
    return ok(data_json("llamarots.json", api_json("/api/llamarots", {"ok": True, "items": []})))


@app.get("/api/rebirth")
def rebirth() -> JSONResponse:
    return ok(data_json("rebirths.json", api_json("/api/rebirth", {"ok": True, "rows": []})))


@app.get("/api/realtime-events")
@app.get("/api/realtime-events/schedule")
@app.get("/api/events")
def realtime_events() -> JSONResponse:
    boot = upstream_boot()
    if isinstance(boot, dict) and isinstance(boot.get("realtime_events_schedule"), dict):
        return ok(boot["realtime_events_schedule"])
    return ok(realtime_events_payload())


@app.get("/api/admin-machine")
@app.get("/api/admin-machine/live")
def admin_machine() -> JSONResponse:
    boot = upstream_boot()
    if isinstance(boot, dict) and isinstance(boot.get("admin_machine_live"), dict):
        return ok(branded_admin_machine_payload(boot["admin_machine_live"]))
    return ok(admin_machine_live_payload())


@app.post("/api/eternal-machine-fuse")
def eternal_machine_fuse(payload: dict[str, Any] | None = Body(default=None)) -> JSONResponse:
    payload = payload or {}
    rates = data_json("eternal_machine_rates.json", {})
    catalog = brainrots_catalog()
    by_slug = {brainrot_slug(row): row for row in catalog}
    by_id = {row.get("id"): row for row in catalog if row.get("id") is not None}

    slots = payload.get("slots") if isinstance(payload, dict) else []
    total_income = 0.0
    rolled_traits: list[str] = []
    if isinstance(slots, list) and slots:
        for slot in slots:
            if not isinstance(slot, dict):
                continue
            row = None
            if slot.get("id") in by_id:
                row = by_id.get(slot.get("id"))
            if row is None and slot.get("slug"):
                row = by_slug.get(str(slot.get("slug")).strip())
            if row:
                try:
                    total_income += float(row.get("incomePerSec") or 0)
                except (TypeError, ValueError):
                    pass
            for trait in slot.get("traits") or []:
                if isinstance(trait, str) and trait not in rolled_traits and len(rolled_traits) < 3:
                    rolled_traits.append(trait)

    columns = rates.get("columns") if isinstance(rates, dict) else None
    tier = choose_machine_tier(total_income, rates if isinstance(rates, dict) else {})
    if not isinstance(columns, list) or not columns:
        columns = ["Secret"]
    weights = tier.get("weights") if isinstance(tier, dict) else []
    col_name, pct = weighted_choice([str(c) for c in columns], weights if isinstance(weights, list) else [])
    won_row = resolve_machine_column(col_name, catalog)
    rolled_type = choose_machine_type()
    won = public_brainrot(won_row, rolled_type, rolled_traits) if won_row else {
        "slug": "local-fuse-result",
        "name": str(col_name),
        "rarity": "Secret",
        "rolledType": rolled_type,
        "rolledTraits": rolled_traits,
        "sound": "",
    }
    return ok(
        {
            "ok": True,
            "pct": round(pct, 4),
            "colName": col_name,
            "resolvedName": won.get("name") or col_name,
            "tier": tier.get("tier") if isinstance(tier, dict) else None,
            "won": won,
        }
    )


@app.get("/api/blog")
def blog_list() -> JSONResponse:
    live = upstream_json("/api/blog", ttl_sec=60)
    if isinstance(live, dict):
        return ok(sanitize_blog_payload(live))
    return ok(sanitize_blog_payload(api_json("/api/blog", {"ok": True, "items": []})))


@app.get("/api/blog/{post_id}")
def blog_detail(post_id: str) -> JSONResponse:
    payload = sanitize_blog_payload(api_json("/api/blog", {"ok": True, "items": []}))
    for item in payload.get("items", []) if isinstance(payload, dict) else []:
        if str(item.get("id", "")) == post_id:
            return ok({"ok": True, "item": item})
    return ok({"ok": False, "error": "not_found", "item": None})


def ratings_payload() -> dict[str, Any]:
    base = upstream_json("/api/brainrot-ratings", ttl_sec=60) or api_json("/api/brainrot-ratings", {"ok": True, "aggregates": {}})
    local = read_json(LOCAL_STATE_DIR / "ratings.json", {})
    if isinstance(base, dict) and isinstance(local, dict):
        merged = dict(base)
        aggregates = dict(base.get("aggregates") or {})
        aggregates.update(local.get("aggregates") or {})
        merged["aggregates"] = aggregates
        return merged
    return {"ok": True, "aggregates": {}}


@app.get("/api/brainrot-ratings")
def brainrot_ratings_get(slug: str | None = None) -> JSONResponse:
    payload = ratings_payload()
    if slug:
        aggregate = (payload.get("aggregates") or {}).get(slug) or {
            "reactions": {"fire": 0, "love": 0, "poop": 0, "vomit": 0, "flush": 0},
            "score": 0,
            "totalVotes": 0,
        }
        return ok({"ok": True, "aggregate": aggregate, "myReaction": None})
    return ok(payload)


@app.put("/api/brainrot-ratings")
def brainrot_ratings_put(payload: dict[str, Any] | None = Body(default=None)) -> JSONResponse:
    payload = payload or {}
    slug = str(payload.get("slug") or "").strip()
    reaction = str(payload.get("reaction") or "").strip()
    allowed = {"fire", "love", "poop", "vomit", "flush"}
    if not slug or reaction not in allowed:
        return ok({"ok": False, "error": "bad_request"})
    state = read_json(LOCAL_STATE_DIR / "ratings.json", {"aggregates": {}})
    aggregates = state.setdefault("aggregates", {})
    aggregate = aggregates.setdefault(
        slug,
        {"reactions": {"fire": 0, "love": 0, "poop": 0, "vomit": 0, "flush": 0}, "score": 0, "totalVotes": 0},
    )
    aggregate["reactions"][reaction] = int(aggregate["reactions"].get(reaction, 0)) + 1
    aggregate["totalVotes"] = sum(int(v) for v in aggregate["reactions"].values())
    aggregate["score"] = aggregate["reactions"].get("fire", 0) + aggregate["reactions"].get("love", 0) - aggregate["reactions"].get("poop", 0) - aggregate["reactions"].get("vomit", 0)
    write_json(LOCAL_STATE_DIR / "ratings.json", state)
    return ok({"ok": True, "aggregate": aggregate, "myReaction": reaction})


def default_collection() -> dict[str, Any]:
    return {
        "claimed": [],
        "typesDone": {},
        "hideFromOthers": False,
        "notifyNewCodes": False,
    }


def normalize_collection_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    body = default_collection()
    body.update(
        {
            "claimed": payload.get("claimed") if isinstance(payload.get("claimed"), list) else [],
            "typesDone": payload.get("typesDone") if isinstance(payload.get("typesDone"), dict) else {},
            "hideFromOthers": bool(payload.get("hideFromOthers")),
            "notifyNewCodes": bool(payload.get("notifyNewCodes", False)),
        }
    )
    return body


def collection_response(body: dict[str, Any], owner: sqlite3.Row | dict[str, Any] | None = None) -> JSONResponse:
    payload: dict[str, Any] = {"ok": True, "data": body}
    if owner:
        if isinstance(owner, dict):
            payload["ownerName"] = str(owner.get("global_name") or owner.get("username") or "")
        else:
            payload["ownerName"] = str(owner["global_name"] or owner["username"] or "")
    return ok(payload)


@app.get("/api/collection")
def collection_get(request: Request) -> JSONResponse:
    user = session_user(request)
    if not user:
        return JSONResponse({"ok": False, "error": "not_logged_in"}, status_code=401)
    with auth_db() as conn:
        row = conn.execute("SELECT payload FROM collection_state WHERE user_id = ?", (str(user["id"]),)).fetchone()
    body = read_json(LOCAL_STATE_DIR / "collection.json", default_collection()) if not row else read_json_from_text(row["payload"], default_collection())
    return collection_response(normalize_collection_payload(body), user)


@app.put("/api/collection")
@app.post("/api/collection")
def collection_put(request: Request, payload: dict[str, Any] | None = Body(default=None)) -> JSONResponse:
    user = session_user(request)
    if not user:
        return JSONResponse({"ok": False, "error": "not_logged_in"}, status_code=401)
    body = normalize_collection_payload(payload)
    now = int(time.time())
    with auth_db() as conn:
        conn.execute(
            """
            INSERT INTO collection_state (user_id, payload, hide_from_others, notify_new_codes, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                payload = excluded.payload,
                hide_from_others = excluded.hide_from_others,
                notify_new_codes = excluded.notify_new_codes,
                updated_at = excluded.updated_at
            """,
            (
                str(user["id"]),
                json.dumps(body, ensure_ascii=False, sort_keys=True),
                1 if body.get("hideFromOthers") else 0,
                1 if body.get("notifyNewCodes") else 0,
                now,
            ),
        )
        conn.commit()
    return collection_response(body, user)


@app.get("/api/share/{share_id}")
def collection_share(share_id: str) -> JSONResponse:
    with auth_db() as conn:
        row = conn.execute(
            """
            SELECT collection_state.payload, collection_state.hide_from_others, users.*
            FROM collection_state
            JOIN users ON users.id = collection_state.user_id
            WHERE collection_state.user_id = ?
            """,
            (share_id,),
        ).fetchone()
    if not row:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    if int(row["hide_from_others"] or 0):
        return JSONResponse({"ok": False, "error": "private"}, status_code=403)
    body = normalize_collection_payload(read_json_from_text(row["payload"], default_collection()))
    payload = {"ok": True, "data": body, "shareId": share_id, "ownerName": str(row["global_name"] or row["username"] or "")}
    return ok(payload)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def api_fallback(path: str, request: Request) -> JSONResponse:
    api_path = f"/api/{path}".rstrip("/")
    payload = api_json(api_path)
    if payload is not None:
        return ok(payload)
    return ok({"ok": True, "mocked": True, "path": api_path, "method": request.method})


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
def static_or_spa(full_path: str) -> FileResponse:
    target = (ROOT / full_path).resolve() if full_path else ROOT / "index.html"
    if target.is_file() and ROOT in target.parents:
        return FileResponse(target)
    if Path(full_path).suffix:
        return PlainTextResponse("Not found", status_code=404)
    return FileResponse(ROOT / "index.html")
