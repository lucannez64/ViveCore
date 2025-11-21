import json
import os
import re
import time
import urllib.parse
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests
from requests import Response, Session
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter


BASE_URL = "https://op.gg/supervive/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
)


_XSRF_REGEX = re.compile(r"XSRF-TOKEN=([^;]+)")
_CACHE_PATH = os.path.join(os.path.dirname(__file__), ".supervive_cache.json")


def _now() -> float:
    return time.time()


class DiskCache:
    """Simple disque cache avec expirations absolues ou glissantes.

    Structure JSON:
    {
        key: {
            "value": Any,
            "expires_at": float timestamp,
            "sliding": bool,
            "sliding_ttl": float seconds
        }
    }
    """

    def __init__(self, path: str):
        self.path = path
        self._data: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if os.path.exists(self.path):
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except Exception:
                self._data = {}

    def _save(self) -> None:
        tmp = f"{self.path}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f)
        os.replace(tmp, self.path)

    def get(self, key: str) -> Optional[Any]:
        item = self._data.get(key)
        if not item:
            return None
        expires_at = item.get("expires_at", 0)
        if _now() >= expires_at:
            self._data.pop(key, None)
            self._save()
            return None
        if item.get("sliding"):
            # refresh sliding expiration
            ttl = float(item.get("sliding_ttl", 0))
            if ttl > 0:
                item["expires_at"] = _now() + ttl
                self._save()
        return item.get("value")

    def set_absolute(self, key: str, value: Any, ttl_seconds: float) -> None:
        self._data[key] = {
            "value": value,
            "expires_at": _now() + ttl_seconds,
            "sliding": False,
            "sliding_ttl": 0,
        }
        self._save()

    def set_sliding(self, key: str, value: Any, ttl_seconds: float) -> None:
        self._data[key] = {
            "value": value,
            "expires_at": _now() + ttl_seconds,
            "sliding": True,
            "sliding_ttl": ttl_seconds,
        }
        self._save()


def _build_session_with_retry(total_timeout_seconds: int = 180) -> Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # Configurer retries similaires (grossièrement) à la résilience .NET
    retry = Retry(
        total=15,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "POST"),
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    # On gère les timeouts par appel via paramètres
    session._total_timeout = total_timeout_seconds  # type: ignore[attr-defined]
    return session


def _build_no_retry_session(request_timeout_seconds: int = 15) -> Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    session._request_timeout = request_timeout_seconds  # type: ignore[attr-defined]
    return session


@dataclass
class DataResponse:
    data: Any


class SuperviveService:
    def __init__(self) -> None:
        self.base_url = BASE_URL.rstrip("/") + "/"
        self.client = _build_session_with_retry()
        self.no_retry_client = _build_no_retry_session()
        self.cache = DiskCache(_CACHE_PATH)

    def _url(self, path: str) -> str:
        return urllib.parse.urljoin(self.base_url, path)

    def _get(self, path: str, params: Optional[Dict[str, str]] = None) -> Response:
        timeout = getattr(self.client, "_total_timeout", 180)
        return self.client.get(self._url(path), params=params, timeout=timeout)

    def _get_no_retry(self, path: str, params: Optional[Dict[str, str]] = None) -> Response:
        timeout = getattr(self.no_retry_client, "_request_timeout", 15)
        return self.no_retry_client.get(self._url(path), params=params, timeout=timeout)

    def _post_no_retry(self, path: str, headers: Optional[Dict[str, str]] = None) -> Response:
        timeout = getattr(self.no_retry_client, "_request_timeout", 15)
        return self.no_retry_client.post(self._url(path), headers=headers, timeout=timeout)

    # --- Méthodes publiques ---

    def check_player_exists(self, platform: str, unique_display_name: str) -> bool:
        res = self._get(
            "api/players/check",
            params={"platform": platform, "uniqueDisplayName": unique_display_name},
        )
        res.raise_for_status()
        payload = res.json()
        exists = payload.get("exists") or payload.get("Exists")
        if exists is None:
            raise ValueError("data is null or missing 'exists'")
        return bool(exists)

    def search_players(self, query: str, use_cache: bool = True) -> List[Dict[str, Any]]:
        key = f"search:{query}"
        if use_cache:
            cached = self.cache.get(key)
            if cached is not None:
                return cached

        res = self._get("api/players/search", params={"query": query})
        res.raise_for_status()
        data = res.json()

        # Expiration absolue 7 jours
        self.cache.set_absolute(key, data, ttl_seconds=7 * 24 * 3600)
        return data

    def get_match(self, platform: str, match_id: str) -> List[Dict[str, Any]]:
        key = f"match:{platform}:{match_id}"
        cached = self.cache.get(key)
        if cached is not None:
            return cached

        res = self._get(f"api/matches/{platform}-{match_id}")
        res.raise_for_status()
        data = res.json()

        # Expiration glissante 15 jours
        self.cache.set_sliding(key, data, ttl_seconds=15 * 24 * 3600)
        return data

    def get_player_matches(self, platform: str, player_id: str, page: int = 1) -> Dict[str, Any]:
        normalized = player_id.replace("-", "")
        res = self._get(f"api/players/{platform}-{normalized}/matches", params={"page": str(page)})
        res.raise_for_status()
        data = res.json()
        if data is None:
            raise ValueError("data is null")
        return data

    def get_player_matches_pages(self, platform: str, player_id: str, pages: int = 20) -> List[Dict[str, Any]]:
        """Récupère jusqu'à `pages` pages de matchs pour un joueur.
        S'arrête plus tôt si l'API n'a plus de données.
        """
        all_items: List[Dict[str, Any]] = []
        current_page = 1
        last_page = None
        while current_page <= pages:
            payload = self.get_player_matches(platform, player_id, page=current_page)
            items = payload.get("data", []) if isinstance(payload, dict) else []
            all_items.extend(items)
            meta = payload.get("meta") if isinstance(payload, dict) else None
            if meta:
                last_page = int(meta.get("last_page") or meta.get("lastPage") or 0)
                if last_page and current_page >= last_page:
                    break
            if not items:
                break
            current_page += 1
        return all_items

    def _get_xsrf_token(self, platform: str, player_id: str) -> str:
        normalized = player_id.replace("-", "")
        res = self._get_no_retry(f"api/players/{platform}-{normalized}/matches", params={"page": "1"})

        # Lire les en-têtes Set-Cookie
        cookies = res.headers.get("Set-Cookie")
        if not cookies:
            # Certaines implémentations renvoient multiples en-têtes; requests les concatène parfois
            cookies_list = res.raw.headers.getlist("Set-Cookie") if hasattr(res.raw.headers, "getlist") else []
        else:
            cookies_list = [cookies]

        for cookie_header in cookies_list:
            if "XSRF-TOKEN=" not in cookie_header:
                continue
            m = _XSRF_REGEX.search(cookie_header)
            if m:
                return urllib.parse.unquote(m.group(1))
        raise RuntimeError("Could not find correct cookie property")

    def fetch_new_player_matches(self, platform: str, player_id: str) -> Dict[str, Any]:
        csrf = self._get_xsrf_token(platform, player_id)
        normalized = player_id.replace("-", "")
        headers = {"X-XSRF-TOKEN": csrf}
        res = self._post_no_retry(f"api/players/{platform}-{normalized}/matches/fetch", headers=headers)

        content_type = res.headers.get("Content-Type", "")
        if ("text/html" in content_type) or (not content_type):
            raise RuntimeError("Invalid player id or XSRF Token")

        payload = res.json()
        if payload is None:
            raise ValueError("data is null")
        return payload


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="SuperviveService standalone script")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_check = sub.add_parser("check", help="Vérifie l'existence d'un joueur")
    p_check.add_argument("platform")
    p_check.add_argument("unique_display_name")

    p_search = sub.add_parser("search", help="Recherche des joueurs")
    p_search.add_argument("query")

    p_match = sub.add_parser("match", help="Récupère un match public")
    p_match.add_argument("platform")
    p_match.add_argument("match_id")

    p_pm = sub.add_parser("player_matches", help="Récupère les matchs d'un joueur")
    p_pm.add_argument("platform")
    p_pm.add_argument("player_id")
    p_pm.add_argument("--page", type=int, default=1)

    p_fetch = sub.add_parser("fetch_new", help="Déclenche la récupération de nouveaux matchs d'un joueur")
    p_fetch.add_argument("platform")
    p_fetch.add_argument("player_id")

    p_stats = sub.add_parser("placement_stats", help="Génère un graphique des placements sur les dernières pages")
    p_stats.add_argument("platform")
    p_stats.add_argument("player_id")
    p_stats.add_argument("--pages", type=int, default=20)
    p_stats.add_argument("--out", type=str, default="placement_stats.png")

    p_kd = sub.add_parser("combat_stats", help="Statistiques kills/deaths sur plusieurs pages et par chasseur")
    p_kd.add_argument("platform")
    p_kd.add_argument("player_id")
    p_kd.add_argument("--pages", type=int, default=20)
    p_kd.add_argument("--out", type=str, default="combat_stats.png")

    # --- Nouvelle commande: mmr_rating ---
    p_mmr = sub.add_parser("mmr_rating", help="Récupère le MMR rank via OAuth + appel MMR")
    p_mmr.add_argument("platform_token", help="Jeton plateforme (ex: Steam) pour l'OAuth")
    p_mmr.add_argument("client_basic", help="En-tête Authorization Basic (client id:secret encodé base64)")
    p_mmr.add_argument("flight_id", help="Identifiant de vol (x-flight-id / additionalData)")
    p_mmr.add_argument("device_token", help="Valeur du cookie device-token")
    p_mmr.add_argument("--namespace", default="loki")
    p_mmr.add_argument("--game_client_version", default="1.0.0.0")
    p_mmr.add_argument("--sdk_version", default="26.1.0")
    p_mmr.add_argument("--oauth_base", default="https://accounts.projectloki.theorycraftgames.com")
    p_mmr.add_argument("--mmr_base", default="https://mmr-jx-prod.prodcluster.awsinfra.theorycraftgames.com")
    p_mmr.add_argument("--mmr_client_version", default="release2.0.live-154144-shipping")

    # --- Nouvelle commande: mmr_rating_v3 (flux password grant) ---
    p_mmr_v3 = sub.add_parser("mmr_rating_v3", help="Récupère le MMR rank via OAuth v3 (grant_type=password)")
    p_mmr_v3.add_argument("--username", required=True, help="Nom d'utilisateur (email)")
    p_mmr_v3.add_argument("--password", required=True, help="Mot de passe")
    p_mmr_v3.add_argument("--client_id", required=True, help="Client ID OAuth pour le mot de passe")
    p_mmr_v3.add_argument("--oauth_url", default="https://oauth.theorycraftgames.com/iam/v3/oauth/token", help="URL du token OAuth v3")
    p_mmr_v3.add_argument("--mmr_base", default="https://mmr-jx-prod.prodcluster.awsinfra.theorycraftgames.com")
    p_mmr_v3.add_argument("--mmr_client_version", default="release2.0.live-154144-shipping")

    # --- Nouvelle commande: mmr_correlation ---
    p_corr = sub.add_parser("mmr_correlation", help="Corrèle RatingDelta avec stats de match")
    p_corr.add_argument("platform")
    p_corr.add_argument("player_id")
    p_corr.add_argument("--pages", type=int, default=50)
    p_corr.add_argument("--mmr_json", required=True, help="Chemin du JSON MMR (sortie mmr_rating)")
    p_corr.add_argument("--out", type=str, default="mmr_correlation.png")

    # --- Nouvelle commande: jin_builds_details ---
    p_jin2 = sub.add_parser("jin_builds_details", help="Placement vs builds/abilities pour Jin (avec fetch détails match)")
    p_jin2.add_argument("platform")
    p_jin2.add_argument("player_id")
    p_jin2.add_argument("--pages", type=int, default=50)
    p_jin2.add_argument("--out", type=str, default="jin_builds.png")
    p_jin2.add_argument("--min_n", type=int, default=4, help="Taille minimale d'échantillon par build (défaut 4)")

    args = parser.parse_args()
    svc = SuperviveService()

    if args.cmd == "check":
        print(json.dumps({"exists": svc.check_player_exists(args.platform, args.unique_display_name)}, ensure_ascii=False))
    elif args.cmd == "search":
        print(json.dumps(svc.search_players(args.query), ensure_ascii=False))
    elif args.cmd == "match":
        print(json.dumps(svc.get_match(args.platform, args.match_id), ensure_ascii=False))
    elif args.cmd == "player_matches":
        raw = svc.get_player_matches(args.platform, args.player_id, page=args.page)
        items = raw.get("data", []) if isinstance(raw, dict) else []
        simplified = []
        for it in items:
            hero = it.get("hero") or {}
            simplified.append({
                "placement": it.get("placement"),
                "hunter": {
                    "name": hero.get("name"),
                    "image_url": hero.get("head_image_url") or hero.get("image_url")
                }
            })
        print(json.dumps(simplified, ensure_ascii=False))
    elif args.cmd == "fetch_new":
        print(json.dumps(svc.fetch_new_player_matches(args.platform, args.player_id), ensure_ascii=False))
    elif args.cmd == "placement_stats":
        try:
            import matplotlib
            matplotlib.use("Agg")  # rendu hors écran
            import matplotlib.pyplot as plt
        except Exception as e:
            raise SystemExit(f"matplotlib requis: pip install matplotlib\n{e}")

        items = svc.get_player_matches_pages(args.platform, args.player_id, pages=args.pages)
        # Inverser pour que l'axe X progresse du plus ancien au plus récent
        items = list(reversed(items))
        # Ne garder que les parties classées de la file par défaut
        items = [it for it in items if (it.get("queue_id") == "default") and (it.get("is_ranked") is True)]
        placements = [it.get("placement") for it in items if isinstance(it.get("placement"), int)]
        if not placements:
            raise SystemExit("Aucun placement trouvé")

        # Préparer les stats
        n = len(placements)
        xs = list(range(1, n + 1))
        # moyenne mobile sur 10 parties
        window = 10
        rolling = []
        for i in range(n):
            start = max(0, i - window + 1)
            subset = placements[start : i + 1]
            rolling.append(sum(subset) / len(subset))

        fig, axes = plt.subplots(2, 2, figsize=(12, 8))

        # 1) Histogramme distribution des placements
        axes[0, 0].hist(placements, bins=range(1, max(placements) + 2), edgecolor="black", align="left")
        axes[0, 0].set_title("Distribution des placements")
        axes[0, 0].set_xlabel("Placement")
        axes[0, 0].set_ylabel("Fréquence")
        axes[0, 0].set_xticks(range(1, max(placements) + 1))

        # 2) Série temporelle placements
        axes[0, 1].plot(xs, placements, marker="o", linewidth=1, label="Placement")
        axes[0, 1].plot(xs, rolling, color="red", linewidth=2, label=f"Moyenne mobile ({window})")
        axes[0, 1].invert_yaxis()  # 1 est meilleur
        axes[0, 1].set_title("Placement au fil des parties")
        axes[0, 1].set_xlabel("Partie")
        axes[0, 1].set_ylabel("Placement (plus bas est meilleur)")
        axes[0, 1].legend()

        # 3) Boîte à moustaches
        axes[1, 0].boxplot(placements, vert=True, labels=["Placement"])
        axes[1, 0].invert_yaxis()
        axes[1, 0].set_title("Répartition des placements")

        # 4) Courbe cumulée de la moyenne (performance globale)
        cumulative_avg = []
        running_sum = 0
        for i, v in enumerate(placements, start=1):
            running_sum += v
            cumulative_avg.append(running_sum / i)
        axes[1, 1].plot(xs, cumulative_avg, color="green", linewidth=2)
        axes[1, 1].invert_yaxis()
        axes[1, 1].set_title("Moyenne cumulée du placement")
        axes[1, 1].set_xlabel("Partie")
        axes[1, 1].set_ylabel("Moy. cumulée (plus bas est meilleur)")

        fig.tight_layout()
        fig.savefig(args.out, dpi=150)
        print(json.dumps({"output": args.out, "games": n}, ensure_ascii=False))
    elif args.cmd == "combat_stats":
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
        except Exception as e:
            raise SystemExit(f"matplotlib requis: pip install matplotlib\n{e}")

        items = svc.get_player_matches_pages(args.platform, args.player_id, pages=args.pages)
        if not items:
            raise SystemExit("Aucune partie trouvée")

        # Inverser pour que l'axe X progresse du plus ancien au plus récent
        items = list(reversed(items))
        # Ne garder que les parties classées de la file par défaut
        items = [it for it in items if (it.get("queue_id") == "default") and (it.get("is_ranked") is True)]

        # Extraire séries temporelles K/D et par chasseur
        kills_series = []
        deaths_series = []
        hunter_kills: Dict[str, int] = {}
        hunter_deaths: Dict[str, int] = {}

        for it in items:
            stats = it.get("stats") or {}
            k = stats.get("Kills")
            d = stats.get("Deaths")
            # Valeurs par défaut à 0 si non présents
            k = int(k) if isinstance(k, (int, float)) else 0
            d = int(d) if isinstance(d, (int, float)) else 0
            kills_series.append(k)
            deaths_series.append(d)
            hero = (it.get("hero") or {}).get("name") or (it.get("hero") or {}).get("asset_id") or "unknown"
            hunter_kills[hero] = hunter_kills.get(hero, 0) + k
            # Ajustement KD par chasseur: si D == 0 et K > 0, compter D = 1 pour l'agrégation
            adjusted_d = d if d > 0 else (1 if k > 0 else 0)
            hunter_deaths[hero] = hunter_deaths.get(hero, 0) + d

        n = len(kills_series)
        xs = list(range(1, n + 1))

        # KD ratio global et par chasseur
        total_k = sum(kills_series)
        total_d = sum(deaths_series)
        kd_global = (total_k / total_d) if total_d > 0 else float("inf") if total_k > 0 else 0.0

        hunters = sorted(set(list(hunter_kills.keys()) + list(hunter_deaths.keys())))
        hunter_kd = {
            h: (hunter_kills.get(h, 0) / hunter_deaths.get(h, 0)) if hunter_deaths.get(h, 0) > 0 else hunter_kills.get(h, 0) if hunter_kills.get(h, 0) > 0 else 0.0
            for h in hunters
        }

        # Améliorations de présentation (style, robustesse, annotations)
        try:
            import numpy as np
            import seaborn as sns
            from matplotlib.ticker import MaxNLocator, FormatStrFormatter
        except Exception as e:
            raise SystemExit(f"numpy et seaborn requis: pip install numpy seaborn\n{e}")

        sns.set_theme(style="whitegrid", context="talk")
        plt.rcParams.update({
            "figure.dpi": 150,
            "savefig.dpi": 200,
            "font.family": "DejaVu Sans",
            "axes.titlelocation": "left",
            "axes.titleweight": "bold",
        })

        # Préparer KD avec gestion des infinis (0 morts)
        kd_series: List[float] = []
        is_inf: List[bool] = []
        for k, d in zip(kills_series, deaths_series):
            if d > 0:
                kd_series.append(k / d)
                is_inf.append(False)
            else:
                if k > 0:
                    kd_series.append(np.nan)
                    is_inf.append(True)
                else:
                    kd_series.append(0.0)
                    is_inf.append(False)

        kd_arr = np.array(kd_series, dtype=float)

        # Médiane glissante
        window = 10
        roll_med: List[float] = []
        for i in range(len(kd_arr)):
            s = max(0, i - window + 1)
            win = kd_arr[s : i + 1]
            win = win[~np.isnan(win)]
            if win.size == 0:
                roll_med.append(np.nan)
            else:
                roll_med.append(float(np.median(win)))
        roll_med = np.array(roll_med)

        # Plafond y via quantile 95e pour lisibilité
        finite_vals = kd_arr[~np.isnan(kd_arr)]
        if finite_vals.size:
            y_max = float(np.clip(np.quantile(finite_vals, 0.95), 2.0, 6.0))
        else:
            y_max = 2.0

        # Figure 1x2
        fig, axes = plt.subplots(1, 2, figsize=(14, 7), gridspec_kw={"width_ratios": [1.3, 1]})
        ax0, ax1 = axes

        # 1) KD par partie + médiane glissante, avec marquage des infinis
        ax0.plot(xs, kd_arr, color=sns.color_palette("colorblind")[6], linewidth=1.3, label="KD par partie")
        ax0.plot(xs, roll_med, color="black", linewidth=2.2, label=f"Médiane glissante ({window})")
        inf_x = [x for x, flag in zip(xs, is_inf) if flag]
        if inf_x:
            ax0.scatter(inf_x, [y_max * 0.98] * len(inf_x), marker="^", s=50, color="#d62728", label="KD = ∞ (0 morts)")

        # Points rognés (> y_max) en semi-transparence au plafond
        mask_hi = (~np.isnan(kd_arr)) & (kd_arr > y_max)
        if np.any(mask_hi):
            ax0.scatter(np.array(xs)[mask_hi], np.full(mask_hi.sum(), y_max * 0.995), s=18, color="#e377c2", alpha=0.5, zorder=3, label="KD > limite (rogné)")

        ax0.set_title("KD par partie")
        ax0.set_xlabel("Partie")
        ax0.set_ylabel("KD")
        ax0.set_ylim(0, y_max)
        ax0.yaxis.set_major_locator(MaxNLocator(nbins=6, prune="upper"))
        ax0.yaxis.set_major_formatter(FormatStrFormatter("%.1f"))
        ax0.axhline(1.0, color="#777", lw=1, ls="--", alpha=0.6)
        ax0.grid(True, which="major", alpha=0.25)
        ax0.legend(frameon=False, loc="upper right")

        subtitle = (
            f"Total: {total_k} kills / {total_d} deaths • KD global: "
            + ("∞" if np.isinf(kd_global) else f"{kd_global:.2f}")
            + f" • N={n}"
        )
        ax0.text(0.01, 1.02, subtitle, transform=ax0.transAxes, fontsize=10, color="#555")

        # 2) KD par chasseur trié; gris si <5 parties, labels au-dessus
        min_games = 5
        hunters_sorted = sorted(hunters, key=lambda h: hunter_kd.get(h, 0.0), reverse=True)
        kd_vals = [hunter_kd.get(h, 0.0) for h in hunters_sorted]
        counts = [sum(1 for it in items if ((it.get("hero") or {}).get("name") or (it.get("hero") or {}).get("asset_id") or "unknown") == h) for h in hunters_sorted]

        colors = ["#4daf4a" if c >= min_games else "#bdbdbd" for c in counts]
        bars = ax1.bar(hunters_sorted, kd_vals, color=colors)
        ax1.set_title("KD par chasseur (trié)")
        ax1.set_ylabel("KD")
        if len(kd_vals) > 0:
            max_kd = float(np.nanmax(kd_vals)) if not all(np.isinf(v) for v in kd_vals) else max([v for v in kd_vals if not np.isinf(v)] + [1.0])
        else:
            max_kd = 1.0
        ax1.set_ylim(0, max(1.0, max_kd * 1.15))
        ax1.tick_params(axis="x", labelrotation=35)
        ax1.yaxis.set_major_formatter(FormatStrFormatter("%.2f"))
        ax1.axhline(1.0, color="#777", lw=1, ls="--", alpha=0.6)
        ax1.margins(x=0.02)
        for lbl in ax1.get_xticklabels():
            lbl.set_horizontalalignment('right')

        for rect, v in zip(bars, kd_vals):
            ax1.text(rect.get_x() + rect.get_width() / 2, (0 if np.isinf(v) else v) + 0.02, "∞" if np.isinf(v) else f"{v:.2f}", ha="center", va="bottom", fontsize=9)

        from matplotlib.patches import Patch
        legend_patches = [Patch(color="#4daf4a", label=f"≥ {min_games} parties"), Patch(color="#bdbdbd", label=f"< {min_games} parties")]
        ax1.legend(handles=legend_patches, frameon=False, loc="upper right")

        # Mise en page et export
        player_note = f"Export: {args.platform}:{args.player_id}"
        fig.suptitle("Performance K/D", x=0.06, ha="left")
        fig.text(0.01, 0.01, player_note, fontsize=9, color="#666")
        fig.tight_layout()
        fig.subplots_adjust(top=0.90)
        fig.savefig(args.out, dpi=220, bbox_inches="tight", facecolor="white")
        try:
            if isinstance(args.out, str) and args.out.lower().endswith(".png"):
                fig.savefig(args.out[:-4] + ".pdf", bbox_inches="tight")
        except Exception:
            pass

        fig.tight_layout()
        fig.savefig(args.out, dpi=150)

        # --- Nouvelle figure: Kills par partie (avec moyenne glissante) et Kills par chasseur ---
        # Calcul moyenne glissante simple (fenêtre 10)
        k_window = 10
        rolling_kills: List[float] = []
        for i in range(n):
            s = max(0, i - k_window + 1)
            subset = kills_series[s : i + 1]
            rolling_kills.append(sum(subset) / len(subset) if subset else 0.0)

        # Préparer tri des kills par chasseur (par moyenne de kills par partie)
        # Calculer le nombre de parties par chasseur
        hunter_games: Dict[str, int] = {}
        for it in items:
            hero_name = (it.get("hero") or {}).get("name") or (it.get("hero") or {}).get("asset_id") or "unknown"
            hunter_games[hero_name] = hunter_games.get(hero_name, 0) + 1

        def _avg_kills(h: str) -> float:
            games = hunter_games.get(h, 0)
            return (hunter_kills.get(h, 0) / games) if games > 0 else 0.0

        hunters_by_kills = sorted(hunters, key=lambda h: _avg_kills(h), reverse=True)
        kills_vals = [_avg_kills(h) for h in hunters_by_kills]

        fig2, axes2 = plt.subplots(1, 2, figsize=(14, 7), gridspec_kw={"width_ratios": [1.3, 1]})
        axk0, axk1 = axes2

        # 1) Kills par partie + moyenne glissante
        axk0.plot(xs, kills_series, color="#1f77b4", linewidth=1.3, marker="o", markersize=3, label="Kills par partie")
        axk0.plot(xs, rolling_kills, color="#d62728", linewidth=2.0, label=f"Moyenne glissante ({k_window})")
        axk0.set_title("Kills par partie")
        axk0.set_xlabel("Partie")
        axk0.set_ylabel("Kills")
        axk0.grid(True, which="major", alpha=0.25)
        axk0.legend(frameon=False, loc="upper right")

        # 2) Kills par chasseur (trié)
        bars_k = axk1.bar(hunters_by_kills, kills_vals, color="#4daf4a")
        axk1.set_title("Kills par chasseur (trié)")
        axk1.set_ylabel("Moyenne de kills par game")
        axk1.tick_params(axis="x", labelrotation=35)
        axk1.margins(x=0.02)
        # Ajouter labels au-dessus des barres (si peu d'items, pour lisibilité)
        max_bars_labels = 30
        if len(bars_k) <= max_bars_labels:
            for rect, v in zip(bars_k, kills_vals):
                axk1.text(rect.get_x() + rect.get_width() / 2, v + max(0.02, v * 0.01), f"{v:.2f}", ha="center", va="bottom", fontsize=9)

        fig2.tight_layout()
        try:
            out2 = args.out
            if isinstance(out2, str) and out2.lower().endswith(".png"):
                out2 = out2[:-4] + "_kills.png"
            else:
                out2 = (out2 or "combat_stats") + ".kills.png"
            fig2.savefig(out2, dpi=200, bbox_inches="tight", facecolor="white")
        except Exception:
            pass

        # Résumé JSON: global + top 5 chasseurs par KD (min 5 parties jouées si possible)
        hunter_counts: Dict[str, int] = {}
        for it in items:
            hero = (it.get("hero") or {}).get("name") or (it.get("hero") or {}).get("asset_id") or "unknown"
            hunter_counts[hero] = hunter_counts.get(hero, 0) + 1

        # Filtre min games = 5 si possible, sinon prendre tous
        eligible = [h for h in hunters if hunter_counts.get(h, 0) >= 5]
        if not eligible:
            eligible = hunters

        top_by_kd = sorted(eligible, key=lambda h: (hunter_kd.get(h, 0.0)), reverse=True)[:5]
        summary = {
            "output": args.out,
            "games": n,
            "global": {"kills": total_k, "deaths": total_d, "kd": kd_global},
            "top_hunters_by_kd": [
                {
                    "hunter": h,
                    "games": hunter_counts.get(h, 0),
                    "kills": hunter_kills.get(h, 0),
                    "deaths": hunter_deaths.get(h, 0),
                    "kd": hunter_kd.get(h, 0.0),
                }
                for h in top_by_kd
            ],
        }
        print(json.dumps(summary, ensure_ascii=False))
    elif args.cmd == "mmr_rating":
        # 1) OAuth: échanger platform_token contre access_token
        oauth_url = args.oauth_base.rstrip("/") + "/iam/v4/oauth/platforms/steam/token"
        params = {"createHeadless": "false"}
        headers = {
            "Authorization": f"Basic {args.client_basic}",
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "x-flight-id": args.flight_id,
            "Namespace": args.namespace,
            "Game-Client-Version": args.game_client_version,
            "AccelByte-SDK-Version": args.sdk_version,
            "User-Agent": "Loki/UE5-CL-0 (http-legacy) Windows/10.0.26100.1.256.64bit",
        }
        form = {
            "platform_token": args.platform_token,
            "createHeadless": "false",
            "macAddress": args.device_token,
            "additionalData": json.dumps({"flightId": args.flight_id}),
        }
        sess = requests.Session()
        oauth_res = sess.post(oauth_url, params=params, headers=headers, data=form, cookies={"device-token": args.device_token}, timeout=60)
        oauth_res.raise_for_status()
        oauth_payload = oauth_res.json()
        access_token = oauth_payload.get("access_token")
        user_id = oauth_payload.get("user_id")
        if not access_token:
            raise SystemExit("OAuth: access_token manquant dans la réponse")
        if not user_id:
            # Tentative de fallback via champ 'user_id' manquant: certains tokens l'encodent, mais on exige ici l'ID
            raise SystemExit("OAuth: user_id manquant dans la réponse (spécifiez un flux qui le renvoie)")

        # 2) Appel MMR rank
        mmr_url = args.mmr_base.rstrip("/") + f"/mmr/player-ratings/{user_id}/rank"
        mmr_headers = {
            "Accept": "*/*",
            "x-theorycraft-clientversion": args.mmr_client_version,
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "Loki/UE5-CL-0 (http-legacy) Windows/10.0.26100.1.256.64bit",
        }
        mmr_res = sess.get(mmr_url, headers=mmr_headers, timeout=60)
        mmr_res.raise_for_status()
        print(json.dumps(mmr_res.json(), ensure_ascii=False))
    elif args.cmd == "mmr_rating_v3":
        # OAuth v3: grant_type=password pour obtenir un access_token
        sess = requests.Session()

        # form = {
        #     "password": args.password,
        #     "username": args.username,
        #     "grant_type": "password",
        #     "client_id": args.client_id,
        # }
        # oauth_res = sess.post(
        #     args.oauth_url,
        #     headers=headers,
        #     data=form,
        #     cookies={
        #         "_vwo_uuid_v2": "DBCC2D37FD67527D210DE8F430B8B06BF|5577ba59e5a77ae2836244b59d949d3b",
        #     },
        #     timeout=60,
        # )
        # oauth_res.raise_for_status()
        # oauth_payload = oauth_res.json()
        access_token = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImE5Njg5ZGYxNzVhZWU2OTI1MWY4MDZlNzc4Zjg5MzYwZjNmMjQ0YTMiLCJ0eXAiOiJKV1QifQ.eyJiYW5zIjpbXSwiY2xpZW50X2lkIjoiZWI5OTBhYzY0YjQ3NDZmMWEyOTBjYjhiZDQxMWM5OWEiLCJjb3VudHJ5IjoiRlIiLCJkaXNwbGF5X25hbWUiOiJIaXJldyIsImV4cCI6MTc2MjYxMzY4NCwiaWF0IjoxNzYyNjEwMDg0LCJpc19jb21wbHkiOnRydWUsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMucHJvamVjdGxva2kudGhlb3J5Y3JhZnRnYW1lcy5jb20iLCJqZmxncyI6MSwianRpIjoiOGY4NTA1ODM0MGViNGQ4ZmEzOWRhOTRjNmM0YTcwMGUiLCJuYW1lc3BhY2UiOiJ0aGVvcnljcmFmdCIsIm5hbWVzcGFjZV9yb2xlcyI6W3sibmFtZXNwYWNlIjoibG9raSIsInJvbGVJZCI6ImM0YzAyZDFhNmU3ODQzNzliNjhmOGQ0MzA3ZTFhY2U5In0seyJuYW1lc3BhY2UiOiJ0aGVvcnljcmFmdC0iLCJyb2xlSWQiOiIyMjUxNDM4ODM5ZTk0OGQ3ODNlYzBlNTI4MWRhZjA1YiJ9XSwicGVybWlzc2lvbnMiOltdLCJyb2xlcyI6W10sInNjb3BlIjoiYWNjb3VudCBjb21tZXJjZSBzb2NpYWwgcHVibGlzaGluZyBhbmFseXRpY3MiLCJzdWIiOiIwNTk3YmViMjdmN2Y0ZmFjYjRjYTYzNTIyYmY0MTY4ZSIsInVuaXF1ZV9kaXNwbGF5X25hbWUiOiJoaXJldyM5OTEzIn0.mKR2ZKRxVtGCRR0Q1rfsLLzNXjJNzCDj96FQQ8rBVFYXdNoqQuG5k_K_mQ7eTSliBfjZXBlQFXIRVbrgGTI0YvHST2zWXrQ77WEtg4lc7CHh56OqsyAYWOBTL5236M_91gRdzC8I0MgzVc2D1TvvAI469VfZaTuIt2zecFokKm13DSaJmq3J81zdp3quH2Yc8IIpk1nXbtBnFVgR9PuqIG6cJUr1PXSBudnRJKRZCsVn4FSEppargpUrxfZ_CTbQLABaE6HJrnwpkQi2QU15B98QzmLcWd-xYcm1SorgSQfI03gpCLxKjOhJlPxNIIQ1F4HiO3iAejrqyvfRX72ZwQ"
        if not access_token:
            raise SystemExit("OAuth v3: access_token manquant dans la réponse")
        mmr_headers = {
            "Accept": "*/*",
            "x-theorycraft-clientversion": "",
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "Loki/UE5-CL-0 (http-legacy) Windows/10.0.26100.1.256.64bit",
        }
        # Déterminer l'user_id: dans la réponse ou dans le JWT (claim)
        user_id = "80421fd76eb541e79dacd35bfdcefb49"
        if not user_id:
            try:
                parts = str(access_token).split(".")
                if len(parts) >= 2:
                    import base64
                    def _b64url_decode(s: str) -> bytes:
                        s += "=" * (-len(s) % 4)
                        return base64.urlsafe_b64decode(s.encode("utf-8"))
                    payload_raw = _b64url_decode(parts[1])
                    claims = json.loads(payload_raw.decode("utf-8"))
                    user_id = claims.get("user_id") or claims.get("userId") or claims.get("uid") or claims.get("sub")
            except Exception:
                user_id = None
        if not user_id:
            raise SystemExit("OAuth v3: user_id introuvable dans la réponse/token")

        # Appeler l'endpoint MMR
        mmr_url = args.mmr_base.rstrip("/") + f"/mmr/player-ratings/{user_id}/rank"
        mmr_res = sess.get(mmr_url, headers=mmr_headers, timeout=60)
        mmr_res.raise_for_status()
        print(json.dumps(mmr_res.json(), ensure_ascii=False))
    elif args.cmd == "mmr_correlation":
        # Charger MMR JSON
        try:
            with open(args.mmr_json, "r", encoding="utf-8") as f:
                mmr_payload = json.load(f)
        except Exception as e:
            raise SystemExit(f"Impossible de lire --mmr_json: {e}")

        # Extraire updates de la file par défaut
        updates = []
        try:
            qrr = (mmr_payload.get("QueueRankRating") or {}).get("default") or {}
            updates = qrr.get("Updates") or []
        except Exception:
            updates = []
        if not updates:
            raise SystemExit("Aucune 'Updates' trouvée dans le JSON MMR (QueueRankRating.default.Updates)")

        # Récupérer les matchs Supervive (pages)
        items = svc.get_player_matches_pages(args.platform, args.player_id, pages=args.pages)
        # Indexer par match id probable
        by_match: Dict[str, Dict[str, Any]] = {}
        for it in items:
            mid = it.get("match_id") or it.get("matchId") or it.get("id") or it.get("MatchID")
            if isinstance(mid, str):
                by_match[mid] = it

        # Construire dataset corrélé
        rows: List[Dict[str, Any]] = []
        for u in updates:
            mid = u.get("MatchID") or u.get("match_id")
            if not isinstance(mid, str):
                continue
            sv = by_match.get(mid)
            stats = (sv or {}).get("stats") or {}
            # Champs supplémentaires potentiels avec clés de secours
            creep_kills = stats.get("CreepKills") or stats.get("CreepsKilled") or stats.get("CreepsKills")
            hero_damage = stats.get("HeroDamageDone") or stats.get("HeroEffectiveDamageDone")
            gold_treasure = stats.get("GoldFromTreasure") or stats.get("TreasureGold") or stats.get("GoldTreasure")
            gold_monsters = stats.get("GoldFromMonsters") or stats.get("MonstersGold") or stats.get("GoldMonsters")
            row = {
                "match_id": mid,
                "rating_delta": u.get("RatingDelta"),
                "kills_u": u.get("KillsAmount"),
                "elims_u": u.get("ElimsAmount"),
                "placement_u": u.get("Placement"),
                "bonus": u.get("Bonus"),
                "cost": u.get("Cost"),
                "kills": stats.get("Kills"),
                "deaths": stats.get("Deaths"),
                "assists": stats.get("Assists"),
                "creep_kills": creep_kills,
                "hero_damage": hero_damage,
                "gold_treasure": gold_treasure,
                "gold_monsters": gold_monsters,
                "placement": sv.get("placement") if sv else None,
                "is_ranked": sv.get("is_ranked") if sv else None,
                "queue_id": sv.get("queue_id") if sv else None,
            }
            rows.append(row)

        # Filtrer valeurs numériques
        def _to_float(x: Any) -> float:
            try:
                return float(x)
            except Exception:
                return float("nan")

        # Colonnes d'intérêt
        cols = [
            ("kills", "Kills (API)"),
            ("kills_u", "Kills (MMR)"),
            ("elims_u", "Elims (MMR)"),
            ("deaths", "Deaths (API)"),
            ("placement", "Placement (API)"),
            ("placement_u", "Placement (MMR)"),
            ("bonus", "Bonus (MMR)"),
            ("cost", "Cost (MMR)"),
            ("creep_kills", "CreepKills (API)"),
            ("hero_damage", "HeroDamageDone (API)"),
            ("gold_treasure", "GoldFromTreasure (API)"),
            ("gold_monsters", "GoldFromMonsters (API)"),
        ]

        # Calculer corrélations de Pearson
        try:
            import math
            import numpy as np
            import seaborn as sns
            import matplotlib.pyplot as plt
        except Exception as e:
            raise SystemExit(f"numpy/seaborn/matplotlib requis: pip install numpy seaborn matplotlib\n{e}")

        # Construire arrays
        y = np.array([_to_float(r.get("rating_delta")) for r in rows], dtype=float)
        valid_mask = ~np.isnan(y)

        correlations: Dict[str, float] = {}
        for key, _ in cols:
            x = np.array([_to_float(r.get(key)) for r in rows], dtype=float)
            m = valid_mask & ~np.isnan(x)
            if m.sum() >= 3:
                x_m = x[m]
                y_m = y[m]
                # Pearson r
                x_std = x_m.std(ddof=1)
                y_std = y_m.std(ddof=1)
                if x_std > 0 and y_std > 0:
                    r = float(np.corrcoef(x_m, y_m)[0, 1])
                else:
                    r = float("nan")
            else:
                r = float("nan")
            correlations[key] = r

        # Tracé: matrice de corrélations et scatter pour top 3 corrélés en valeur absolue
        # Préparer dataframe léger
        try:
            import pandas as pd
            df = pd.DataFrame(rows)
        except Exception:
            df = None

        # Sélection top 3
        ranked = sorted([(k, abs(v)) for k, v in correlations.items() if not math.isnan(v)], key=lambda t: t[1], reverse=True)
        top_keys = [k for k, _ in ranked[:3]]

        # Figure
        fig, axes = plt.subplots(2, max(1, len(top_keys)), figsize=(6 * max(1, len(top_keys)), 9))
        if len(top_keys) == 1:
            axes = np.array([[axes[0]], [axes[1]]]) if isinstance(axes, np.ndarray) else np.array([[axes], [axes]])
        # 1) Barres des corrélations
        ax0 = axes[0, 0]
        labels = [lbl for _, lbl in cols]
        vals = [correlations.get(k) for k, _ in cols]
        ax0.barh(labels, [0 if v is None or math.isnan(v) else v for v in vals], color="#1f77b4")
        ax0.set_title("Corrélation (Pearson r) avec RatingDelta")
        ax0.axvline(0, color="#777", lw=1)
        ax0.set_xlim(-1, 1)

        # 2) Scatters top features
        for idx, key in enumerate(top_keys):
            ax = axes[1, idx]
            xv = np.array([_to_float(r.get(key)) for r in rows], dtype=float)
            m = valid_mask & ~np.isnan(xv)
            if m.sum() >= 3:
                ax.scatter(xv[m], y[m], s=18, alpha=0.6)
                # régression linéaire simple
                try:
                    coef = np.polyfit(xv[m], y[m], 1)
                    xp = np.linspace(xv[m].min(), xv[m].max(), 50)
                    yp = coef[0] * xp + coef[1]
                    ax.plot(xp, yp, color="#d62728", lw=2)
                except Exception:
                    pass
            ax.set_xlabel(next(lbl for k2, lbl in cols if k2 == key))
            ax.set_ylabel("RatingDelta")
            ax.grid(True, alpha=0.25)
            ax.set_title(f"Scatter: r={correlations.get(key):.2f}")

        fig.tight_layout()
        fig.savefig(args.out, dpi=200, bbox_inches="tight", facecolor="white")

        # Afficher tableau simple
        summary = { next(lbl for k2, lbl in cols if k2 == k): v for k, v in correlations.items() }
        print(json.dumps({"output": args.out, "n": int(len(rows)), "correlations": summary}, ensure_ascii=False))
    elif args.cmd == "jin_builds_details":
        try:
            import numpy as np
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
        except Exception as e:
            raise SystemExit(f"matplotlib requis: pip install matplotlib\n{e}")

        # Charger IDs de matchs
        items = svc.get_player_matches_pages(args.platform, args.player_id, pages=args.pages)

        # Normaliser liste de match_ids (tolérant)
        match_ids: list[str] = []
        for it in items:
            mid = it.get("match_id") or it.get("MatchID") or it.get("id") or it.get("matchId")
            if isinstance(mid, str):
                match_ids.append(mid)

        # Fonction utilitaire
        def _is_jin_name_or_asset(name_val: Any, asset_val: Any) -> bool:
            def _norm(s: Any) -> str:
                return str(s or "").strip().lower()
            n = _norm(name_val)
            a = _norm(asset_val)
            # tolérant: contient "jin" dans nom ou asset id
            return ("jin" in n) or ("jin" in a)

        def _num(x: Any) -> float:
            try:
                return float(x)
            except Exception:
                return float("nan")

        # Itérer chaque match: récupérer détails publics, trouver l'entrée du joueur, extraire placement + builds
        rows: List[Dict[str, Any]] = []
        for mid in match_ids:
            try:
                details = svc.get_match(args.platform, mid)
            except Exception:
                continue
            # details: liste par joueur
            entry = None
            if isinstance(details, list):
                # Heuristiques d'appariement joueur
                for p in details:
                    pid = p.get("player_id_encoded") or p.get("playerIdEncoded") or ((p.get("player") or {}).get("id"))
                    norm_pid = str(pid or "").replace("-", "")
                    target = args.player_id.replace("-", "")
                    if norm_pid and (norm_pid == target or norm_pid.endswith(target) or target.endswith(norm_pid)):
                        entry = p
                        break
                # fallback: prendre même team/hero si unique
                if entry is None and len(details) > 0:
                    # Prendre la première occurrence de Jin si unique
                    candidates = [p for p in details if _is_jin_name_or_asset(((p.get("hero") or {}).get("name")), (p.get("hero_asset_id") or p.get("heroAssetId")))]
                    if len(candidates) == 1:
                        entry = candidates[0]
            if not isinstance(entry, dict):
                continue

            hero_name = ((entry.get("hero") or {}).get("name"))
            hero_asset = (entry.get("hero_asset_id") or entry.get("heroAssetId"))
            if not _is_jin_name_or_asset(hero_name, hero_asset):
                continue

            # Ne garder que les parties classées
            is_ranked = entry.get("is_ranked") or entry.get("IsRanked")
            if not bool(is_ranked):
                continue

            placement = entry.get("placement")
            stats = entry.get("stats") or {}

            # Item build depuis inventory.{Boots, Inventory, Utility}
            def _extract_names(seq: Any) -> list[str]:
                out: list[str] = []
                if isinstance(seq, list):
                    for e in seq:
                        if isinstance(e, dict):
                            nm = e.get("name") or e.get("Name") or e.get("asset_id") or e.get("assetId") or e.get("id")
                            if nm:
                                out.append(str(nm))
                        else:
                            out.append(str(e))
                elif isinstance(seq, (str, int, float)):
                    out.append(str(seq))
                return out
            inventory = entry.get("inventory") or entry.get("Inventory") or {}
            def _ids(seq: Any) -> list[str]:
                out: list[str] = []
                if isinstance(seq, list):
                    for e in seq:
                        if isinstance(e, dict):
                            idv = e.get("identifier") or e.get("id") or e.get("name") or e.get("asset_id") or e.get("assetId")
                            if idv:
                                out.append(str(idv))
                        else:
                            out.append(str(e))
                elif isinstance(seq, dict):
                    idv = seq.get("identifier") or seq.get("id") or seq.get("name") or seq.get("asset_id") or seq.get("assetId")
                    if idv:
                        out.append(str(idv))
                elif isinstance(seq, (str, int, float)):
                    out.append(str(seq))
                return out

            boots_ids = _ids((inventory or {}).get("Boots"))
            inv_ids = _ids((inventory or {}).get("Inventory"))
            util_ids = _ids((inventory or {}).get("Utility"))

            parts: list[str] = []
            if boots_ids:
                parts.append("+".join(boots_ids))
            if inv_ids:
                parts.append("+".join(inv_ids))
            if util_ids:
                parts.append("+".join(util_ids))
            item_build = "|".join(parts) if parts else "(none)"

            # Ability build depuis ability_events (s'arrêter quand une ability atteint niveau 4)
            ability_events = entry.get("ability_events") or entry.get("AbilityEvents")
            ability_build = None
            if isinstance(ability_events, list) and ability_events:
                ab_labels: list[str] = []
                ability_levels: Dict[str, int] = {}  # Suivre le niveau de chaque ability
                for ev in ability_events:
                    if isinstance(ev, dict):
                        nm = ev.get("hotkey") or ev.get("ability") or ev.get("name")
                        level = ev.get("level") or ev.get("Level")
                        if nm:
                            nm_str = str(nm)
                            # Incrémenter le niveau de cette ability
                            ability_levels[nm_str] = ability_levels.get(nm_str, 0) + 1
                            # S'arrêter si une ability atteint le niveau 4
                            if ability_levels[nm_str] >= 4:
                                break
                            ab_labels.append(nm_str)
                if ab_labels:
                    ability_build = ">".join(ab_labels)
            if not ability_build:
                # fallback sur anciens champs
                raw_abilities = entry.get("AbilityBuild") or entry.get("AbilityOrder") or entry.get("Abilities") or entry.get("abilities")
                if isinstance(raw_abilities, list):
                    ab_labels = _extract_names(raw_abilities)
                    if ab_labels:
                        ability_build = ">".join(ab_labels[:12])
                elif isinstance(raw_abilities, (str, int, float)):
                    ability_build = str(raw_abilities)
            if not ability_build:
                ability_build = "(none)"

            rows.append({
                "placement": placement,
                "item_build": item_build,
                "ability_build": ability_build,
            })

        # Regrouper et calculer placement moyen par build (garder n>=2 pour stabilité)
        def _group_mean(rows_in: List[Dict[str, Any]], key: str) -> List[tuple[str, float, int]]:
            buckets: Dict[str, List[float]] = {}
            for r in rows_in:
                label = r.get(key)
                if not isinstance(label, str) or not label:
                    continue
                p = _num(r.get("placement"))
                if np.isnan(p):
                    continue
                buckets.setdefault(label, []).append(p)
            out: List[tuple[str, float, int]] = []
            for lbl, vals in buckets.items():
                if len(vals) >= max(1, int(args.min_n)):
                    out.append((lbl, float(np.mean(vals)), len(vals)))
            out.sort(key=lambda t: t[1])
            return out

        item_stats = _group_mean(rows, "item_build")
        ability_stats = _group_mean(rows, "ability_build")

        if not item_stats and not ability_stats:
            raise SystemExit("Aucune donnée exploitable pour Jin (item/ability builds)")

        top_n = 12
        item_top = item_stats[:top_n]
        abil_top = ability_stats[:top_n]

        cols_n = 1 if (item_top and not abil_top) or (abil_top and not item_top) else 2
        fig, axes = plt.subplots(1, cols_n, figsize=(8 * cols_n, 6))
        if cols_n == 1:
            axes = [axes]

        idx_ax = 0
        if item_top:
            ax = axes[idx_ax]; idx_ax += 1
            labels = [t[0] for t in item_top]
            means = [t[1] for t in item_top]
            counts = [t[2] for t in item_top]
            y_pos = np.arange(len(labels))
            ax.barh(y_pos, means, color="#2ca02c")
            ax.set_yticks(y_pos, labels)
            ax.invert_yaxis()
            ax.set_xlabel("Placement moyen (plus bas est meilleur)")
            ax.set_title("Jin • Placement vs Item Build (détails)")
            for i, (m, c) in enumerate(zip(means, counts)):
                ax.text(m + 0.05, i, f"{m:.2f} (n={c})", va="center", fontsize=9)

        if abil_top:
            ax = axes[idx_ax]
            labels = [t[0] for t in abil_top]
            means = [t[1] for t in abil_top]
            counts = [t[2] for t in abil_top]
            y_pos = np.arange(len(labels))
            ax.barh(y_pos, means, color="#9467bd")
            ax.set_yticks(y_pos, labels)
            ax.invert_yaxis()
            ax.set_xlabel("Placement moyen (plus bas est meilleur)")
            ax.set_title("Jin • Placement vs Ability Build (détails)")
            for i, (m, c) in enumerate(zip(means, counts)):
                ax.text(m + 0.05, i, f"{m:.2f} (n={c})", va="center", fontsize=9)

        fig.tight_layout()
        out_path = args.out
        try:
            fig.savefig(out_path, dpi=200, bbox_inches="tight", facecolor="white")
        except Exception:
            pass
        print(json.dumps({"output": out_path, "rows": len(rows), "item_groups": len(item_stats), "ability_groups": len(ability_stats)}, ensure_ascii=False))
    else:
        parser.print_help()


