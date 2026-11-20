from collections import defaultdict
from typing import Any

import numpy as np
from scipy import stats

from app.repositories.academic_repository import (
    AcademicRepository,
    ALLOWED_GROUP_COLUMNS,
    ALLOWED_METRIC_COLUMNS,
)


def _safe_float(val: Any, decimals: int = 4) -> float | None:
    if val is None:
        return None
    f = float(val)
    if np.isnan(f) or np.isinf(f):
        return None
    return round(f, decimals)


def _welch_anova(arrays: list[np.ndarray]) -> tuple[float | None, float | None, float | None, float | None]:
    k = len(arrays)
    if k < 2:
        return None, None, None, None
    ns = np.array([len(a) for a in arrays], dtype=float)
    means = np.array([np.mean(a) for a in arrays], dtype=float)
    variances = np.array([np.var(a, ddof=1) for a in arrays], dtype=float)
    if np.any(ns < 2) or np.any(variances <= 0):
        return None, None, None, None

    weights = ns / variances
    w_sum = np.sum(weights)
    weighted_mean = np.sum(weights * means) / w_sum
    numerator = np.sum(weights * (means - weighted_mean) ** 2) / (k - 1)

    lambda_term = np.sum(((1 - weights / w_sum) ** 2) / (ns - 1))
    denominator = 1 + (2 * (k - 2) / (k**2 - 1)) * lambda_term
    f_welch = numerator / denominator
    df1 = k - 1
    df2 = (k**2 - 1) / (3 * lambda_term) if lambda_term > 0 else np.sum(ns) - k
    p_welch = float(stats.f.sf(f_welch, df1, df2))
    return float(f_welch), p_welch, float(df1), float(df2)


class AnovaService:
    def __init__(self, repo: AcademicRepository | None = None):
        self.repo = repo or AcademicRepository()

    def list_options(self) -> dict[str, Any]:
        return {
            "grupos": [{"clave": k, "etiqueta": v[1]} for k, v in ALLOWED_GROUP_COLUMNS.items()],
            "metricas": [{"clave": k, "etiqueta": v[1]} for k, v in ALLOWED_METRIC_COLUMNS.items()],
        }

    def run_anova(self, group_key: str, metric_key: str, alpha: float = 0.05) -> dict[str, Any]:
        rows = self.repo.fetch_grouped_metric(group_key, metric_key)
        grouped: dict[str, list[float]] = defaultdict(list)
        for row in rows:
            grouped[str(row["grupo"])].append(float(row["valor"]))

        # Orden natural para categorías ordinales
        custom_order = {
            "Primaria": 1, "Secundaria": 2, "Bachillerato": 3,
            "Bajo": 1, "Medio": 2, "Alto": 3,
        }
        # Filtrar grupos con al menos 3 observaciones para pruebas de varianza/normalidad
        valid_items = sorted(
            [(g, np.array(vals, dtype=float)) for g, vals in grouped.items() if len(vals) >= 3],
            key=lambda item: (custom_order.get(item[0], 99), item[0]),
        )
        excluded_groups = [g for g, vals in grouped.items() if len(vals) < 3]

        if len(valid_items) < 2:
            raise ValueError("Se necesitan al menos 2 grupos con 3 o más observaciones para ejecutar ANOVA.")

        labels = [g for g, _ in valid_items]
        arrays = [arr for _, arr in valid_items]
        all_values = np.concatenate(arrays)
        grand_mean = float(np.mean(all_values))
        total_n = int(len(all_values))
        k = len(arrays)

        # 1. Estadísticas descriptivas + IC 95% + Shapiro-Wilk por grupo
        grupos_stats: list[dict[str, Any]] = []
        normalidad_resultados: list[dict[str, Any]] = []

        ss_between = 0.0
        ss_within = 0.0

        for label, arr in valid_items:
            n = len(arr)
            mean = float(np.mean(arr))
            std = float(np.std(arr, ddof=1))
            se = std / np.sqrt(n)
            t_crit = float(stats.t.ppf(1 - alpha / 2, df=n - 1))
            ci_low = mean - t_crit * se
            ci_high = mean + t_crit * se
            q1, median, q3 = np.percentile(arr, [25, 50, 75])

            ss_between += n * (mean - grand_mean) ** 2
            ss_within += float(np.sum((arr - mean) ** 2))

            grupos_stats.append({
                "grupo": label,
                "n": n,
                "media": _safe_float(mean, 4),
                "desviacion_std": _safe_float(std, 4),
                "error_std": _safe_float(se, 4),
                "ic95_inf": _safe_float(ci_low, 4),
                "ic95_sup": _safe_float(ci_high, 4),
                "minimo": _safe_float(np.min(arr), 4),
                "q1": _safe_float(q1, 4),
                "mediana": _safe_float(median, 4),
                "q3": _safe_float(q3, 4),
                "maximo": _safe_float(np.max(arr), 4),
            })

            if np.ptp(arr) == 0:
                shapiro_w, shapiro_p, cumple_norm = None, None, False
                nota_norm = "Varianza cero en el grupo"
            else:
                shapiro_res = stats.shapiro(arr)
                shapiro_w = float(shapiro_res.statistic)
                shapiro_p = float(shapiro_res.pvalue)
                cumple_norm = shapiro_p >= alpha
                nota_norm = "Compatible con normalidad (p ≥ α)" if cumple_norm else "Se desvía de la normalidad (p < α)"

            normalidad_resultados.append({
                "grupo": label,
                "n": n,
                "estadistico_w": _safe_float(shapiro_w, 4),
                "p_valor": _safe_float(shapiro_p, 6),
                "cumple": cumple_norm,
                "interpretacion": nota_norm,
            })

        # 2. Homogeneidad de varianzas (Levene - mediana/Brown-Forsythe)
        levene_res = stats.levene(*arrays, center="median")
        levene_stat = float(levene_res.statistic)
        levene_p = float(levene_res.pvalue)
        homocedasticidad_ok = levene_p >= alpha

        # 3. ANOVA de un factor clásico
        f_stat, p_val = stats.f_oneway(*arrays)
        df_between = k - 1
        df_within = total_n - k
        df_total = total_n - 1
        ss_total = ss_between + ss_within
        ms_between = ss_between / df_between
        ms_within = ss_within / df_within if df_within > 0 else 0.0
        eta_squared = ss_between / ss_total if ss_total > 0 else 0.0

        if eta_squared < 0.01:
            efecto_label = "Despreciable"
        elif eta_squared < 0.06:
            efecto_label = "Pequeño"
        elif eta_squared < 0.14:
            efecto_label = "Mediano"
        else:
            efecto_label = "Grande"

        # 4. Alternativas robustas / no paramétricas (Welch + Kruskal-Wallis)
        welch_f, welch_p, welch_df1, welch_df2 = _welch_anova(arrays)
        kw_stat, kw_p = stats.kruskal(*arrays)

        # 5. Post-hoc Tukey HSD
        tukey_pairs: list[dict[str, Any]] = []
        if k >= 2:
            tukey_res = stats.tukey_hsd(*arrays)
            ci = tukey_res.confidence_interval(confidence_level=1 - alpha)
            for i in range(k):
                for j in range(i + 1, k):
                    diff = float(np.mean(arrays[i]) - np.mean(arrays[j]))
                    p_pair = float(tukey_res.pvalue[i, j])
                    tukey_pairs.append({
                        "grupo_a": labels[i],
                        "grupo_b": labels[j],
                        "diferencia_medias": _safe_float(diff, 4),
                        "ic95_inf": _safe_float(ci.low[i, j], 4),
                        "ic95_sup": _safe_float(ci.high[i, j], 4),
                        "p_valor": _safe_float(p_pair, 6),
                        "significativo": p_pair < alpha,
                    })
            tukey_pairs.sort(key=lambda x: (not x["significativo"], x["p_valor"] if x["p_valor"] is not None else 1.0))

        rechaza_h0 = float(p_val) < alpha
        normalidad_global = all(item["cumple"] for item in normalidad_resultados)

        group_label = ALLOWED_GROUP_COLUMNS[group_key][1]
        metric_label = ALLOWED_METRIC_COLUMNS[metric_key][1]

        mejor_grupo = max(grupos_stats, key=lambda g: g["media"] or -1e9)
        peor_grupo = min(grupos_stats, key=lambda g: g["media"] or 1e9)

        if rechaza_h0:
            decision = f"Se rechaza H₀ (p = {p_val:.6f} < α = {alpha})"
            conclusion = (
                f"Existen diferencias estadísticamente significativas en '{metric_label}' según '{group_label}' "
                f"(F({df_between}, {df_within}) = {f_stat:.3f}, p = {p_val:.6f}, η² = {eta_squared:.4f} — tamaño de efecto {efecto_label.lower()}). "
                f"El promedio más alto corresponde a '{mejor_grupo['grupo']}' ({mejor_grupo['media']}) y el más bajo a '{peor_grupo['grupo']}' ({peor_grupo['media']})."
            )
        else:
            decision = f"No se rechaza H₀ (p = {p_val:.6f} ≥ α = {alpha})"
            conclusion = (
                f"No se encontró evidencia estadística suficiente para afirmar que existan diferencias en '{metric_label}' "
                f"entre los grupos de '{group_label}' (F({df_between}, {df_within}) = {f_stat:.3f}, p = {p_val:.6f}, η² = {eta_squared:.4f})."
            )

        nota_supuestos = (
            "Todos los grupos cumplen normalidad y homocedasticidad; ANOVA clásico es plenamente válido."
            if (normalidad_global and homocedasticidad_ok)
            else (
                f"Al menos un supuesto paramétrico no se cumple estrictamente "
                f"(Normalidad global: {'Sí' if normalidad_global else 'No'}, Homogeneidad de varianzas Levene: {'Sí' if homocedasticidad_ok else 'No'}). "
                f"Se incluye Welch ANOVA (p = {welch_p:.6f}) y Kruskal-Wallis no paramétrico (H = {kw_stat:.3f}, p = {kw_p:.6f}) "
                f"para confirmar la robustez de la conclusión."
                if welch_p is not None
                else f"Al menos un supuesto paramétrico no se cumple estrictamente; Kruskal-Wallis (H = {kw_stat:.3f}, p = {kw_p:.6f}) sirve de confirmación no paramétrica."
            )
        )

        return {
            "configuracion": {
                "variable_categorica": group_key,
                "etiqueta_categorica": group_label,
                "variable_numerica": metric_key,
                "etiqueta_numerica": metric_label,
                "alpha": alpha,
                "total_observaciones": total_n,
                "num_grupos": k,
                "grupos_excluidos": excluded_groups,
                "media_global": _safe_float(grand_mean, 4),
            },
            "hipotesis": {
                "h0": f"Las medias poblacionales de {metric_label} son iguales en todos los grupos de {group_label} (μ₁ = μ₂ = ... = μₖ).",
                "h1": f"Al menos un grupo de {group_label} presenta una media poblacional de {metric_label} significativamente diferente.",
            },
            "supuestos": {
                "normalidad_global": normalidad_global,
                "normalidad_por_grupo": normalidad_resultados,
                "homogeneidad_levene": {
                    "estadistico": _safe_float(levene_stat, 4),
                    "p_valor": _safe_float(levene_p, 6),
                    "cumple": homocedasticidad_ok,
                    "interpretacion": (
                        "Varianzas homogéneas (p ≥ α)" if homocedasticidad_ok else "Varianzas heterogéneas (p < α)"
                    ),
                },
                "nota_metodologica": nota_supuestos,
            },
            "anova": {
                "f_estadistico": _safe_float(f_stat, 4),
                "p_valor": _safe_float(p_val, 6),
                "df_entre": df_between,
                "df_dentro": df_within,
                "df_total": df_total,
                "ss_entre": _safe_float(ss_between, 4),
                "ss_dentro": _safe_float(ss_within, 4),
                "ss_total": _safe_float(ss_total, 4),
                "ms_entre": _safe_float(ms_between, 4),
                "ms_dentro": _safe_float(ms_within, 4),
                "eta_cuadrado": _safe_float(eta_squared, 4),
                "tamano_efecto": efecto_label,
                "rechaza_h0": rechaza_h0,
                "decision": decision,
            },
            "pruebas_complementarias": {
                "welch_anova": {
                    "f_estadistico": _safe_float(welch_f, 4),
                    "df1": _safe_float(welch_df1, 2),
                    "df2": _safe_float(welch_df2, 2),
                    "p_valor": _safe_float(welch_p, 6),
                    "significativo": (welch_p < alpha) if welch_p is not None else None,
                },
                "kruskal_wallis": {
                    "h_estadistico": _safe_float(kw_stat, 4),
                    "p_valor": _safe_float(kw_p, 6),
                    "significativo": float(kw_p) < alpha,
                },
            },
            "grupos": grupos_stats,
            "posthoc_tukey": tukey_pairs,
            "conclusion": conclusion,
        }
