import logging
import os
from typing import Any

try:
    import boto3
except ImportError:
    boto3 = None

logger = logging.getLogger("eduanalytics.cloudwatch")

CW_NAMESPACE = os.getenv("CLOUDWATCH_NAMESPACE", "EduAnalytics/Academico")
AWS_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-2"))


def publish_kpi_metrics(resumen: dict[str, Any], origen: str = "api") -> bool:
    """Publica KPIs académicos clave como métricas personalizadas en Amazon CloudWatch."""
    if not resumen or boto3 is None:
        return False
    try:
        client = boto3.client("cloudwatch", region_name=AWS_REGION)
        metric_data = [
            {
                "MetricName": "EstudiantesCargados",
                "Value": float(resumen.get("estudiantes", 0)),
                "Unit": "Count",
            },
            {
                "MetricName": "PromedioPuntajeEscala5",
                "Value": float(resumen.get("promedio_puntaje", 0)),
                "Unit": "None",
            },
            {
                "MetricName": "TasaReprobacionPct",
                "Value": float(resumen.get("pct_reprobados", 0)),
                "Unit": "Percent",
            },
            {
                "MetricName": "TasaSobresalientesPct",
                "Value": float(resumen.get("pct_sobresalientes", 0)),
                "Unit": "Percent",
            },
            {
                "MetricName": "TasaRiesgoDesercionPct",
                "Value": float(resumen.get("pct_riesgo_desercion", 0)),
                "Unit": "Percent",
            },
            {
                "MetricName": "ParticipacionMediaPct",
                "Value": round(float(resumen.get("participacion_media", 0)) * 100.0, 2),
                "Unit": "Percent",
            },
        ]
        client.put_metric_data(Namespace=CW_NAMESPACE, MetricData=metric_data)
        logger.info(
            "CloudWatch métricas publicadas (%s): estudiantes=%s promedio=%s riesgo=%s%%",
            origen,
            resumen.get("estudiantes"),
            resumen.get("promedio_puntaje"),
            resumen.get("pct_riesgo_desercion"),
        )
        return True
    except Exception as exc:
        logger.warning("No se pudieron publicar métricas en CloudWatch (%s): %s", origen, exc)
        return False
