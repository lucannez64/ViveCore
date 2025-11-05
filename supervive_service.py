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
    else:
        parser.print_help()


